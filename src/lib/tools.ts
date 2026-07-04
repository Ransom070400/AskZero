// Assistant tools. Before answering, the chat route asks a cheap planner which
// tools (if any) are needed, runs them server-side, and injects the results
// into the system prompt. This works regardless of whether the model endpoint
// supports native OpenAI function-calling, and it's what lets the assistant
// look things up instead of guessing.

import { complete, extractJson } from "./llm";
import { tavilySearch, tavilyConfigured } from "./tavily";

export function currentDateTime(): { iso: string; human: string } {
  const d = new Date();
  return { iso: d.toISOString(), human: d.toUTCString() };
}

// Safe arithmetic only — strictly limited charset, no identifiers/calls.
export function calculate(expr: string): string {
  const cleaned = expr.replace(/\^/g, "**").trim();
  if (!/^[0-9+\-*/%().,\s]+$/.test(cleaned)) {
    throw new Error("unsupported expression");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const val = Function(`"use strict"; return (${cleaned});`)();
  if (typeof val !== "number" || !Number.isFinite(val)) {
    throw new Error("not a number");
  }
  return String(val);
}

export async function webSearchTool(query: string): Promise<string> {
  const results = await tavilySearch(query, { maxResults: 5 });
  if (!results.length) return "No results.";
  return results
    .map((r, i) => `(${i + 1}) ${r.title} — ${r.url}\n${r.content.slice(0, 400)}`)
    .join("\n\n");
}

export async function fetchUrlTool(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error("invalid url");
  const res = await fetch(url, { headers: { "User-Agent": "AskZeroBot/1.0" } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 2500);
}

interface ToolCall {
  tool: "web_search" | "calculate" | "fetch_url";
  arg: string;
}

const PLANNER_SYSTEM =
  "You are a tool router for an AI assistant. Output ONLY JSON — no prose.";

// Decides which tools to run for this message, executes them, and returns a
// context block to append to the system prompt. Current date/time is always
// included (cheap, and models otherwise guess it).
export async function gatherToolContext(
  userMessage: string
): Promise<string> {
  const now = currentDateTime();
  let block = `\n\n---\nTOOL RESULTS (authoritative — prefer these over your own memory):\n[current_datetime] ${now.human}`;

  // Planner: which tools does this message need?
  let calls: ToolCall[] = [];
  try {
    const raw = await complete(
      `Decide which tools to call to answer the user's message accurately. Tools:\n` +
        `- web_search(query): for current events, facts, prices, docs, anyone/anything you're not 100% sure about or that may be out of date.\n` +
        `- calculate(expression): for arithmetic.\n` +
        `- fetch_url(url): to read a specific URL the user gave.\n` +
        `Return ONLY a JSON array like [{"tool":"web_search","arg":"..."}] (max 3), or [] if the message is pure chit-chat needing no facts. When in doubt, prefer web_search.\n\n` +
        `User message: ${userMessage}`,
      { system: PLANNER_SYSTEM, temperature: 0 }
    );
    calls = (extractJson<ToolCall[]>(raw) ?? []).slice(0, 3);
  } catch {
    // planner failed — proceed with just the datetime
  }

  // Safety net: the planner occasionally misses. If the message clearly needs
  // fresh facts and no web_search was planned, force one — better to look it up
  // than let the model guess.
  const factualSignal =
    /\b(current|latest|today|now|recent|news|price|cost|weather|release|version|score|results?|stock|rate|who\s+is|what\s+is|when\s+(is|was|will)|how\s+(much|many)|update|as of)\b/i.test(
      userMessage
    );
  if (
    factualSignal &&
    tavilyConfigured() &&
    !calls.some((c) => c.tool === "web_search")
  ) {
    calls.unshift({ tool: "web_search", arg: userMessage });
  }
  calls = calls.slice(0, 3);

  for (const call of calls) {
    try {
      if (call.tool === "web_search" && call.arg && tavilyConfigured()) {
        block += `\n\n[web_search "${call.arg}"]\n${await webSearchTool(call.arg)}`;
      } else if (call.tool === "calculate" && call.arg) {
        block += `\n\n[calculate "${call.arg}"] = ${calculate(call.arg)}`;
      } else if (call.tool === "fetch_url" && call.arg) {
        block += `\n\n[fetch_url ${call.arg}]\n${await fetchUrlTool(call.arg)}`;
      }
    } catch (e) {
      block += `\n\n[${call.tool} failed: ${(e as Error).message}]`;
    }
  }

  return block;
}
