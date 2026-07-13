"use client";

import { useState } from "react";
import { Fuel, Loader2, Check, ExternalLink, AlertCircle } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Success {
  txHash: string;
  explorerUrl: string | null;
  amount: string;
}

export default function GasPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const claim = async () => {
    const addr = address.trim();
    if (!addr || loading) return;
    setLoading(true);
    setError(null);
    setErrorLink(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setErrorLink(data.explorerUrl || null);
        return;
      }
      setSuccess({
        txHash: data.txHash,
        explorerUrl: data.explorerUrl ?? null,
        amount: data.amount ?? "0.001",
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-[440px] space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-5 text-center">
          <Logo size={40} animated />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold tracking-[-0.025em] text-foreground">
              Claim 0G gas to vote
            </h1>
            <p className="mx-auto max-w-[360px] text-[14px] leading-relaxed text-text-secondary">
              Voters need exactly <span className="font-semibold text-foreground">0.001 0G</span>{" "}
              to 5× their vote. Enter your wallet address and we&apos;ll send it —
              one claim per wallet.
            </p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 rounded-2xl border border-success/30 bg-success/5 p-5 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-[15px] font-bold text-foreground">
                {success.amount} 0G is on the way
              </p>
              <p className="text-[13px] text-text-secondary">
                It should land in your wallet in a few seconds. You can vote once
                it arrives.
              </p>
            </div>
            {success.explorerUrl && (
              <a
                href={success.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-1.5 text-[12px] font-semibold text-accent transition hover:bg-accent/20"
              >
                View transaction
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-elevated/60 p-5">
            <label htmlFor="wallet" className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
              Your 0G wallet address
            </label>
            <Input
              id="wallet"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && claim()}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
              className="font-mono"
            />

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <div className="space-y-1">
                  <p className="text-[13px] leading-snug text-error">{error}</p>
                  {errorLink && (
                    <a
                      href={errorLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
                    >
                      View previous claim
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={claim}
              disabled={loading || !address.trim()}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Fuel className="mr-1.5 h-4 w-4" />
              )}
              {loading ? "Sending…" : "Claim 0.001 0G"}
            </Button>
          </div>
        )}

        <p className="text-center text-[11px] leading-relaxed text-text-tertiary">
          One claim per wallet. Sent on 0G mainnet.
        </p>
      </div>
    </div>
  );
}
