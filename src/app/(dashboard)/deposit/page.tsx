"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Coins,
  Copy,
} from "lucide-react";
import {
  convertToCredits,
  formatCredits,
  formatCurrency,
  getPresets,
} from "@/lib/pricing";
import { ogToCredits } from "@/lib/og-token";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  original_amount: number;
  reference: string;
  status: string;
  created_at: string;
}

export default function DepositPage() {
  return (
    <Suspense>
      <DepositContent />
    </Suspense>
  );
}

function DepositContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"fiat" | "crypto">("fiat");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Crypto state
  const [ogPrice, setOgPrice] = useState<number>(0.01);
  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);

  const depositAddress =
    process.env.NEXT_PUBLIC_DEPOSIT_WALLET_ADDRESS || "";

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const balRes = await fetch("/api/balance");
    if (balRes.ok) {
      const { balance: bal } = await balRes.json();
      setBalance(bal);
    }

    const { data: txs } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (txs) setTransactions(txs);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch OG token price
  useEffect(() => {
    fetch("/api/deposit/price")
      .then((r) => r.json())
      .then((d) => setOgPrice(d.price))
      .catch(() => {});
  }, []);

  // Handle Paystack redirect
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (reference) {
      fetch(`/api/deposit/verify/${reference}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "completed") {
            setSuccessMessage(
              `Payment successful! ${data.credits ? formatCredits(data.credits) + " credits added." : "Credits added."}`
            );
            fetchData();
          }
        });
    }
  }, [searchParams, fetchData]);

  // Realtime balance
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    const supabase = createClient();
    const channelName = `deposit-balance-${Date.now()}`;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const newBalance = payload.new.credits_balance;
            if (newBalance !== undefined) setBalance(Number(newBalance));
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) createClient().removeChannel(channel);
    };
  }, []);

  const handleFiatDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/deposit/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, currency }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to initialize payment");
        setLoading(false);
        return;
      }
      const { authorization_url } = await res.json();
      window.location.href = authorization_url;
    } catch {
      alert("Failed to initialize payment");
      setLoading(false);
    }
  };

  const handleVerifyCrypto = async () => {
    if (!txHash.trim()) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/deposit/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: txHash.trim() }),
      });
      const data = await res.json();
      if (data.status === "completed") {
        setSuccessMessage(
          `Deposit confirmed! ${formatCredits(data.credits)} credits added.`
        );
        setTxHash("");
        fetchData();
      } else if (data.status === "pending") {
        setSuccessMessage(
          `Waiting for ${data.required - data.confirmations} more confirmations...`
        );
      } else {
        alert(data.error || "Verification failed");
      }
    } catch {
      alert("Verification failed");
    }
    setVerifying(false);
  };

  const numericAmount = parseFloat(amount) || 0;
  const estimatedFiatCredits =
    numericAmount > 0 ? convertToCredits(numericAmount, currency) : 0;

  const copyAddress = () => {
    navigator.clipboard.writeText(depositAddress);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deposit Funds</h1>
        <p className="text-muted-foreground">
          Add funds to your AskZero account
        </p>
      </div>

      <Separator />

      {successMessage && (
        <Card className="border-green-500/50 bg-green-500/10">
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-500">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Balance */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="rounded-full bg-primary/10 p-3">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold">
              {balance !== null
                ? `${formatCredits(balance)} credits ($${(balance / 1000).toFixed(2)})`
                : "Loading..."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        <Button
          variant={tab === "fiat" ? "default" : "outline"}
          onClick={() => setTab("fiat")}
          className="flex-1 gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Pay with Card
        </Button>
        <Button
          variant={tab === "crypto" ? "default" : "outline"}
          onClick={() => setTab("crypto")}
          className="flex-1 gap-2"
        >
          <Coins className="h-4 w-4" />
          Pay with 0G Token
        </Button>
      </div>

      {/* ====== FIAT TAB ====== */}
      {tab === "fiat" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Currency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={currency === "NGN" ? "default" : "outline"}
                  onClick={() => { setCurrency("NGN"); setAmount(""); }}
                  className="flex-1"
                >
                  ₦ Naira
                </Button>
                <Button
                  variant={currency === "USD" ? "default" : "outline"}
                  onClick={() => { setCurrency("USD"); setAmount(""); }}
                  className="flex-1"
                >
                  $ USD
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Amount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fiat-amount">
                  Amount ({currency === "NGN" ? "₦" : "$"})
                </Label>
                <Input
                  id="fiat-amount"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {getPresets(currency).map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(String(preset))}
                  >
                    {formatCurrency(preset, currency)}
                  </Button>
                ))}
              </div>
              {estimatedFiatCredits > 0 && (
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(numericAmount, currency)} ={" "}
                  <span className="font-medium text-foreground">
                    {formatCredits(estimatedFiatCredits)} credits
                  </span>
                </p>
              )}
              <Button
                className="w-full"
                disabled={numericAmount <= 0 || loading}
                onClick={handleFiatDeposit}
              >
                {loading
                  ? "Processing..."
                  : `Fund Account${numericAmount > 0 ? ` ${formatCurrency(numericAmount, currency)}` : ""}`}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* ====== CRYPTO TAB ====== */}
      {tab === "crypto" && (
        <Card>
          <CardHeader>
            <CardTitle>Deposit 0G Tokens</CardTitle>
            <CardDescription>
              Send A0GI tokens to the address below, then paste your transaction
              hash to verify
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {depositAddress ? (
              <>
                {/* Deposit address */}
                <div className="space-y-2">
                  <Label>Deposit Address</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                      {depositAddress}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyAddress}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="text-muted-foreground">
                    Current rate: 1 A0GI = ${ogPrice.toFixed(4)} USD ={" "}
                    {ogToCredits(1, ogPrice)} credits
                  </p>
                </div>

                <Separator />

                {/* Verify transaction */}
                <div className="space-y-2">
                  <Label htmlFor="tx-hash">Transaction Hash</Label>
                  <Input
                    id="tx-hash"
                    placeholder="0x..."
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={!txHash.trim() || verifying}
                  onClick={handleVerifyCrypto}
                >
                  {verifying ? "Verifying..." : "Verify Deposit"}
                </Button>
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                Crypto deposits are not configured yet. Please use card payment.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    {tx.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : tx.status === "pending" ? (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {tx.type}
                        {tx.currency === "0G" && " (0G Token)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}{" "}
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {tx.type === "usage" ? "-" : "+"}
                      {formatCredits(Math.abs(tx.amount))} credits
                    </p>
                    {tx.original_amount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {tx.currency === "0G"
                          ? `${tx.original_amount} A0GI`
                          : formatCurrency(
                              tx.original_amount,
                              tx.currency as "NGN" | "USD"
                            )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
