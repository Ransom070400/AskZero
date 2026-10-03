import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOGTokenPrice,
  ogToCredits,
  REQUIRED_CONFIRMATIONS,
  depositMessage,
} from "@/lib/og-token";
import { zerogChain } from "@/lib/zerog-chains";

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

  // 2) Fast path for a txHash this user already credited. The real guarantee
  //    that a txHash is credited only once is complete_deposit below.
  const { data: existing } = await supabase
    .from("transactions")
    .select("status")
    .eq("reference", txHash)
    .maybeSingle();
  if (existing?.status === "completed") {
    return NextResponse.json({ status: "completed", message: "Already credited" });
  }

  // Verify on the SAME chain the client (AppKit) pays on — both derive from
  // NEXT_PUBLIC_ZERO_G_CHAIN_ID — so we never look for a mainnet tx on testnet.
  const depositChainId = Number(process.env.NEXT_PUBLIC_ZERO_G_CHAIN_ID ?? "16661");
  const rpcUrl = zerogChain(depositChainId).rpc;
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
    // Not visible yet on our RPC (propagation lag) — tell the client to keep
    // polling rather than hard-failing.
    return NextResponse.json(
      { status: "pending", message: "Transaction not visible on-chain yet — waiting…" },
      { status: 202 }
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

  // Create the deposit row once, then credit it atomically. reference is
  // unique, so concurrent requests for the same txHash all land on one row,
  // and complete_deposit only flips a pending row once — exactly one caller
  // credits. Both writes are service-role only.
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("transactions").upsert(
    {
      user_id: user.id,
      type: "deposit",
      amount: 0,
      currency: "0G",
      original_amount: ogAmount,
      reference: txHash,
      status: "pending",
      metadata: {
        payment_provider: "0g_chain",
        og_price_usd: ogPrice,
        confirmations,
        from_address: tx.from,
      },
    },
    { onConflict: "reference", ignoreDuplicates: true }
  );
  if (insertError) {
    return NextResponse.json({ error: "Failed to record deposit" }, { status: 500 });
  }

  const { data: result, error: rpcError } = await admin.rpc("complete_deposit", {
    p_reference: txHash,
    p_credits: credits,
  });
  if (rpcError) {
    return NextResponse.json({ error: "Failed to credit balance" }, { status: 500 });
  }
  if ((result as { credited?: boolean })?.credited !== true) {
    return NextResponse.json({ status: "completed", message: "Already credited" });
  }

  return NextResponse.json({
    status: "completed",
    credits,
    ogAmount,
    ogPriceUsd: ogPrice,
  });
}
