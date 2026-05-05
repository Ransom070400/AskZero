import { NextRequest } from "next/server";
import { anchorPendingReceipts } from "@/lib/receipt-anchor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const result = await anchorPendingReceipts();
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "anchor failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
