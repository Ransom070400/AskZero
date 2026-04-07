"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

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
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const balanceNum = parseFloat(treasury?.balance || "0");
  const isLowBalance = balanceNum < 5;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Key metrics and activity</p>
      </div>

      <Separator />

      {/* Treasury */}
      {treasury?.address && (
        <Card className={isLowBalance ? "border-yellow-500/50" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Treasury Wallet</CardTitle>
              </div>
              {isLowBalance && (
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500">
                  Low balance
                </span>
              )}
            </div>
            <CardDescription>
              Backend wallet used to pay 0G providers for AI inference
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-3xl font-bold">
                  {parseFloat(treasury.balance).toFixed(4)} 0G
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                  {treasury.address}
                </code>
                <Button variant="outline" size="icon" onClick={copyAddress}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  window.open(
                    `https://chainscan-newton.0g.ai/address/${treasury.address}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on explorer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  window.open("https://faucet.0g.ai", "_blank")
                }
              >
                <Coins className="h-3.5 w-3.5" />
                Get testnet tokens
              </Button>
            </div>

            {isLowBalance && (
              <p className="text-xs text-yellow-500">
                Treasury balance is low. Send more 0G to the address above to
                keep AI inference running.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalMessages}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deposits
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalDeposits}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.totalRevenueUsd}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fiat Used
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.totalUsageUsd}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalUsageCredits} credits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No transactions yet
              </p>
            )}
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border border-border/50 p-3 text-sm"
              >
                <div>
                  <span className="font-medium capitalize">{tx.type}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {tx.user_id.slice(0, 8)}...
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.status === "completed"
                        ? "bg-green-500/10 text-green-500"
                        : tx.status === "pending"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {tx.status}
                  </span>
                  <span className="font-medium">
                    {tx.type === "usage" ? "-" : "+"}
                    {Math.abs(tx.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
