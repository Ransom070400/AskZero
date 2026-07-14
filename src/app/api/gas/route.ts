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

// Cloudflare Turnstile — bot control that doesn't punish shared/carrier-NAT IPs
// (unlike a per-IP cap). Verified server-side; enforced only when configured so
// the faucet still runs before keys are set.
async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string
): Promise<boolean> {
  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (ip && ip !== "unknown") form.append("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
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

  // Bot control — reject non-humans before touching the DB or the wallet.
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = String(body.turnstileToken ?? "");
    if (!token) {
      return json({ error: "Please complete the bot check." }, 400);
    }
    if (!(await verifyTurnstile(turnstileSecret, token, ip))) {
      return json({ error: "Bot check failed — please try again." }, 403);
    }
  }

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
    // Record the hash up front so an in-flight payout is always traceable.
    await db.from("gas_claims").update({ tx_hash: tx.hash }).eq("address", address);

    // CRITICAL: wait for the tx to actually be MINED before calling it a win.
    // sendTransaction only broadcasts — a tx that is later dropped or replaced
    // (e.g. a nonce race against another sender on this wallet) would otherwise
    // be reported as a phantom success and the user would receive nothing while
    // being permanently blocked from re-claiming. wait() with a timeout resolves
    // that: only a real, status==1 receipt counts.
    const receipt = await tx.wait(1, 90_000).catch(() => null);
    if (!receipt || receipt.status !== 1) {
      throw new Error("payout not confirmed on-chain");
    }

    return json({
      txHash: tx.hash,
      explorerUrl: txUrl(CHAIN_ID, tx.hash),
      amount: CLAIM_AMOUNT,
    });
  } catch (e) {
    // Roll back the reservation so the user can claim again. We delete even when
    // a hash was recorded: the payout did not confirm, so the claim never
    // completed. (At 0.001 0G, the small risk that a timed-out tx confirms later
    // is far preferable to today's certainty of users getting nothing at all.)
    await db.from("gas_claims").delete().eq("address", address);
    console.error("gas faucet send failed", e);
    return json(
      { error: "That didn't go through — please try claiming again." },
      502
    );
  }
}
