// Cheap, LLM-free triage run before the agent's planner. A planner call costs
// ~3s, and most messages (greetings, writing, coding, explaining) never need a
// tool — so only messages that plausibly need fresh facts, a URL read, or math
// go to the planner. Deliberately errs toward planning when in doubt about
// anything time-sensitive, since a stale answer is worse than a slower one.

export type AgentRoute =
  | { kind: "skip" }
  | { kind: "calculate"; expression: string }
  | { kind: "plan" };

const URL_RE = /https?:\/\/\S+/i;

// Anything that may have changed since the model was trained.
const TIME_SENSITIVE_RE =
  /\b(today|tonight|tomorrow|yesterday|now|right now|current(ly)?|latest|recent(ly)?|this (week|month|year)|news|price|prices|cost of|rate|rates|exchange|weather|forecast|score|scores|fixture|stock|shares|crypto|bitcoin|btc|eth|election|who won|trending|20[2-9]\d)\b/i;

// Requests the model answers from its own ability, not from lookups.
const SELF_CONTAINED_RE =
  /^(please\s+)?(write|draft|compose|rewrite|rephrase|paraphrase|translate|summari[sz]e|explain|describe|teach|fix|refactor|debug|review|build|create|make|generate|design|brainstorm|plan|outline|improve|edit|proofread|convert|format|help me (write|draft|with|understand|plan|build)|give me (a|an|some|ideas|tips|examples)|tell me (a|an) (joke|story)|can you (write|draft|help|explain|make|create|build|fix))\b/i;

// Factual question shapes worth a quick look-up decision.
const FACTUAL_Q_RE =
  /^(who|what|when|where|which|whose|is|are|was|were|does|did|do|has|have|how (much|many|old|far|long|big|tall|often))\b/i;

// A bare arithmetic expression, optionally wrapped in "what is … ?" / "calculate …".
const ARITH_RE =
  /^(?:(?:what(?:'s| is)|calculate|compute|evaluate|solve)\s+)?([0-9\s+\-*/^%().,x×÷]+?)\s*(?:=\s*)?\??$/i;

function toExpression(raw: string): string | null {
  const expr = raw
    .replace(/[×x]/gi, "*")
    .replace(/÷/g, "/")
    .replace(/(\d),(?=\d{3}\b)/g, "$1") // 1,200 → 1200
    .trim();
  // Needs at least one operator between numbers to be worth calculating.
  return /\d\s*[+\-*/^%]\s*[\d(]/.test(expr) ? expr : null;
}

export function routeAgent(
  message: string,
  opts: { hasAttachments?: boolean } = {}
): AgentRoute {
  const text = message.trim();
  if (!text) return { kind: "skip" };

  const arith = text.match(ARITH_RE);
  if (arith) {
    const expression = toExpression(arith[1]);
    if (expression) return { kind: "calculate", expression };
  }

  if (URL_RE.test(text) || TIME_SENSITIVE_RE.test(text)) return { kind: "plan" };

  // Code, attachments, writing/explaining tasks, and small talk: no tools.
  if (text.includes("```") || opts.hasAttachments) return { kind: "skip" };
  if (SELF_CONTAINED_RE.test(text)) return { kind: "skip" };
  const words = text.split(/\s+/).length;
  if (words <= 4 && !text.includes("?")) return { kind: "skip" };

  // Factual questions and word problems with numbers: let the planner decide.
  if (FACTUAL_Q_RE.test(text) || (/\d/.test(text) && text.includes("?"))) {
    return { kind: "plan" };
  }
  return { kind: "skip" };
}
