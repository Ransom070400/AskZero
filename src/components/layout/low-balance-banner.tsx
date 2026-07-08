"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";

// Below this many credits (1000 credits = $1) we nudge a top-up.
const THRESHOLD = 200;

export function LowBalanceBanner() {
  const { formatBalance } = useCurrency();
  const [balance, setBalance] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/balance")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d && typeof d.balance === "number") setBalance(d.balance);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, []);

  if (balance === null || balance > THRESHOLD) return null;
  const out = balance <= 0;
  if (dismissed && !out) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-[12.5px] font-medium",
        out
          ? "bg-error/10 text-error"
          : "bg-warning/10 text-warning"
      )}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="text-foreground/90">
        {out
          ? "You're out of credits."
          : `Low balance — about ${formatBalance(balance)} left.`}
      </span>
      <Link
        href="/deposit"
        className="press rounded-full bg-foreground px-2.5 py-0.5 text-[11.5px] font-semibold text-background hover:opacity-90 transition-opacity"
      >
        Top up
      </Link>
      {!out && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="press ml-1 rounded-md p-0.5 text-text-tertiary hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
