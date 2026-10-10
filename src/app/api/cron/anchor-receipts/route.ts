import { NextRequest } from "next/server";
import { anchorPendingReceipts } from "@/lib/receipt-anchor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Shared handler. Vercel Cron triggers a GET (and auto-injects
// `Authorization: Bearer $CRON_SECRET`); manual/local callers can POST with the
// same bearer. Both paths run the identical anchoring logic.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  // Refund credit holds a crashed request never settled. Independent of
  // anchoring, so a registry problem can't strand users' credits.
  const { data: releasedHolds, error: holdsError } = await createAdminClient().rpc(
    "release_stale_credit_holds"
  );
  if (holdsError) console.error("release_stale_credit_holds failed", holdsError);

  try {
    const result = await anchorPendingReceipts();
    return Response.json({ ...result, releasedHolds: releasedHolds ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "anchor failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
