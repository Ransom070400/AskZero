// Conversion rates — adjust as needed
export const NGN_TO_USD_RATE = 1500; // 1 USD = 1500 NGN
export const USD_TO_CREDITS_RATE = 1000; // 1000 credits per $1 (i.e. 1 credit = 0.1 cent)

// Fallback pricing per 1K tokens in credits (when 0G price unavailable)
export const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  default: { input: 1, output: 2 },
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

export function convertToCredits(
  amount: number,
  currency: "NGN" | "USD"
): number {
  if (currency === "NGN") {
    const usd = amount / NGN_TO_USD_RATE;
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
