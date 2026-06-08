import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Add admin emails here
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // These are platform-wide aggregates, so they must run with the
  // service-role client. The RLS policies scope every table to the caller's
  // own rows (profiles: auth.uid() = id, transactions: auth.uid() = user_id,
  // …), so querying with the user-context client above silently returns only
  // the admin's own data — which is why the dashboard totals read as ~1 user
  // / a handful of messages. The admin identity is already verified above.
  const db = createAdminClient();

  // Fetch stats. "Messages" counts user turns only (questions asked) rather
  // than user + assistant rows, which would roughly double the figure.
  // Revenue/Deposits count real paid deposits only — signup bonuses are
  // recorded under the separate 'bonus' type so they never inflate revenue.
  const [usersRes, chatsRes, messagesRes, transactionsRes, revenueRes, usageRes] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("chats").select("id", { count: "exact", head: true }),
      db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("role", "user"),
      db
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("type", "deposit")
        .eq("status", "completed"),
      db
        .from("transactions")
        .select("amount")
        .eq("type", "deposit")
        .eq("status", "completed"),
      db
        .from("transactions")
        .select("amount")
        .eq("type", "usage")
        .eq("status", "completed"),
    ]);

  const totalRevenue =
    revenueRes.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Usage amounts are stored as negative values
  const totalUsageCredits =
    usageRes.data?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

  // Recent transactions (all users — service-role client bypasses RLS)
  const { data: recentTx } = await db
    .from("transactions")
    .select("id, user_id, type, amount, currency, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // Treasury wallet balance
  let treasuryBalance = "0";
  let treasuryAddress = "";
  try {
    const rpcUrl =
      process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ??
      process.env.ZERO_G_CHAIN_RPC_URL;
    const privateKey = process.env.ZERO_G_PRIVATE_KEY;
    if (rpcUrl && privateKey) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      treasuryAddress = wallet.address;
      const bal = await provider.getBalance(wallet.address);
      treasuryBalance = ethers.formatEther(bal);
    }
  } catch {
    // Treasury balance unavailable
  }

  return NextResponse.json({
    stats: {
      totalUsers: usersRes.count || 0,
      totalChats: chatsRes.count || 0,
      totalMessages: messagesRes.count || 0,
      totalDeposits: transactionsRes.count || 0,
      totalCreditsDeposited: totalRevenue,
      totalRevenueUsd: (totalRevenue / 1000).toFixed(2),
      totalUsageCredits,
      totalUsageUsd: (totalUsageCredits / 1000).toFixed(2),
    },
    treasury: {
      address: treasuryAddress,
      balance: treasuryBalance,
    },
    recentTransactions: recentTx || [],
  });
}
