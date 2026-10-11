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

// Safe arithmetic only: a small recursive-descent parser over numbers,
// + - * / % ^ (or **) and parentheses. No eval/Function — Workers forbid code
// generation from strings, so the old Function() version always threw there.
// Commas are thousands separators ("1,200").
export function calculate(expr: string): string {
  const src = expr.replace(/,/g, "").replace(/\*\*/g, "^");
  if (!/^[0-9+\-*/%^().\s]+$/.test(src)) {
    throw new Error("unsupported expression");
  }
  const tokens = src.match(/\d*\.?\d+(?:e[+-]?\d+)?|[-+*/%^()]/gi) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  // expr := term (('+' | '-') term)*
  const parseExpr = (): number => {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      v = next() === "+" ? v + parseTerm() : v - parseTerm();
    }
    return v;
  };
  // term := unary (('*' | '/' | '%') unary)*
  const parseTerm = (): number => {
    let v = parseUnary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next();
      const r = parseUnary();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  // unary := ('-' | '+') unary | power   (so -2^2 = -4)
  const parseUnary = (): number => {
    if (peek() === "-") {
      next();
      return -parseUnary();
    }
    if (peek() === "+") {
      next();
      return parseUnary();
    }
    return parsePower();
  };
  // power := primary ('^' unary)?   (right-associative)
  const parsePower = (): number => {
    const base = parsePrimary();
    if (peek() === "^") {
      next();
      return Math.pow(base, parseUnary());
    }
    return base;
  };
  const parsePrimary = (): number => {
    const t = next();
    if (t === "(") {
      const v = parseExpr();
      if (next() !== ")") throw new Error("unbalanced parentheses");
      return v;
    }
    if (t === undefined || !/^[\d.]/.test(t)) throw new Error("unsupported expression");
    return Number(t);
  };

  const val = parseExpr();
  if (pos !== tokens.length) throw new Error("unsupported expression");
  if (!Number.isFinite(val)) throw new Error("not a number");
  return String(val);
}

export interface Source {
  title: string;
  url: string;
}

// Results are numbered from `firstNumber` so numbers stay unique across
// several searches in one answer; the model cites them as [n] and the UI
// turns those into source chips.
export async function webSearchTool(
  query: string,
  firstNumber = 1
): Promise<{ text: string; sources: Source[] }> {
  const results = await tavilySearch(query, { maxResults: 5 });
  if (!results.length) return { text: "No results.", sources: [] };
  return {
    text: results
      .map(
        (r, i) =>
          `[${firstNumber + i}] ${r.title} — ${r.url}\n${r.content.slice(0, 400)}`
      )
      .join("\n\n"),
    sources: results.map((r) => ({ title: r.title, url: r.url })),
  };
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
