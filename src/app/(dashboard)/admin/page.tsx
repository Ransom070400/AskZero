"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquare,
  CreditCard,
  Coins,
  Wallet,
  Copy,
  ExternalLink,
  Check,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  totalChats: number;
  totalMessages: number;
  totalDeposits: number;
  totalCreditsDeposited: number;
  totalRevenueUsd: string;
  totalUsageCredits: number;
  totalUsageUsd: string;
}

interface Treasury {
  address: string;
  balance: string;
}

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(async (res) => {
        if (!res.ok) {
          setError(res.status === 403 ? "Access denied" : "Failed to load");
          return;
        }
        const data = await res.json();
        setStats(data.stats);
        setTreasury(data.treasury);
        setTransactions(data.recentTransactions);
      })
      .catch(() => setError("Failed to load"));
  }, []);

  const copyAddress = () => {
    if (!treasury?.address) return;
    navigator.clipboard.writeText(treasury.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-5 py-12">
        <div className="text-center space-y-2">
          <AlertTriangle className="mx-auto h-8 w-8 text-text-tertiary" />
          <p className="text-[14px] text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center px-5 py-12">
        <p className="text-[14px] text-text-tertiary">Loading…</p>
      </div>
    );
  }

  const balanceNum = parseFloat(treasury?.balance || "0");
  const isLowBalance = balanceNum < 5;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 md:px-6 py-8 md:py-12 space-y-9">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.025em]">
          Admin
        </h1>
        <p className="text-[15px] text-text-secondary">
          Key metrics, treasury, and recent activity.
        </p>
      </div>

      {/* Treasury hero */}
      {treasury?.address && (
        <section
          className={cn(
            "overflow-hidden rounded-3xl border bg-gradient-to-br from-elevated to-surface p-6 md:p-8 shadow-md",
            isLowBalance ? "border-warning/30" : "border-border/70"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-muted">
                <Wallet className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Treasury wallet
                </p>
                <p className="text-[12px] text-text-tertiary leading-snug">
                  Pays 0G providers for inference
                </p>
              </div>
            </div>
            {isLowBalance && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
                <AlertTriangle className="h-3 w-3" />
                Low balance
              </span>
            )}
          </div>

          <div className="mt-5 flex items-end gap-3">
            <p className="font-display text-4xl md:text-5xl font-bold tracking-[-0.03em] tabular-nums">
              {parseFloat(treasury.balance).toFixed(4)}
            </p>
            <p className="pb-1.5 text-[14px] font-semibold text-text-tertiary">
              0G
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Address
            </p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-[12px] font-mono text-foreground break-all">
                {treasury.address}
              </code>
              <button
                onClick={copyAddress}
                aria-label="Copy address"
                className="press shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background text-text-secondary transition-[border-color,color] duration-fast ease-out hover:border-border-strong hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const base =
                  process.env.NEXT_PUBLIC_ZERO_G_EXPLORER_URL?.replace(
                    /\/+$/,
                    ""
                  );
                if (!base) return;
                window.open(`${base}/address/${treasury.address}`, "_blank");
              }}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Explorer
            </Button>
          </div>

          {isLowBalance && (
            <p className="mt-4 text-[12px] leading-relaxed text-warning">
              Treasury balance is low. Send more 0G to the address above to keep
              AI inference running.
            </p>
          )}
        </section>
      )}

      {/* Stats grid */}
      <section className="space-y-3">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          Metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Users"
            icon={<Users className="h-4 w-4" />}
            value={stats.totalUsers.toLocaleString()}
          />
          <StatCard
            label="Messages"
            icon={<MessageSquare className="h-4 w-4" />}
            value={stats.totalMessages.toLocaleString()}
          />
          <StatCard
            label="Deposits"
            icon={<CreditCard className="h-4 w-4" />}
            value={stats.totalDeposits.toLocaleString()}
          />
          <StatCard
            label="Revenue"
            icon={<Coins className="h-4 w-4" />}
            value={`$${stats.totalRevenueUsd}`}
          />
          <StatCard
            label="Fiat used"
            icon={<TrendingDown className="h-4 w-4" />}
            value={`$${stats.totalUsageUsd}`}
            sub={`${stats.totalUsageCredits.toLocaleString()} credits`}
          />
        </div>
      </section>

      {/* Recent transactions */}
      <section className="space-y-3">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          Recent activity
        </h2>
        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-elevated/40 px-5 py-12 text-center">
            <p className="text-[13px] text-text-tertiary">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 divide-y divide-border/50">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  icon,
  value,
  sub,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-elevated/60 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
          {label}
        </p>
        <span className="text-text-tertiary">{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-text-tertiary tabular-nums">
          {sub}
        </p>
      )}
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isUsage = tx.type === "usage";
  const statusStyle =
    tx.status === "completed"
      ? "border-success/30 bg-success/10 text-success"
      : tx.status === "pending"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-error/30 bg-error/10 text-error";

  return (
    <div className="flex items-center justify-between gap-3 bg-elevated/40 px-4 py-3.5">
      <div className="flex min-w-0 flex-col">
        <p className="text-[13px] font-semibold capitalize text-foreground">
          {tx.type}
        </p>
        <p className="text-[11px] font-mono text-text-tertiary">
          {tx.user_id.slice(0, 8)}…
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            statusStyle
          )}
        >
          {tx.status}
        </span>
        <p
          className={cn(
            "text-[13px] font-semibold tabular-nums",
            isUsage ? "text-text-secondary" : "text-foreground"
          )}
        >
          {isUsage ? "−" : "+"}
          {Math.abs(tx.amount).toLocaleString()}
        </p>
        <p className="hidden sm:block text-[11px] text-text-tertiary tabular-nums">
          {new Date(tx.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
