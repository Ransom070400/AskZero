import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/server";
import { getOGTokenPrice, ogToCredits, REQUIRED_CONFIRMATIONS } from "@/lib/og-token";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { txHash } = await req.json();

  if (!txHash) {
    return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
  }

  // Check idempotency
  const { data: existing } = await supabase
    .from("transactions")
    .select("status")
    .eq("reference", txHash)
    .single();

  if (existing?.status === "completed") {
    return NextResponse.json({
      status: "completed",
      message: "Already credited",
    });
  }

  // Verify on-chain
  const rpcUrl =
    process.env.ZERO_G_CHAIN_RPC_URL || "https://evmrpc-testnet.0g.ai";
  const depositAddress = process.env.DEPOSIT_WALLET_ADDRESS;

  if (!depositAddress) {
    return NextResponse.json(
      { error: "Deposit address not configured" },
      { status: 500 }
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let receipt;
  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 400 }
    );
  }

  if (!receipt) {
    return NextResponse.json(
      { error: "Transaction not found or pending" },
      { status: 400 }
    );
  }

  if (receipt.status !== 1) {
    return NextResponse.json(
      { error: "Transaction failed on-chain" },
      { status: 400 }
    );
  }

  // Verify recipient
  const tx = await provider.getTransaction(txHash);
  if (!tx || tx.to?.toLowerCase() !== depositAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "Transaction not sent to deposit address" },
      { status: 400 }
    );
  }

  // Check confirmations
  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber;
  if (confirmations < REQUIRED_CONFIRMATIONS) {
    return NextResponse.json(
      {
        status: "pending",
        message: `Waiting for confirmations (${confirmations}/${REQUIRED_CONFIRMATIONS})`,
        confirmations,
        required: REQUIRED_CONFIRMATIONS,
      },
      { status: 202 }
    );
  }

  // Calculate credits
  const ogAmount = Number(ethers.formatEther(tx.value));
  const ogPrice = await getOGTokenPrice();
  const credits = ogToCredits(ogAmount, ogPrice);

  if (credits <= 0) {
    return NextResponse.json(
      { error: "Deposit amount too small" },
      { status: 400 }
    );
  }

  // Create or update transaction
  if (existing) {
    // Update pending transaction
    await supabase
      .from("transactions")
      .update({ status: "completed", amount: credits })
      .eq("reference", txHash);
  } else {
    // Insert new transaction
    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount: credits,
      currency: "0G",
      original_amount: ogAmount,
      reference: txHash,
      status: "completed",
      metadata: {
        payment_provider: "0g_chain",
        og_price_usd: ogPrice,
        confirmations,
        from_address: tx.from,
      },
    });
  }

  // Credit balance
  const { error: rpcError } = await supabase.rpc("credit_balance", {
    p_user_id: user.id,
    p_amount: credits,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: "Failed to credit balance" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "completed",
    credits,
    ogAmount,
    ogPriceUsd: ogPrice,
  });
}
