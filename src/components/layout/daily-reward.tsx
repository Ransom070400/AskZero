"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Gift, X, Check, Loader2 } from "lucide-react";

interface Status {
  can_claim: boolean;
  claimed_today: boolean;
  current_streak: number;
  next_streak: number;
  next_reward: number;
}

interface Claimed {
  reward: number;
  streak: number;
}

// A small once-a-day nudge to come back: claim free credits, and a
// consecutive-day streak grows the reward. Lives in the dashboard layout (which
// persists across navigation), so it doesn't re-pop on every route change.
export function DailyReward() {
  const [status, setStatus] = useState<Status | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<Claimed | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/daily")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  // Auto-hide the success card a few seconds after claiming.
  useEffect(() => {
    if (!claimed) return;
    const t = setTimeout(() => setDismissed(true), 3500);
    return () => clearTimeout(t);
  }, [claimed]);

  const claim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/daily", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setClaimed({ reward: data.reward, streak: data.streak });
      else setDismissed(true); // already claimed elsewhere / error — just close
    } finally {
      setClaiming(false);
    }
  };

  const showClaim = !!status?.can_claim && !claimed && !dismissed;
  const showSuccess = !!claimed && !dismissed;
  if (!showClaim && !showSuccess) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="fixed bottom-4 right-4 z-[60] w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-elevated shadow-2xl"
      >
        {showSuccess ? (
          <div className="p-4 text-center">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-[15px] font-bold text-foreground">
              +{claimed!.reward} credits
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-text-secondary">
              <Flame className="h-3.5 w-3.5 text-accent" />
              {claimed!.streak}-day streak — see you tomorrow
            </p>
          </div>
        ) : (
          <div className="relative p-4">
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="press absolute right-2.5 top-2.5 text-text-tertiary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-foreground">Daily reward</p>
                <p className="inline-flex items-center gap-1 text-[12px] text-text-tertiary">
                  {status!.current_streak > 0 ? (
                    <>
                      <Flame className="h-3.5 w-3.5 text-accent" />
                      Day {status!.next_streak} — keep your streak
                    </>
                  ) : (
                    "Come back daily for more"
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={claim}
              disabled={claiming}
              className="press mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60"
            >
              {claiming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Claim {status!.next_reward} free credits</>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
