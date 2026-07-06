import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import {
  getOGTokenPrice,
  ogToCredits,
  REQUIRED_CONFIRMATIONS,
  depositMessage,
} from "@/lib/og-token";

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { txHash, address, signature } = (await req.json()) as {
    txHash?: string;
    address?: string;
    signature?: string;
  };

  if (!txHash || !address || !signature) {
    return NextResponse.json(
      { error: "Missing txHash, address, or signature" },
      { status: 400 }
    );
  }

  // 1) Prove the caller controls `address` (they signed for it).
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(depositMessage(txHash), signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { error: "Signature does not match wallet" },
      { status: 400 }
    );
  }

  // 2) Idempotency — a txHash can only ever be credited once.
  const { data: existing } = await supabase
    .from("transactions")
    .select("status")
    .eq("reference", txHash)
    .maybeSingle();
  if (existing?.status === "completed") {
    return NextResponse.json({ status: "completed", message: "Already credited" });
  }

  const rpcUrl = process.env.ZERO_G_CHAIN_RPC_URL || "https://evmrpc.0g.ai";
  const depositAddress = process.env.DEPOSIT_WALLET_ADDRESS;
  if (!depositAddress) {
    return NextResponse.json(
      { error: "Deposit address not configured" },
      { status: 500 }
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
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

  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 400 });
  }

  // 3) The tx must have been SENT BY the wallet the caller proved they own...
  if (tx.from.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { error: "Transaction was not sent from your wallet" },
      { status: 400 }
    );
  }
  // ...and sent TO the deposit address.
  if (tx.to?.toLowerCase() !== depositAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "Transaction was not sent to the deposit address" },
      { status: 400 }
    );
  }

  // 4) Enough confirmations.
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

  // 5) Credits from the on-chain value at the current 0G price.
  const ogAmount = Number(ethers.formatEther(tx.value));
  const ogPrice = await getOGTokenPrice();
  const credits = ogToCredits(ogAmount, ogPrice);
  if (credits <= 0) {
    return NextResponse.json({ error: "Deposit amount too small" }, { status: 400 });
  }

  if (existing) {
    await supabase
      .from("transactions")
      .update({ status: "completed", amount: credits })
      .eq("reference", txHash);
  } else {
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

  const { error: rpcError } = await supabase.rpc("credit_balance", {
    p_user_id: user.id,
    p_amount: credits,
  });
  if (rpcError) {
    return NextResponse.json({ error: "Failed to credit balance" }, { status: 500 });
  }

  return NextResponse.json({
    status: "completed",
    credits,
    ogAmount,
    ogPriceUsd: ogPrice,
  });
}
