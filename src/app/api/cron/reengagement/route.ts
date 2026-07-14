import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStreakNudge } from "@/lib/email";

export const dynamic = "force-dynamic";

// Cap per run so a batch stays under Resend's free-tier 100/day limit until we
// choose to pay. Override with REENGAGEMENT_DAILY_CAP once on a paid plan.
const DAILY_CAP = Number(process.env.REENGAGEMENT_DAILY_CAP) || 100;

type Target = {
  id: string;
  email: string;
  display_name: string;
  current_streak: number;
  next_reward: number;
};

// Shared handler. Vercel Cron triggers a GET (and auto-injects
// `Authorization: Bearer $CRON_SECRET`); manual/local callers can POST with the
// same bearer. Sends a "streak ends tonight" nudge to at-risk users, marking
// each as sent so a retry or a second run never double-emails within a day.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("reengagement_targets", {
      p_limit: DAILY_CAP,
    });
    if (error) throw new Error(error.message);

    const targets = (data ?? []) as Target[];
    let sent = 0;
    let failed = 0;

    for (const t of targets) {
      try {
        const ok = await sendStreakNudge(
          t.email,
          t.display_name,
          t.current_streak,
          t.next_reward
        );
        // No send (email disabled or bounced) → leave the user unstamped so a
        // later run retries once email is live. Only stamp a real send.
        if (!ok) {
          failed++;
          continue;
        }
        const { error: markErr } = await supabase.rpc(
          "mark_reengagement_sent",
          { p_id: t.id }
        );
        if (markErr) throw new Error(markErr.message);
        sent++;
      } catch (err) {
        failed++;
        console.error(`Re-engagement send failed for ${t.id}:`, err);
      }
    }

    return Response.json({ candidates: targets.length, sent, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "reengagement failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
