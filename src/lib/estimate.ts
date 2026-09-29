// Rough pre-send cost estimate for the chat cost meter. Deliberately
// approximate — the user is billed for the ACTUAL tokens used (see
// lib/pricing.ts calculateCost + integrate-network retailCostCredits). The point
// here is to kill "how much will this cost me?" anxiety before sending, not to
// be an invoice. Kept as a pure, client-safe module (no server imports).

// Credits per 1K tokens, mirroring the default tier in lib/pricing.ts. Most
// chat models bill at ~the default rate; GLM-5.1 and premium models cost more.
const DEFAULT_RATE = { input: 1, output: 2 };
const GLM51_RATE = { input: 1.5, output: 6 };
// Frontier models (Claude on 0G Compute) — retail credits per 1K tokens at the
// listed wholesale × markup (og-compute-models.ts) and ZERO_G_USD_RATE=0.50,
// the same basis GLM51_RATE uses. ~20×+ GLM's cost — matches the heads-up in
// model-picker.tsx.
const PREMIUM_RATES: [RegExp, { input: number; output: number }][] = [
  [/claude-opus/i, { input: 58, output: 175 }],
  [/claude/i, { input: 131, output: 491 }],
];

// A typical answer's length. Output dominates cost, and we can't know it before
// generating, so we assume a normal-sized reply. The estimate is shown as "~".
export const TYPICAL_OUTPUT_TOKENS = 500;

// ~4 chars per token is a good enough rule of thumb for English prompts.
export function estimateInputTokens(text: string): number {
  return Math.ceil((text?.trim().length ?? 0) / 4);
}

// Estimated credits for the pending message, given the selected model id.
export function estimateCredits(model: string, promptText: string): number {
  const rate =
    PREMIUM_RATES.find(([re]) => re.test(model))?.[1] ??
    (/glm-?5[.\-]?1/i.test(model) ? GLM51_RATE : DEFAULT_RATE);
  const inTok = estimateInputTokens(promptText);
  const credits =
    (inTok / 1000) * rate.input + (TYPICAL_OUTPUT_TOKENS / 1000) * rate.output;
  // Billing rounds up with a 1-credit floor (calculateCost), so mirror that.
  return Math.max(1, Math.ceil(credits));
}
