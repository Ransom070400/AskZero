import { getNgnPerUsd } from "@/lib/exchange-rate";

// Fallback constant for synchronous contexts
export const NGN_TO_USD_FALLBACK = 1500;
export const USD_TO_CREDITS_RATE = 1000; // 1000 credits per $1 (i.e. 1 credit = 0.1 cent)

// Pricing per 1K tokens in credits. 1 credit = $0.001 (0.1¢).
// Margin target: ~3-5x wholesale to absorb Paystack/Stripe fees (~3%) and NGN fx volatility.
export const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  default: { input: 1, output: 2 },
  "glm-4": { input: 1, output: 2 },
  // GLM 5.1 via 0G Integrate Network (zai-org/GLM-5.1-FP8).
  // On-chain wholesale: 9.34e-4 / 7.8e-3 0G per 1k tokens.
  // At 0G ≈ $0.50 → ~$0.47 / $3.90 per 1M. Reasoning models burn output fast.
  // Growth pricing: 1.5 / 6 credits per 1k = $1.50 / $6 per 1M.
  // ~3x input / ~1.5x output margin at 0G=$0.50. Beats GPT-4o (40% cheaper) and
  // Claude Haiku 4.5 on output. If 0G price spikes, revisit — output margin is thin.
  "glm-5.1": { input: 1.5, output: 6 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING.default;
  return Math.ceil(
    (inputTokens / 1000) * pricing.input +
      (outputTokens / 1000) * pricing.output
  );
}

export async function convertToCredits(
  amount: number,
  currency: "NGN" | "USD"
): Promise<number> {
  if (currency === "NGN") {
    const rate = await getNgnPerUsd();
    const usd = amount / rate;
    return Math.floor(usd * USD_TO_CREDITS_RATE);
  }
  return Math.floor(amount * USD_TO_CREDITS_RATE);
}

export function creditsToUsdCents(credits: number): number {
  // 1000 credits = $1 = 100 cents → 1 credit = 0.1 cent
  return (credits / USD_TO_CREDITS_RATE) * 100;
}

export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}

export function formatCurrency(
  amount: number,
  currency: "NGN" | "USD"
): string {
  if (currency === "NGN") {
    return `₦${amount.toLocaleString()}`;
  }
  return `$${amount.toLocaleString()}`;
}

export function getPresets(currency: "NGN" | "USD") {
  if (currency === "NGN") {
    return [500, 1000, 2000, 5000];
  }
  return [1, 5, 10, 25];
}
