// Simple in-memory rate limiter (swap with Upstash for production/multi-instance)

const windowMs = 60_000; // 1 minute window

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Expired entries are only replaced when the same key comes back, so drop
// them now and then or the map grows with every key ever seen.
const SWEEP_EVERY = 500;
let calls = 0;

function sweep(now: number) {
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key);
  });
}

export function rateLimit(
  key: string,
  limit: number
): { ok: boolean; remaining: number } {
  const now = Date.now();
  if (++calls % SWEEP_EVERY === 0) sweep(now);
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: limit - entry.count };
}

export function rateLimitResponse() {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  );
}
