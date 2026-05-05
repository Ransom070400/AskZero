import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { data: receipt, error } = await supabase
    .from("inference_receipts")
    .select(
      "id, provider, model, input_hash, output_hash, input_tokens, output_tokens, cost_credits, tee_attestation, nonce, receipt_hash, status, leaf_index, merkle_proof, batch_id, created_at"
    )
    .eq("message_id", params.messageId)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
  if (!receipt) {
    return new Response(JSON.stringify({ error: "Receipt not found" }), {
      status: 404,
    });
  }

  let batch: unknown = null;
  let explorerUrl: string | null = null;
  if (receipt.batch_id) {
    const { data: b } = await supabase
      .from("receipt_batches")
      .select(
        "merkle_root, leaf_count, from_ts, to_ts, chain_id, contract_addr, tx_hash, block_number, status, confirmed_at"
      )
      .eq("id", receipt.batch_id)
      .maybeSingle();
    batch = b;

    const explorerBase = process.env.NEXT_PUBLIC_ZERO_G_EXPLORER_URL;
    if (b?.tx_hash && explorerBase) {
      explorerUrl = `${explorerBase.replace(/\/+$/, "")}/tx/${b.tx_hash}`;
    }
  }

  return Response.json({ receipt, batch, explorerUrl });
}
