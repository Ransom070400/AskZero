import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/server";

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

  // Fetch stats
  const [usersRes, chatsRes, messagesRes, transactionsRes, revenueRes] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("chats").select("id", { count: "exact", head: true }),
      supabase.from("messages").select("id", { count: "exact", head: true }),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("type", "deposit")
        .eq("status", "completed"),
      supabase
        .from("transactions")
        .select("amount")
        .eq("type", "deposit")
        .eq("status", "completed"),
    ]);

  const totalRevenue =
    revenueRes.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Recent transactions
  const { data: recentTx } = await supabase
    .from("transactions")
    .select("id, user_id, type, amount, currency, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // Treasury wallet balance
  let treasuryBalance = "0";
  let treasuryAddress = "";
  try {
    const rpcUrl = process.env.ZERO_G_CHAIN_RPC_URL || "https://evmrpc-testnet.0g.ai";
    const privateKey = process.env.ZERO_G_PRIVATE_KEY;
    if (privateKey) {
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
    },
    treasury: {
      address: treasuryAddress,
      balance: treasuryBalance,
    },
    recentTransactions: recentTx || [],
  });
}
