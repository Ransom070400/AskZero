"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
} from "@reown/appkit/react";
import type { Eip1193Provider } from "ethers";
import { Wallet, Loader2, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEPOSIT_ADDRESS, depositMessage } from "@/lib/og-token";
import { APPKIT_READY } from "@/lib/appkit";

type Phase = "idle" | "sending" | "verifying" | "pending" | "done" | "error";

export function ZeroGPay({ onCredited }: { onCredited?: () => void }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => setMounted(true), []);

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const amountNum = parseFloat(amount) || 0;
  const busy = phase === "sending" || phase === "verifying" || phase === "pending";

  const verifyLoop = async (txHash: string, addr: string, signature: string) => {
    for (let i = 0; i < 30; i++) {
      const res = await fetch("/api/deposit/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, address: addr, signature }),
      });
      const data = await res.json();
      if (res.ok && data.status === "completed") {
        setCredits(data.credits ?? null);
        setPhase("done");
        onCredited?.();
        return;
      }
      if (res.status === 202 || data.status === "pending") {
        setPhase("pending");
        setMsg(data.message || "Waiting for confirmations…");
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      setPhase("error");
      setMsg(data.error || "Verification failed");
      return;
    }
    setPhase("error");
    setMsg("Timed out waiting for confirmations — your tx is safe, try again shortly.");
  };

  const pay = async () => {
    if (!DEPOSIT_ADDRESS) return;
    if (!isConnected || !walletProvider) {
      open();
      return;
    }
    setMsg("");
    setCredits(null);
    try {
      const provider = new ethers.BrowserProvider(
        walletProvider as Eip1193Provider
      );
      const signer = await provider.getSigner();

      setPhase("sending");
      setMsg("Confirm the transaction in your wallet…");
      const tx = await signer.sendTransaction({
        to: DEPOSIT_ADDRESS,
        value: ethers.parseEther(String(amountNum)),
      });
      await tx.wait(1);

      setPhase("verifying");
      setMsg("Sign to confirm the deposit…");
      const signature = await signer.signMessage(depositMessage(tx.hash));

      setMsg("Verifying on 0G…");
      await verifyLoop(tx.hash, await signer.getAddress(), signature);
    } catch (e) {
      setPhase("error");
      setMsg((e as Error).message);
    }
  };

  if (!APPKIT_READY || !DEPOSIT_ADDRESS) {
    return (
      <div className="rounded-xl border border-border bg-background p-4 text-[13px] text-text-secondary">
        Pay with 0G isn&apos;t fully configured yet. Set{" "}
        <code className="text-foreground">NEXT_PUBLIC_REOWN_PROJECT_ID</code>,{" "}
        <code className="text-foreground">DEPOSIT_WALLET_ADDRESS</code> and{" "}
        <code className="text-foreground">NEXT_PUBLIC_DEPOSIT_WALLET_ADDRESS</code>.
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-5 w-5" />
        </div>
        <p className="text-[15px] font-semibold text-foreground">
          {credits?.toLocaleString()} credits added
        </p>
        <p className="mt-1 text-[12px] text-text-secondary">
          Paid with 0G · verified on-chain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-secondary">Wallet</span>
          {mounted && isConnected && address ? (
            <button
              onClick={() => open({ view: "Account" })}
              className="press inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {short(address)}
            </button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => open()}>
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Connect wallet
            </Button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px] text-text-tertiary">
          <span>Deposit address</span>
          <span className="font-mono">{short(DEPOSIT_ADDRESS)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-medium text-text-secondary">
          Amount (0G)
        </label>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
        />
        <p className="text-[11px] text-text-tertiary">
          Credited at the live 0G/USD price · 1,000 credits = $1.
        </p>
      </div>

      <Button className="w-full" onClick={pay} disabled={amountNum <= 0 || busy}>
        {busy ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            {phase === "sending"
              ? "Sending…"
              : phase === "pending"
                ? "Confirming…"
                : "Verifying…"}
          </>
        ) : mounted && isConnected ? (
          <>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Pay {amountNum > 0 ? amountNum : ""} 0G
          </>
        ) : (
          <>
            <Wallet className="mr-1.5 h-4 w-4" />
            Connect wallet to pay
          </>
        )}
      </Button>

      {msg && (
        <p
          className={
            phase === "error"
              ? "flex items-start gap-1.5 text-[12px] text-error"
              : "text-[12px] text-text-tertiary"
          }
        >
          {phase === "error" && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {msg}
        </p>
      )}
    </div>
  );
}
