"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/lib/currency";

const KEY = "askzero-welcome-credits";
// Only greet genuinely-new accounts (so existing users don't see it when this
// ships). The once-flag is the real gate; this just bounds it to newcomers.
const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function WelcomeCredits() {
  const { formatBalance } = useCurrency();
  const [amount, setAmount] = useState<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !active) return;
        const created = user.created_at ? new Date(user.created_at).getTime() : 0;
        if (!created || Date.now() - created > NEW_WINDOW_MS) return;
        const res = await fetch("/api/balance");
        if (!res.ok || !active) return;
        const { balance } = await res.json();
        if (typeof balance === "number" && balance > 0) {
          setAmount(balance);
          setShow(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show || amount === null) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-accent/20 bg-accent/10 px-4 py-2 text-[12.5px]">
      <Gift className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span className="text-foreground/90">
        <b className="font-semibold text-foreground">Welcome!</b> You&apos;ve got{" "}
        <b className="font-semibold text-foreground">{formatBalance(amount)}</b> free
        to start — ask anything. You only pay per question, so it lasts.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="press ml-1 rounded-md p-0.5 text-text-tertiary hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
