import { getAuthedUser } from "@/lib/supabase/api-auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET — today's daily-reward status (can claim? streak? next reward?).
export async function GET() {
  const { supabase, user } = await getAuthedUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await supabase.rpc("daily_reward_status");
  if (error) return json({ error: error.message }, 500);
  return json(data);
}

// POST — claim today's reward (once per day; server-enforced).
export async function POST() {
  const { supabase, user } = await getAuthedUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { ok } = rateLimit(`daily:${user.id}`, 10);
  if (!ok) return rateLimitResponse();

  const { data, error } = await supabase.rpc("claim_daily_reward");
  if (error) {
    const msg = error.message.replace(/^.*:\s*/, "");
    const already = /already claimed/i.test(error.message);
    return json({ error: msg }, already ? 409 : 500);
  }
  return json(data);
}
