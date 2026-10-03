"use client";

import { useEffect, useState } from "react";

// One shared balance poller for the dashboard chrome. The top-nav pill and the
// account notice both read it, so /api/balance is hit once per interval
// instead of once per component.
const POLL_MS = 10_000;

let balance: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(b: number | null) => void>();

async function load() {
  try {
    const res = await fetch("/api/balance");
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.balance === "number") {
      balance = data.balance;
      listeners.forEach((l) => l(balance));
    }
  } catch {
    // keep the last known value
  }
}

/** Re-fetch now (e.g. right after a daily reward claim). */
export function refreshBalance() {
  return load();
}

export function useBalance(): number | null {
  const [value, setValue] = useState<number | null>(balance);

  useEffect(() => {
    listeners.add(setValue);
    if (listeners.size === 1) {
      load();
      timer = setInterval(load, POLL_MS);
    } else {
      setValue(balance);
    }
    return () => {
      listeners.delete(setValue);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);

  return value;
}
