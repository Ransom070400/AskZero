import { getAuthedUser } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Credits spent on usage (chat/image) since 00:00 UTC today — the running
// "spent today" figure for the pre-send cost meter. deduct_credits logs each
// charge as a 'usage' transaction with original_amount = the positive credits
// deducted (see 20260403000000_create_core_tables.sql), so we sum those.
export async function GET() {
  const { supabase, user } = await getAuthedUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("transactions")
    .select("original_amount")
    .eq("user_id", user.id)
    .eq("type", "usage")
    .eq("status", "completed")
    .gte("created_at", start.toISOString());

  if (error) return json({ error: error.message }, 500);

  const creditsToday = (data ?? []).reduce(
    (sum, t) => sum + Number(t.original_amount ?? 0),
    0
  );
  return json({ creditsToday });
}
