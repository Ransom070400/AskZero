"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  USD_TO_CREDITS_RATE,
  formatCredits,
  formatCurrency,
  getPresets,
} from "@/lib/pricing";
import {
  APAC_CURRENCIES,
  APAC_CODES,
  type ApacCurrency,
  apacToCredits,
  formatApacCurrency,
} from "@/lib/pricing-apac";

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
  type DepositCurrency = "NGN" | "USD" | ApacCurrency;
  const [currency, setCurrency] = useState<DepositCurrency>("NGN");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ngnRate, setNgnRate] = useState(1500);
  const { formatBalance: formatBal } = useCurrency();

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => {
        if (data.rate) setNgnRate(data.rate);
      })
      .catch(() => {});
  }, []);

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

  const verifiedRef = useRef(false);
  useEffect(() => {
    if (verifiedRef.current) return;

    const reference = searchParams.get("reference");
    const stripeRef = searchParams.get("stripe_ref");
    const sessionId = searchParams.get("session_id");

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
          window.history.replaceState({}, "", "/deposit");
        });
    } else if (stripeRef && sessionId) {
      verifiedRef.current = true;
      fetch(`/api/deposit/stripe/verify?session_id=${encodeURIComponent(sessionId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "completed") {
            setSuccessMessage(
              `Payment successful! ${data.credits ? formatCredits(data.credits) + " credits added." : "Credits added."}`
            );
          } else {
            setSuccessMessage("Payment received! Credits will be added shortly.");
          }
          fetchData();
          window.history.replaceState({}, "", "/deposit");
        })
        .catch(() => {
          setSuccessMessage("Payment received! Credits will be added shortly.");
          fetchData();
          window.history.replaceState({}, "", "/deposit");
        });
    } else if (stripeRef) {
      verifiedRef.current = true;
      setSuccessMessage("Payment received! Credits will be added shortly.");
      fetchData();
      window.history.replaceState({}, "", "/deposit");
    }
  }, [searchParams, fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isApac = (c: DepositCurrency): c is ApacCurrency =>
    c !== "NGN" && c !== "USD";

  const currencySymbol = (c: DepositCurrency): string =>
    c === "NGN" ? "₦" : c === "USD" ? "$" : APAC_CURRENCIES[c].symbol;

  const formatAny = (value: number, c: DepositCurrency): string =>
    isApac(c) ? formatApacCurrency(value, c) : formatCurrency(value, c);

  const presetsAny = (c: DepositCurrency): number[] =>
    isApac(c) ? APAC_CURRENCIES[c].presets : getPresets(c);

  const handleFiatDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    setLoading(true);
    try {
      if (currency === "NGN") {
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
      } else {
        const res = await fetch("/api/deposit/stripe", {
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
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      alert("Failed to initialize payment");
      setLoading(false);
    }
  };

  const numericAmount = parseFloat(amount) || 0;
  const estimatedCredits = (() => {
    if (numericAmount <= 0) return 0;
    if (currency === "NGN") {
      return Math.floor((numericAmount / ngnRate) * USD_TO_CREDITS_RATE);
    }
    if (currency === "USD") {
      return Math.floor(numericAmount * USD_TO_CREDITS_RATE);
    }
    return apacToCredits(numericAmount, currency);
  })();

  return (
    <div className="mx-auto w-full max-w-form px-5 md:px-6 py-8 md:py-12 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.025em]">
          Add credits
        </h1>
        <p className="text-[15px] text-text-secondary">
          Top up to keep chatting. No subscription, pay only for what you use.
        </p>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="text-[14px] font-medium leading-relaxed text-success">
            {successMessage}
          </p>
        </div>
      )}

      {/* Balance hero */}
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-elevated to-surface p-6 md:p-8 shadow-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          Current balance
        </p>
        <div className="mt-2 flex items-end gap-3">
          <p className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] tabular-nums">
            {balance !== null ? formatBal(balance) : "—"}
          </p>
          {balance !== null && (
            <p className="pb-1.5 text-[13px] font-medium text-text-tertiary tabular-nums">
              {formatCredits(balance)} credits
            </p>
          )}
        </div>
      </div>

      {/* Currency selector */}
      <section className="space-y-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          Pay with
        </h2>
        <div className="inline-flex w-full rounded-2xl border border-border/70 bg-elevated/60 p-1">
          <CurrencyTab
            label="₦ Naira"
            active={currency === "NGN"}
            onClick={() => {
              setCurrency("NGN");
              setAmount("");
            }}
          />
          <CurrencyTab
            label="$ USD"
            active={currency === "USD"}
            onClick={() => {
              setCurrency("USD");
              setAmount("");
            }}
          />
          <CurrencyTab
            label="APAC"
            active={isApac(currency)}
            onClick={() => {
              if (!isApac(currency)) setCurrency("JPY");
              setAmount("");
            }}
          />
        </div>

        {isApac(currency) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="press group flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-4 text-[14px] font-medium text-foreground transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong">
                <span className="flex items-center gap-2">
                  <span className="text-text-tertiary">
                    {APAC_CURRENCIES[currency].symbol}
                  </span>
                  <span>
                    {APAC_CURRENCIES[currency].code} —{" "}
                    {APAC_CURRENCIES[currency].label}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-text-tertiary group-hover:text-foreground transition-colors duration-fast" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
              {APAC_CODES.map((code) => {
                const m = APAC_CURRENCIES[code];
                return (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => {
                      setCurrency(code);
                      setAmount("");
                    }}
                  >
                    <span className="w-7 text-text-tertiary">{m.symbol}</span>
                    <span className="font-semibold">{m.code}</span>
                    <span className="ml-2 text-text-secondary truncate">
                      {m.label}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </section>

      {/* Amount */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Amount
          </h2>
          {estimatedCredits > 0 && (
            <p className="text-[12px] font-medium text-text-tertiary tabular-nums">
              <Sparkles className="inline h-3 w-3 -mt-0.5 mr-1 text-accent" />
              {formatCredits(estimatedCredits)} credits
            </p>
          )}
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-semibold text-text-tertiary">
            {currencySymbol(currency)}
          </span>
          <Input
            id="fiat-amount"
            type="number"
            placeholder="0.00"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 pl-10 text-[20px] font-semibold tracking-tight tabular-nums"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {presetsAny(currency).map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              className={cn(
                "press rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-[border-color,background-color,color] duration-fast ease-out",
                amount === String(preset)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-elevated/60 text-text-secondary hover:border-border-strong hover:text-foreground"
              )}
            >
              {formatAny(preset, currency)}
            </button>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={numericAmount <= 0 || loading}
          onClick={handleFiatDeposit}
        >
          {loading
            ? "Processing…"
            : `Fund account${numericAmount > 0 ? ` · ${formatAny(numericAmount, currency)}` : ""}`}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-text-tertiary">
          <ShieldCheck className="h-3 w-3" />
          Payments secured by Paystack · funds custodied on-chain
        </p>
      </section>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Recent activity
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border/70 divide-y divide-border/50">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CurrencyTab({
  label,
  active,
  onClick,
  comingSoon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={comingSoon}
      aria-disabled={comingSoon || undefined}
      title={comingSoon ? "Coming soon" : undefined}
      className={cn(
        "press flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-fast ease-out",
        comingSoon
          ? "cursor-not-allowed text-text-tertiary/60"
          : active
            ? "bg-background text-foreground shadow-sm"
            : "text-text-tertiary hover:text-foreground"
      )}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {label}
        {comingSoon && (
          <span className="rounded-full border border-border/70 bg-elevated/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
            Soon
          </span>
        )}
      </span>
    </button>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isUsage = tx.type === "usage";
  const status = tx.status;
  const StatusIcon =
    status === "completed"
      ? CheckCircle2
      : status === "pending"
        ? Clock
        : XCircle;
  const statusColor =
    status === "completed"
      ? "text-success"
      : status === "pending"
        ? "text-warning"
        : "text-error";

  return (
    <div className="flex items-center justify-between gap-3 bg-elevated/40 px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <StatusIcon className={cn("h-4 w-4 shrink-0", statusColor)} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold capitalize text-foreground">
            {tx.type}
          </p>
          <p className="text-[11px] text-text-tertiary">
            {new Date(tx.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "text-[13px] font-semibold tabular-nums",
            isUsage ? "text-text-secondary" : "text-foreground"
          )}
        >
          {isUsage ? "−" : "+"}
          {formatCredits(Math.abs(tx.amount))} credits
        </p>
        {tx.original_amount > 0 && (
          <p className="text-[11px] text-text-tertiary tabular-nums">
            {tx.currency === "NGN" || tx.currency === "USD"
              ? formatCurrency(tx.original_amount, tx.currency)
              : APAC_CODES.includes(tx.currency as ApacCurrency)
                ? formatApacCurrency(
                    tx.original_amount,
                    tx.currency as ApacCurrency
                  )
                : `${tx.original_amount} ${tx.currency}`}
          </p>
        )}
      </div>
    </div>
  );
}
