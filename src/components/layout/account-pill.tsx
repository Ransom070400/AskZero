"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Gift, Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { useBalance, refreshBalance } from "@/lib/use-balance";
import { toast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Below this many credits (1000 credits = $1) the pill warns. Kept under the
// 100-credit signup grant so brand-new users aren't greeted as "low".
export const LOW_BALANCE = 50;

interface DailyStatus {
  can_claim: boolean;
  claimed_today: boolean;
  current_streak: number;
  next_streak: number;
  next_reward: number;
}

// Smoothly tick a number toward its target (e.g. balance after a top-up).
// Snaps on first value and when the user prefers reduced motion.
function useCountUp(target: number | null, duration = 700): number {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === null) return;
    const from = prevRef.current;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (from === null || reduce) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        prevRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

/**
 * Balance, streak and the daily reward in one place. The pill stays quiet —
 * just the balance, a small streak count, and a dot when a reward is waiting —
 * and everything else lives in its popover instead of floating over the chat.
 */
export function AccountPill() {
  const router = useRouter();
  const { formatBalance } = useCurrency();
  const balance = useBalance();
  const shown = useCountUp(balance);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  const loadDaily = useCallback(async () => {
    try {
      const res = await fetch("/api/daily");
      if (res.ok) setDaily(await res.json());
    } catch {
      // the pill works without it
    }
  }, []);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  const claim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/daily", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`+${data.reward} credits · ${data.streak}-day streak`);
        refreshBalance();
      }
      await loadDaily();
    } finally {
      setClaiming(false);
    }
  };

  // A live streak (claimed today, or yesterday and still claimable) shows the
  // count; a broken streak shows nothing.
  const streak =
    daily && (daily.claimed_today || daily.next_streak === daily.current_streak + 1)
      ? daily.current_streak
      : 0;
  const canClaim = !!daily?.can_claim;
  const low = balance !== null && balance <= LOW_BALANCE;
  const out = balance !== null && balance <= 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Balance and rewards"
          className={cn(
            "press relative flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-fast ease-out",
            out
              ? "border-error/40 bg-error/10 text-error"
              : low
                ? "border-warning/40 bg-warning/10 text-foreground"
                : "border-border/70 bg-elevated/80 text-foreground hover:border-border-strong"
          )}
        >
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-text-secondary">
              <Flame className="h-3.5 w-3.5 text-accent" />
              <span className="tabular-nums">{streak}</span>
            </span>
          )}
          <span className="tabular-nums">
            {balance !== null ? formatBalance(Math.round(shown)) : "—"}
          </span>
          {canClaim && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent"
            />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="p-4">
          <p className="text-xs font-medium text-text-tertiary">Balance</p>
          <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-foreground">
            {balance !== null ? formatBalance(balance) : "—"}
          </p>
          {low && (
            <p className={cn("mt-1 text-xs font-medium", out ? "text-error" : "text-warning")}>
              {out ? "You're out of credits." : "Running low — top up to keep asking."}
            </p>
          )}
          <button
            onClick={() => router.push("/deposit")}
            className="press mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add credits
          </button>
        </div>

        {daily && (
          <div className="border-t border-border/60 bg-surface/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
                {canClaim ? <Gift className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Daily reward</p>
                <p className="text-xs text-text-tertiary">
                  {canClaim
                    ? daily.current_streak > 0
                      ? `Day ${daily.next_streak} — keep your streak`
                      : "Come back daily for more"
                    : streak > 0
                      ? `${streak}-day streak — see you tomorrow`
                      : "Claimed — see you tomorrow"}
                </p>
              </div>
            </div>
            {canClaim && (
              <button
                onClick={claim}
                disabled={claiming}
                className="press mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent-muted py-2 text-sm font-semibold text-accent transition-colors hover:border-accent disabled:opacity-60"
              >
                {claiming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Claim {daily.next_reward} free credits</>
                )}
              </button>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
