import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET — this user's referral code + stats (lazily allocates a code on first call).
export async function GET() {
  const { supabase, user } = await getAuthedUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await supabase.rpc("referral_info");
  if (error) return json({ error: error.message }, 500);

  const info = data as {
    code: string;
    referred_count: number;
    earned: number;
    referrer_bonus: number;
    referee_bonus: number;
  };
  return json({
    code: info.code,
    referredCount: info.referred_count,
    earned: info.earned,
    referrerBonus: info.referrer_bonus,
    refereeBonus: info.referee_bonus,
  });
}

// POST { code } — redeem someone else's code; credits both sides once.
export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { ok } = rateLimit(`referral:${user.id}`, 10);
  if (!ok) return rateLimitResponse();

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  if (!code) return json({ error: "Enter a referral code" }, 400);

  const { data, error } = await supabase.rpc("redeem_referral", { p_code: code });
  if (error) {
    // Postgres RAISE messages are user-facing here (invalid code, already used…).
    return json({ error: error.message.replace(/^.*:\s*/, "") }, 400);
  }

  const result = data as { referee_bonus: number; referrer_bonus: number; balance: number };
  return json({
    refereeBonus: result.referee_bonus,
    referrerBonus: result.referrer_bonus,
    balance: result.balance,
  });
}
