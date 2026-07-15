// Rough pre-send cost estimate for the chat cost meter. Deliberately
// approximate — the user is billed for the ACTUAL tokens used (see
// lib/pricing.ts calculateCost + integrate-network retailCostCredits). The point
// here is to kill "how much will this cost me?" anxiety before sending, not to
// be an invoice. Kept as a pure, client-safe module (no server imports).

// Credits per 1K tokens, mirroring the default tier in lib/pricing.ts. Most
// chat models bill at ~the default rate; GLM-5.1 and premium models cost more.
const DEFAULT_RATE = { input: 1, output: 2 };
const GLM51_RATE = { input: 1.5, output: 6 };
// Frontier models (Claude) run ~15× GLM's per-token cost — matches the heads-up
// in model-picker.tsx.
const PREMIUM_MULTIPLIER = 15;

// A typical answer's length. Output dominates cost, and we can't know it before
// generating, so we assume a normal-sized reply. The estimate is shown as "~".
export const TYPICAL_OUTPUT_TOKENS = 500;

// ~4 chars per token is a good enough rule of thumb for English prompts.
export function estimateInputTokens(text: string): number {
  return Math.ceil((text?.trim().length ?? 0) / 4);
}

// Estimated credits for the pending message, given the selected model id.
export function estimateCredits(model: string, promptText: string): number {
  let rate = /glm-?5[.\-]?1/i.test(model) ? GLM51_RATE : DEFAULT_RATE;
  if (/claude/i.test(model)) {
    rate = { input: rate.input * PREMIUM_MULTIPLIER, output: rate.output * PREMIUM_MULTIPLIER };
  }
  const inTok = estimateInputTokens(promptText);
  const credits =
    (inTok / 1000) * rate.input + (TYPICAL_OUTPUT_TOKENS / 1000) * rate.output;
  // Billing rounds up with a 1-credit floor (calculateCost), so mirror that.
  return Math.max(1, Math.ceil(credits));
}
