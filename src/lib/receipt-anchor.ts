import { Contract, JsonRpcProvider, Wallet } from "ethers";
import abi from "../../contracts/ReceiptRegistry.abi.json";
import { createAdminClient } from "@/lib/supabase/admin";
import { merkleProof, merkleRoot } from "@/lib/receipts";

const MAX_BATCH = 256;

export interface AnchorResult {
  batched: number;
  txHash?: string;
  merkleRoot?: string;
  reason?: string;
}

interface PendingRow {
  id: string;
  receipt_hash: string;
  created_at: string;
}

export async function anchorPendingReceipts(): Promise<AnchorResult> {
  const rpcUrl = process.env.NEXT_PUBLIC_ZERO_G_RPC_URL;
  const chainIdStr = process.env.NEXT_PUBLIC_ZERO_G_CHAIN_ID;
  const registry = process.env.RECEIPT_REGISTRY_ADDRESS;
  const batcherKey = process.env.RECEIPT_BATCHER_PRIVATE_KEY;

  if (!rpcUrl || !chainIdStr || !registry || !batcherKey) {
    return { batched: 0, reason: "anchor env not configured" };
  }
  const chainId = Number(chainIdStr);

  const admin = createAdminClient();

  const { data: pending, error } = await admin
    .from("inference_receipts")
    .select("id, receipt_hash, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) throw error;
  if (!pending || pending.length === 0) {
    return { batched: 0, reason: "nothing pending" };
  }

  const rows = pending as PendingRow[];
  const leaves = rows.map((r) => r.receipt_hash);
  const root = merkleRoot(leaves);
  const fromTs = rows[0].created_at;
  const toTs = rows[rows.length - 1].created_at;

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(batcherKey, provider);
  const contract = new Contract(registry, abi, wallet);

  const fromUnix = Math.floor(new Date(fromTs).getTime() / 1000);
  const toUnix = Math.floor(new Date(toTs).getTime() / 1000);

  const tx = await contract.postRoot(root, leaves.length, fromUnix, toUnix);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("tx receipt missing");

  const { data: batch, error: batchErr } = await admin
    .from("receipt_batches")
    .insert({
      merkle_root: root,
      leaf_count: leaves.length,
      from_ts: fromTs,
      to_ts: toTs,
      chain_id: chainId,
      contract_addr: registry,
      tx_hash: receipt.hash,
      block_number: receipt.blockNumber,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (batchErr || !batch) throw batchErr ?? new Error("batch insert failed");

  for (let i = 0; i < rows.length; i++) {
    const proof = merkleProof(leaves, i);
    const { error: updErr } = await admin
      .from("inference_receipts")
      .update({
        status: "anchored",
        batch_id: batch.id,
        leaf_index: i,
        merkle_proof: proof,
      })
      .eq("id", rows[i].id);
    if (updErr) throw updErr;
  }

  return { batched: rows.length, txHash: receipt.hash, merkleRoot: root };
}
