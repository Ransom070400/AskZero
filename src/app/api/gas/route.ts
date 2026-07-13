import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { txUrl } from "@/lib/zerog-chains";

export const dynamic = "force-dynamic";

const CLAIM_AMOUNT = "0.001"; // 0G, fixed server-side — never trust the client
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_ZERO_G_CHAIN_ID) || 16661;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw = String(body.address ?? "").trim();

  if (!ethers.isAddress(raw)) {
    return json({ error: "Enter a valid 0G wallet address (0x…)." }, 400);
  }
  const address = ethers.getAddress(raw); // normalize to checksum

  // Best-effort IP for rate-limiting + abuse triage.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const { ok } = rateLimit(`gas:${ip}`, 5); // 5/min per IP
  if (!ok) return rateLimitResponse();

  const rpcUrl =
    process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ?? process.env.ZERO_G_CHAIN_RPC_URL;
  const pk = process.env.GAS_FAUCET_PRIVATE_KEY ?? process.env.ZERO_G_PRIVATE_KEY;
  if (!rpcUrl || !pk) {
    return json({ error: "The faucet isn't configured yet." }, 503);
  }

  const db = createAdminClient();

  // Already claimed? One payout per wallet, ever.
  const { data: existing } = await db
    .from("gas_claims")
    .select("tx_hash")
    .eq("address", address)
    .maybeSingle();
  if (existing) {
    return json(
      {
        error: "This wallet has already claimed its gas.",
        alreadyClaimed: true,
        txHash: existing.tx_hash ?? null,
        explorerUrl: existing.tx_hash ? txUrl(CHAIN_ID, existing.tx_hash) : null,
      },
      409
    );
  }

  // Reserve first — the unique(address) constraint makes concurrent double
  // claims impossible; a race loser hits this insert error and is rejected.
  const { error: insErr } = await db
    .from("gas_claims")
    .insert({ address, ip, amount: Number(CLAIM_AMOUNT) });
  if (insErr) {
    // 23505 = unique_violation → a genuine concurrent double-claim. Anything
    // else (table missing, DB down) is our problem, not "already claimed".
    if (insErr.code === "23505") {
      return json(
        { error: "This wallet has already claimed its gas.", alreadyClaimed: true },
        409
      );
    }
    console.error("gas_claims insert failed", insErr);
    return json(
      { error: "The faucet isn't ready yet. Please try again shortly." },
      503
    );
  }

  // Send the gas.
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(pk, provider);
    const tx = await wallet.sendTransaction({
      to: address,
      value: ethers.parseEther(CLAIM_AMOUNT),
    });
    await db.from("gas_claims").update({ tx_hash: tx.hash }).eq("address", address);
    return json({
      txHash: tx.hash,
      explorerUrl: txUrl(CHAIN_ID, tx.hash),
      amount: CLAIM_AMOUNT,
    });
  } catch (e) {
    // Roll back the reservation (only if we never sent) so they can retry.
    await db.from("gas_claims").delete().eq("address", address).is("tx_hash", null);
    console.error("gas faucet send failed", e);
    return json(
      { error: "Couldn't send gas right now. Please try again in a moment." },
      502
    );
  }
}
