"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Wallet, CheckCircle, Clock, XCircle } from "lucide-react";
import {
  convertToCredits,
  formatCredits,
  formatCurrency,
  getPresets,
} from "@/lib/pricing";

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
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { formatBalance: formatBal } = useCurrency();

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

  // Handle payment redirects (run once, then clear URL)
  const verifiedRef = useRef(false);
  useEffect(() => {
    if (verifiedRef.current) return;

    const reference = searchParams.get("reference");
    const stripeRef = searchParams.get("stripe_ref");

    if (reference) {
      verifiedRef.current = true;
      fetch(`/api/deposit/verify/${reference}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "completed") {
            setSuccessMessage(
              `Payment successful! ${data.credits ? formatCredits(data.credits) + " credits added." : "Credits added."}`
            );
            fetchData();
          }
          // Clear URL params
          window.history.replaceState({}, "", "/deposit");
        });
    } else if (stripeRef) {
      verifiedRef.current = true;
      setSuccessMessage("Payment received! Credits will be added shortly.");
      fetchData();
      window.history.replaceState({}, "", "/deposit");
    }
  }, [searchParams, fetchData]);

  // Poll balance updates
  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleFiatDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    setLoading(true);
    try {
      if (currency === "USD") {
        // Stripe for USD
        const res = await fetch("/api/deposit/stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: numAmount }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to initialize payment");
          setLoading(false);
          return;
        }
        const { url } = await res.json();
        window.location.href = url;
      } else {
        // Paystack for NGN
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
      }
    } catch {
      alert("Failed to initialize payment");
      setLoading(false);
    }
  };

  const numericAmount = parseFloat(amount) || 0;
  const estimatedCredits =
    numericAmount > 0 ? convertToCredits(numericAmount, currency) : 0;

  return (
    <div className="mx-auto max-w-form space-y-5 md:space-y-6 px-4 md:px-6 py-4 md:py-6">
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
                ? `${formatBal(balance)} (${formatCredits(balance)} credits)`
                : "Loading..."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Currency */}
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

      {/* Amount */}
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
          {estimatedCredits > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatCurrency(numericAmount, currency)} ={" "}
              <span className="font-medium text-foreground">
                {formatCredits(estimatedCredits)} credits
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
                        {formatCurrency(
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
