const FALLBACK_RATE = 1500;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let cachedRate: number | null = null;
let cachedAt = 0;

export async function getNgnPerUsd(): Promise<number> {
  if (cachedRate && Date.now() - cachedAt < CACHE_TTL) {
    return cachedRate;
  }

  try {
    const res = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      { next: { revalidate: 600 } }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const rate = data.rates?.NGN;

    if (typeof rate === "number" && rate > 0) {
      cachedRate = rate;
      cachedAt = Date.now();
      return rate;
    }
  } catch (err) {
    console.error("Exchange rate fetch failed, using fallback:", err);
  }

  return cachedRate ?? FALLBACK_RATE;
}

// Synchronous getter for client-side use (returns last known or fallback)
export function getNgnPerUsdSync(): number {
  return cachedRate ?? FALLBACK_RATE;
}
