"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, Check, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

interface Info {
  code: string;
  referredCount: number;
  earned: number;
  referrerBonus: number;
  refereeBonus: number;
}

// "Refer & earn" settings section. Fetches the user's code + stats, shows a
// shareable link, and lets someone who signed up without a link paste a code.
export function ReferralCard() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/referral");
      if (res.ok) setInfo(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const link =
    info && typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${info.code}`
      : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const redeem = async () => {
    const c = code.trim();
    if (!c || redeeming) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't redeem that code");
        return;
      }
      setRedeemed(true);
      setCode("");
      toast.success(`You earned ${data.refereeBonus} free credits! 🎉`);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        Refer &amp; earn
      </h2>
      <div className="overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-b from-accent-muted/40 to-elevated/40 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground">
              Invite friends, both get free credits
            </p>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              {info
                ? `They get ${info.refereeBonus} credits when they sign up with your link — you get ${info.referrerBonus}.`
                : "Share your link — when a friend joins, you both get free credits."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-text-tertiary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your link…
          </div>
        ) : info ? (
          <>
            {/* Share link */}
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                {link}
              </span>
              <button
                onClick={copy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-elevated px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-accent-muted hover:text-accent transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-[12px] text-text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {info.referredCount} friend{info.referredCount === 1 ? "" : "s"} joined
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5" />
                {info.earned} credits earned
              </span>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-error">Couldn&apos;t load your referral link.</p>
        )}

        {/* Redeem — for users who signed up without a link */}
        {!redeemed && (
          <div className="border-t border-border/50 pt-3">
            <p className="mb-2 text-[12px] text-text-tertiary">Have a referral code?</p>
            <div className="flex items-center gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7QW2MN"
                disabled={redeeming}
                className="h-9 flex-1 uppercase tracking-wide"
              />
              <Button size="sm" onClick={redeem} disabled={redeeming || !code.trim()}>
                {redeeming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Redeem"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
