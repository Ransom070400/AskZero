// 0G Token price feed and deposit utilities

const PRICE_CACHE_MS = 5 * 60 * 1000; // 5 minutes
let cachedPrice: { usd: number; timestamp: number } | null = null;

// Fallback price if API unavailable (adjust as needed)
const FALLBACK_OG_PRICE_USD = 0.01;

export async function getOGTokenPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < PRICE_CACHE_MS) {
    return cachedPrice.usd;
  }

  try {
    // Try CoinGecko first
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=zero-gravity&vs_currencies=usd",
      { next: { revalidate: 300 } }
    );

    if (res.ok) {
      const data = await res.json();
      const price = data["zero-gravity"]?.usd;
      if (price) {
        cachedPrice = { usd: price, timestamp: Date.now() };
        return price;
      }
    }
  } catch {
    // Fall through to fallback
  }

  cachedPrice = { usd: FALLBACK_OG_PRICE_USD, timestamp: Date.now() };
  return FALLBACK_OG_PRICE_USD;
}

// Convert 0G tokens to credits
// credits = ogAmount * ogPriceUsd * 1000 (1000 credits per $1)
export function ogToCredits(ogAmount: number, ogPriceUsd: number): number {
  return Math.floor(ogAmount * ogPriceUsd * 1000);
}

export function formatOGAmount(amount: number): string {
  return `${amount.toLocaleString()} A0GI`;
}

export const REQUIRED_CONFIRMATIONS = 12;

export const DEPOSIT_ADDRESS =
  process.env.NEXT_PUBLIC_DEPOSIT_WALLET_ADDRESS || "";
