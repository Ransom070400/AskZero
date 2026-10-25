// Assistant tools, run server-side by the agent loop (agent.ts), which folds
// their results into the latest user message. This works regardless of
// whether the model endpoint supports native function-calling, and it's what
// lets the assistant look things up instead of guessing.

import { tavilySearch } from "./tavily";

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
