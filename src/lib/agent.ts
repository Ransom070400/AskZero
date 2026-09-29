// Agentic reasoning loop. The model works step by step — think, optionally call
// a tool, observe, repeat — and we stream each step so the UI can show the live
// "thinking" trace (Thinking… → Searching "X" → Reading… → answer).
//
// Model-agnostic: uses a simple THINKING/ACTION/INPUT protocol parsed from plain
// text, so it doesn't depend on native OpenAI tool-calling support in the proxy.
// Returns an observations block that the caller injects into the final answer's
// system prompt.

import { complete } from "./llm";
import {
  currentDateTime,
  webSearchTool,
  calculate,
  fetchUrlTool,
} from "./tools";
import { tavilyConfigured } from "./tavily";
import { routeAgent } from "./agent-gate";

export interface AgentStep {
  type: "thinking" | "tool" | "tool_result";
  text?: string; // thinking text, or a short tool-result summary
  tool?: string; // tool name
  input?: string; // tool argument
}

// Only offer tools that can actually run — a planner that picks web_search
// when search isn't configured just wastes a ~3s call.
function agentSystem(search: boolean): string {
  const actions = search
    ? "web_search | calculate | fetch_url | none"
    : "calculate | fetch_url | none";
  const guide = search
    ? "- web_search for anything factual, current, numeric, or that you're not fully sure of. calculate for math. fetch_url to read a specific URL the user gave."
    : "- calculate for math. fetch_url to read a specific URL the user gave. There is no web search: answer other questions from knowledge.";
  return `You are the reasoning + tool-use engine for the AskZero assistant. Gather what you need to answer accurately — never guess.

Respond EACH step in EXACTLY this format (nothing else):
THINKING: <one short sentence: what you need next and why>
ACTION: <${actions}>
INPUT: <the argument for the action; leave blank if ACTION is none>

Rules:
${guide}
- You'll receive an OBSERVATION after each action. Decide if you need another step.
- When you have enough to answer confidently (or the message needs no tools), output ACTION: none. That ends gathering; the final answer is written separately.
- Be economical — usually 1 tool step is enough.`;
}

// At most this many tool calls; after the last one we go straight to the
// answer instead of spending another planner call to hear "none".
const MAX_TOOLS = 2;

type ToolName = "web_search" | "calculate" | "fetch_url";

function parseStep(out: string): {
  thinking: string;
  action: string;
  input: string;
} {
  const thinking = (
    out.match(/THINKING:\s*([\s\S]*?)(?:\nACTION:|$)/i)?.[1] ?? ""
  ).trim();
  const action = (out.match(/ACTION:\s*([a-z_]+)/i)?.[1] ?? "none")
    .trim()
    .toLowerCase();
  // Capture only the first line after INPUT: — the model sometimes echoes the
  // whole transcript, which would blow past search-query limits.
  const input = (out.match(/INPUT:[ \t]*(.*)/i)?.[1] ?? "").trim().slice(0, 300);
  return { thinking, action, input };
}

async function runTool(action: ToolName, input: string): Promise<string> {
  if (action === "web_search") return webSearchTool(input);
  if (action === "calculate") return `${input} = ${calculate(input)}`;
  return fetchUrlTool(input);
}

// Runs the loop, emitting each step. Returns the accumulated observations to
// fold into the final answer's context.
//
// Speed: a cheap LLM-free triage (agent-gate.ts) skips the planner for
// messages that don't need tools and calculates bare arithmetic directly.
// When the planner does run, a calculation ends gathering, a repeated call
// ends it, and there's no extra planner round-trip after the last tool.
export async function runAgentLoop(
  message: string,
  emit: (step: AgentStep) => void,
  opts: { hasAttachments?: boolean } = {}
): Promise<string> {
  let observations = `\n\n---\nTOOL RESULTS (authoritative — base your answer on these, not memory):\n[current_datetime] ${
    currentDateTime().human
  }`;

  const route = routeAgent(message, opts);
  if (route.kind === "skip") return observations;
  if (route.kind === "calculate") {
    try {
      const result = calculate(route.expression);
      emit({ type: "tool", tool: "calculate", input: route.expression });
      emit({ type: "tool_result", tool: "calculate", text: result });
      return observations + `\n\n[calculate "${route.expression}"]\n${route.expression} = ${result}`;
    } catch {
      return observations; // not actually computable — let the model answer
    }
  }

  const search = tavilyConfigured();
  // Without web search the planner can only calculate or read a link, so a
  // message with neither numbers nor a URL can't use any tool — skip the call.
  if (!search && !/\d|https?:\/\//i.test(message)) return observations;
  const system = agentSystem(search);
  const scratch: { role: string; content: string }[] = [
    { role: "user", content: `User question: ${message}` },
  ];
  const seen = new Set<string>();

  for (let tools = 0; tools < MAX_TOOLS; ) {
    let out: string;
    try {
      out = await complete(
        scratch.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n"),
        { system, temperature: 0.2 }
      );
    } catch {
      break; // planner unavailable — answer with what we have
    }

    const { thinking, action, input } = parseStep(out);
    if (thinking) emit({ type: "thinking", text: thinking });

    const isTool =
      (action === "web_search" && search) ||
      action === "calculate" ||
      action === "fetch_url";
    if (!isTool || !input) break; // ACTION: none → done gathering
    const key = `${action}:${input.toLowerCase()}`;
    if (seen.has(key)) break; // repeating itself — it already has this
    seen.add(key);

    emit({ type: "tool", tool: action, input });
    let obs: string;
    try {
      obs = await runTool(action as ToolName, input);
    } catch (e) {
      obs = `Error: ${(e as Error).message}`;
    }
    emit({ type: "tool_result", tool: action, text: obs.slice(0, 200) });
    observations += `\n\n[${action} "${input}"]\n${obs}`;
    tools++;

    // A calculation is conclusive, and after the last allowed tool another
    // planner call could only say "none".
    if (action === "calculate" || tools >= MAX_TOOLS) break;

    scratch.push({
      role: "assistant",
      content: `THINKING: ${thinking}\nACTION: ${action}\nINPUT: ${input}`,
    });
    scratch.push({ role: "user", content: `OBSERVATION:\n${obs.slice(0, 3000)}` });
  }

  return observations;
}
