import { NextRequest } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { rootFromProof } from "@/lib/receipts";
import { zerogChain } from "@/lib/zerog-chains";

// Independently re-derives the Merkle root from the receipt + its proof, then
// confirms that root is anchored on the live 0G chain via the registry's
// isAnchored() view. This is the tangible tamper-evidence check: if the answer
// (and thus its hash / leaf) had been altered, the recomputed root would differ
// and would not be found on-chain.
const REGISTRY_ABI = ["function isAnchored(bytes32 root) view returns (bool)"];

export async function GET(
  _req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  const { supabase, user } = await getAuthedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: receipt } = await supabase
    .from("inference_receipts")
    .select("receipt_hash, merkle_proof, leaf_index, batch_id")
    .eq("message_id", params.messageId)
    .maybeSingle();

  if (!receipt) {
    return Response.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (!receipt.batch_id || !receipt.merkle_proof) {
    return Response.json({
      status: "pending",
      message: "This receipt hasn't been anchored on-chain yet (batched hourly).",
    });
  }

  const { data: batch } = await supabase
    .from("receipt_batches")
    .select("merkle_root, contract_addr, tx_hash, block_number, chain_id, leaf_count")
    .eq("id", receipt.batch_id)
    .maybeSingle();

  if (!batch) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }

  // 1) Re-derive the root purely from the receipt hash + sibling proof.
  const proof = (receipt.merkle_proof as string[]) ?? [];
  const computedRoot = rootFromProof(receipt.receipt_hash, proof);
  const rootMatches =
    computedRoot.toLowerCase() === batch.merkle_root.toLowerCase();

  // 2) Confirm that root is anchored on the live chain (not just our DB).
  // Use the chain the batch was actually anchored on — not a hardcoded default.
  const chain = zerogChain(batch.chain_id);
  let onChain: boolean | null = null;
  let chainError: string | null = null;
  try {
    const provider = new JsonRpcProvider(chain.rpc);
    const registry = new Contract(batch.contract_addr, REGISTRY_ABI, provider);
    onChain = await registry.isAnchored(batch.merkle_root);
  } catch (e) {
    chainError = (e as Error).message;
  }

  const base = chain.explorer;

  return Response.json({
    status: "anchored",
    receiptHash: receipt.receipt_hash,
    leafIndex: receipt.leaf_index,
    proofLength: proof.length,
    computedRoot,
    merkleRoot: batch.merkle_root,
    rootMatches, // receipt is provably inside the batch
    onChain, // the batch root is provably on the live 0G chain
    chainError,
    leafCount: batch.leaf_count,
    chainId: batch.chain_id,
    chainName: chain.name,
    contract: batch.contract_addr,
    txHash: batch.tx_hash,
    blockNumber: batch.block_number,
    txUrl: batch.tx_hash ? `${base}/tx/${batch.tx_hash}` : null,
    contractUrl: `${base}/address/${batch.contract_addr}`,
  });
}
