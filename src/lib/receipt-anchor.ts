import { Contract, Interface, JsonRpcProvider, Wallet } from "ethers";
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

  // Derive the chain from the connection we actually use, never from the env
  // label. `chain_id` is stamped onto every batch and is what the verifier uses
  // to pick its RPC and explorer, so if the label and the RPC ever disagree the
  // batch becomes unverifiable even though the root is genuinely on-chain.
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const labelledChainId = Number(chainIdStr);
  if (labelledChainId !== chainId) {
    console.warn(
      `anchor: NEXT_PUBLIC_ZERO_G_CHAIN_ID=${labelledChainId} but ${rpcUrl} is ` +
        `chain ${chainId} — recording the batch as ${chainId}.`
    );
  }

  // The registry must exist ON THIS CHAIN. A registry address left over from
  // another network is a plain address here, and `postRoot` against an address
  // with no code is a *successful* no-op: the tx mines, emits nothing, stores
  // nothing — and every receipt in the batch would be marked "anchored" against
  // a root that was never posted. Fail loudly instead.
  const code = await provider.getCode(registry);
  if (code === "0x") {
    throw new Error(
      `ReceiptRegistry ${registry} has no code on chain ${chainId} (${rpcUrl}). ` +
        `Refusing to anchor — RECEIPT_REGISTRY_ADDRESS is for a different chain.`
    );
  }

  const wallet = new Wallet(batcherKey, provider);
  const contract = new Contract(registry, abi, wallet);

  const fromUnix = Math.floor(new Date(fromTs).getTime() / 1000);
  const toUnix = Math.floor(new Date(toTs).getTime() / 1000);

  // The same pending receipts always hash to the same root, and postRoot reverts
  // with RootExists on a repeat. So if a previous run anchored successfully but
  // died before recording the batch, re-posting would revert forever and wedge
  // all future anchoring. Adopt the existing anchor instead of re-posting it.
  let txHash: string | null;
  let blockNumber: number | null;

  if (await contract.isAnchored(root)) {
    const prior = await findRootPostedTx(provider, registry, root);
    txHash = prior?.txHash ?? null;
    blockNumber = prior?.blockNumber ?? null;
    console.warn(
      `anchor: root ${root} was already on chain ${chainId} — adopting the ` +
        `existing anchor instead of re-posting.`
    );
  } else {
    const tx = await contract.postRoot(root, leaves.length, fromUnix, toUnix);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("tx receipt missing");

    // A mined tx is not proof of an anchor — only the event is. Verify the
    // registry actually emitted RootPosted before we record anything as
    // anchored; throwing here leaves the receipts `pending` so the next run
    // retries them rather than marking them permanently, falsely anchored.
    if (!hasRootPosted(receipt.logs, registry, root)) {
      throw new Error(
        `postRoot tx ${receipt.hash} mined without a RootPosted event — ` +
          `root ${root} was NOT anchored on chain ${chainId}.`
      );
    }

    txHash = receipt.hash;
    blockNumber = receipt.blockNumber;
  }

  const { data: batch, error: batchErr } = await admin
    .from("receipt_batches")
    .insert({
      merkle_root: root,
      leaf_count: leaves.length,
      from_ts: fromTs,
      to_ts: toTs,
      chain_id: chainId,
      contract_addr: registry,
      tx_hash: txHash,
      block_number: blockNumber,
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

  return {
    batched: rows.length,
    txHash: txHash ?? undefined,
    merkleRoot: root,
  };
}

interface TxLog {
  address: string;
  topics: readonly string[];
  data: string;
}

// True only if the registry itself emitted RootPosted for exactly this root.
function hasRootPosted(
  logs: readonly TxLog[],
  registry: string,
  root: string
): boolean {
  const iface = new Interface(abi);
  return logs.some((log) => {
    if (log.address.toLowerCase() !== registry.toLowerCase()) return false;
    try {
      const parsed = iface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      return (
        parsed?.name === "RootPosted" &&
        String(parsed.args.root).toLowerCase() === root.toLowerCase()
      );
    } catch {
      return false;
    }
  });
}

// Locate the tx that anchored `root`, for the explorer link on an adopted
// anchor. Best-effort: the root being on-chain is what verification turns on,
// so a missing tx hash is cosmetic and must not block recording the batch.
async function findRootPostedTx(
  provider: JsonRpcProvider,
  registry: string,
  root: string
): Promise<{ txHash: string; blockNumber: number } | null> {
  const iface = new Interface(abi);
  const topic = iface.getEvent("RootPosted")!.topicHash;
  const CHUNK = 10_000;
  const MAX_CHUNKS = 20;
  try {
    let to = await provider.getBlockNumber();
    for (let i = 0; i < MAX_CHUNKS && to > 0; i++) {
      const from = Math.max(0, to - CHUNK + 1);
      const logs = await provider.getLogs({
        address: registry,
        topics: [topic, root],
        fromBlock: from,
        toBlock: to,
      });
      if (logs.length > 0) {
        return {
          txHash: logs[0].transactionHash,
          blockNumber: logs[0].blockNumber,
        };
      }
      to = from - 1;
    }
  } catch {
    // RPC range limits / transient failures — fall through to null.
  }
  return null;
}
