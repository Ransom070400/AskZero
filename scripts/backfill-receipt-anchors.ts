/**
 * Reconcile receipt_batches against what is actually anchored on-chain.
 *
 * Run with: npx tsx scripts/backfill-receipt-anchors.ts [--apply]
 *
 * Dry-run by default — prints the plan and changes nothing. Pass --apply to
 * write.
 *
 * Why this exists: `chain_id`, the RPC URL and `RECEIPT_REGISTRY_ADDRESS` were
 * three independent env vars, so they could (and did) drift apart. Two distinct
 * failures came out of that:
 *
 *   1. MISLABELLED — the root really is anchored, but on the other chain. The
 *      verifier reads `chain_id` to pick its RPC, looks on the wrong chain and
 *      finds nothing. Fixed by correcting `chain_id`; the anchor itself is fine.
 *
 *   2. NEVER ANCHORED — `postRoot` was sent to an address with no code on that
 *      chain. A call to a codeless address succeeds and does nothing, so the tx
 *      mined, emitted no event, stored no root, and the batch was still recorded
 *      as `confirmed`. Unrecoverable: the receipts have to be re-anchored, so
 *      they go back to `pending` for the next cron run.
 *
 * Truth here is `isAnchored(root)` read from the chain — never the DB.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { Contract, JsonRpcProvider } from "ethers";
import { createClient } from "@supabase/supabase-js";

const ZEROG_CHAINS: Record<number, { name: string; rpc: string }> = {
  16661: { name: "0G Mainnet", rpc: "https://evmrpc.0g.ai" },
  16602: { name: "0G Galileo Testnet", rpc: "https://evmrpc-testnet.0g.ai" },
};

const REGISTRY_ABI = ["function isAnchored(bytes32 root) view returns (bool)"];

interface BatchRow {
  id: string;
  merkle_root: string;
  contract_addr: string;
  chain_id: number;
  leaf_count: number;
  tx_hash: string | null;
  status: string;
  created_at: string;
}

const APPLY = process.argv.includes("--apply");

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const providers = new Map<number, JsonRpcProvider>();
function providerFor(chainId: number): JsonRpcProvider {
  let p = providers.get(chainId);
  if (!p) {
    p = new JsonRpcProvider(ZEROG_CHAINS[chainId].rpc);
    providers.set(chainId, p);
  }
  return p;
}

// Cache getCode per (chain, address) — the same handful of registries repeat
// across every batch.
const codeCache = new Map<string, boolean>();
async function hasCode(chainId: number, addr: string): Promise<boolean> {
  const key = `${chainId}:${addr.toLowerCase()}`;
  const cached = codeCache.get(key);
  if (cached !== undefined) return cached;
  let present = false;
  try {
    present = (await providerFor(chainId).getCode(addr)) !== "0x";
  } catch {
    present = false;
  }
  codeCache.set(key, present);
  return present;
}

// Which chain, if any, actually holds this root at this registry address?
async function findAnchorChain(
  addr: string,
  root: string
): Promise<number | null> {
  for (const chainId of Object.keys(ZEROG_CHAINS).map(Number)) {
    if (!(await hasCode(chainId, addr))) continue;
    try {
      const registry = new Contract(addr, REGISTRY_ABI, providerFor(chainId));
      if (await registry.isAnchored(root)) return chainId;
    } catch {
      // Not a registry / RPC hiccup — treat as "not here".
    }
  }
  return null;
}

async function main() {
  const supabase = db();

  const { data, error } = await supabase
    .from("receipt_batches")
    .select("id, merkle_root, contract_addr, chain_id, leaf_count, tx_hash, status, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const batches = (data ?? []) as BatchRow[];

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — checking ${batches.length} batches against chain state\n`
  );

  const ok: BatchRow[] = [];
  const relabel: { batch: BatchRow; actualChain: number }[] = [];
  const orphaned: BatchRow[] = [];

  for (const batch of batches) {
    const actualChain = await findAnchorChain(batch.contract_addr, batch.merkle_root);
    const when = batch.created_at.slice(0, 16).replace("T", " ");

    if (actualChain === null) {
      orphaned.push(batch);
      console.log(
        `  ✗ ${when}  NOT ANCHORED anywhere — ${batch.leaf_count} receipt(s) ` +
          `(labelled ${batch.chain_id} @ ${batch.contract_addr})`
      );
    } else if (actualChain !== batch.chain_id) {
      relabel.push({ batch, actualChain });
      console.log(
        `  ~ ${when}  MISLABELLED ${batch.chain_id} → ${actualChain} ` +
          `(${ZEROG_CHAINS[actualChain].name}) — ${batch.leaf_count} receipt(s)`
      );
    } else {
      ok.push(batch);
    }
  }

  const relabelReceipts = relabel.reduce((n, r) => n + r.batch.leaf_count, 0);
  const orphanReceipts = orphaned.reduce((n, b) => n + b.leaf_count, 0);
  const okReceipts = ok.reduce((n, b) => n + b.leaf_count, 0);

  console.log(`\n  ✓ ${ok.length} batches already correct (${okReceipts} receipts)`);
  console.log(`  ~ ${relabel.length} batches to relabel (${relabelReceipts} receipts)`);
  console.log(`  ✗ ${orphaned.length} batches to re-anchor (${orphanReceipts} receipts)`);

  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply to fix.");
    return;
  }

  // --- 1) Relabel: the anchor is real, only chain_id was wrong. ---
  for (const { batch, actualChain } of relabel) {
    const { error: err } = await supabase
      .from("receipt_batches")
      .update({ chain_id: actualChain })
      .eq("id", batch.id);
    if (err) throw err;
  }
  if (relabel.length) {
    console.log(`\nRelabelled ${relabel.length} batches to their real chain.`);
  }

  // --- 2) Orphans: nothing was ever anchored, so re-queue the receipts. ---
  // Release the receipts BEFORE failing the batch, so a crash in between leaves
  // receipts pointing at a batch still marked confirmed (recoverable) rather
  // than orphaned against a failed one.
  for (const batch of orphaned) {
    const { error: relErr } = await supabase
      .from("inference_receipts")
      .update({
        status: "pending",
        batch_id: null,
        leaf_index: null,
        merkle_proof: null,
      })
      .eq("batch_id", batch.id);
    if (relErr) throw relErr;

    const { error: batchErr } = await supabase
      .from("receipt_batches")
      .update({ status: "failed", confirmed_at: null })
      .eq("id", batch.id);
    if (batchErr) throw batchErr;
  }
  if (orphaned.length) {
    console.log(
      `Re-queued ${orphanReceipts} receipts from ${orphaned.length} never-anchored ` +
        `batches; they will be re-anchored on the next cron run.`
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
