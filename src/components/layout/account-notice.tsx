"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Gift, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/lib/currency";
import { useBalance } from "@/lib/use-balance";
import { LOW_BALANCE } from "./account-pill";

const WELCOME_KEY = "askzero-welcome-credits";
// Only greet genuinely-new accounts. The once-flag is the real gate; this just
// bounds it to newcomers.
const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The dashboard's single banner slot. At most one notice shows at a time, in
 * priority order: out of credits → low balance → welcome credits.
 */
export function AccountNotice() {
  const { formatBalance } = useCurrency();
  const balance = useBalance();
  const [lowDismissed, setLowDismissed] = useState(false);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(WELCOME_KEY)) return;
    } catch {
      return;
    }
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        const created = user?.created_at ? new Date(user.created_at).getTime() : 0;
        if (active && created && Date.now() - created <= NEW_WINDOW_MS) setWelcome(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const dismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* ignore */
    }
    setWelcome(false);
  };

  if (balance === null) return null;

  const out = balance <= 0;
  const low = balance <= LOW_BALANCE;

  if (out || (low && !lowDismissed)) {
    return (
      <Notice tone={out ? "error" : "warning"} onDismiss={out ? undefined : () => setLowDismissed(true)}>
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground/90">
          {out ? "You're out of credits." : `Low balance — about ${formatBalance(balance)} left.`}
        </span>
        <Link
          href="/deposit"
          className="press rounded-full bg-foreground px-2.5 py-0.5 text-2xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          Top up
        </Link>
      </Notice>
    );
  }

  if (welcome && balance > 0) {
    return (
      <Notice tone="accent" onDismiss={dismissWelcome}>
        <Gift className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="text-foreground/90">
          You&apos;ve got <b className="font-semibold text-foreground">{formatBalance(balance)}</b>{" "}
          free to start. You pay per question, so it lasts.
        </span>
      </Notice>
    );
  }

  return null;
}

function Notice({
  tone,
  onDismiss,
  children,
}: {
  tone: "error" | "warning" | "accent";
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 border-b px-4 py-2 text-xs font-medium",
        tone === "error" && "border-error/20 bg-error/10 text-error",
        tone === "warning" && "border-warning/20 bg-warning/10 text-warning",
        tone === "accent" && "border-accent/20 bg-accent/10"
      )}
    >
      {children}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="press ml-1 rounded-md p-0.5 text-text-tertiary transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
