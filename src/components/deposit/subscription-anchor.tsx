"use client";

import { useEffect, useState } from "react";
import { PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/lib/currency";

// A typical AI subscription (ChatGPT Plus / Claude Pro) is $20/mo. Expressed in
// credits (1000 credits = $1) so we can render it in the user's currency via the
// same formatBalance, with the live FX the currency context already tracks.
const SUBSCRIPTION_CREDITS = 20 * 1000;

// Emerging-market pitch: pay-per-use only beats a subscription if the user can
// *see* how little they've spent. Shows month-to-date usage vs a $20/mo plan.
// Guardrail: the comparison only appears when it's actually favorable — a heavy
// user who's spent more than a subscription sees a neutral message instead.
export function SubscriptionAnchor() {
  const { formatBalance } = useCurrency();
  const [spent, setSpent] = useState<number | null>(null); // credits spent this month

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      // Every deduction (chat, research, code, image) is logged as a 'usage'
      // transaction with a negative amount, so this captures all spend.
      const { data } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "usage")
        .gte("created_at", start.toISOString())
        .limit(1000);

      const credits = (data ?? []).reduce(
        (sum, r) => sum + Math.abs(Number(r.amount) || 0),
        0
      );
      setSpent(credits);
    })();
  }, []);

  if (spent === null) return null; // avoid a flash before we know the number

  const savings = SUBSCRIPTION_CREDITS - spent;
  const favorable = savings > 0;

  return (
    <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-accent-muted/30 to-elevated/40 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
          <PiggyBank className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Pay only for what you ask
          </p>
          <p className="mt-1 text-[15px] font-bold text-foreground">
            You&apos;ve spent{" "}
            <span className="tabular-nums text-accent">{formatBalance(spent)}</span>{" "}
            this month
          </p>
          {favorable ? (
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              That&apos;s about{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatBalance(savings)}
              </span>{" "}
              less than a $20/mo AI subscription (
              <span className="tabular-nums">{formatBalance(SUBSCRIPTION_CREDITS)}</span>
              /mo). No subscription, no cap — you top up only when you need to.
            </p>
          ) : (
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              You&apos;ve been busy this month — and there&apos;s no subscription and
              no cap. Top up only when you need to.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
