import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cohort analytics for a small user base (tens–hundreds): the acquisition →
// value → revenue funnel plus retention, so features are chosen from behavior,
// not intuition. Admin-gated; runs on the service-role client because these are
// platform-wide aggregates that RLS would otherwise scope to the admin's own rows.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const PAGE = 1000;
const MAX_PAGES = 50; // safety cap (50k rows) — far above a tens-of-users base

// PostgREST caps a single response at ~1000 rows, so page through with range().
async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE;
    const { data } = await make(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [profiles, chats, umsgs, deposits, usage] = await Promise.all([
    fetchAll<{ id: string; created_at: string; referred_by: string | null }>((f, t) =>
      db.from("profiles").select("id, created_at, referred_by").range(f, t)
    ),
    fetchAll<{ id: string; user_id: string }>((f, t) =>
      db.from("chats").select("id, user_id").range(f, t)
    ),
    fetchAll<{ chat_id: string; created_at: string }>((f, t) =>
      db.from("messages").select("chat_id, created_at").eq("role", "user").range(f, t)
    ),
    fetchAll<{ user_id: string; amount: number; currency: string; created_at: string }>((f, t) =>
      db
        .from("transactions")
        .select("user_id, amount, currency, created_at")
        .eq("type", "deposit")
        .eq("status", "completed")
        .range(f, t)
    ),
    fetchAll<{ user_id: string; amount: number; metadata: { kind?: string } | null }>((f, t) =>
      db.from("transactions").select("user_id, amount, metadata").eq("type", "usage").range(f, t)
    ),
  ]);

  const chatUser = new Map(chats.map((c) => [c.id, c.user_id]));
  const totalUsers = profiles.length;

  // Activation (sent ≥1 question) + active days per user (for retention).
  const activatedIds = new Set<string>();
  const daysByUser = new Map<string, Set<string>>();
  const touch = (uid: string | undefined, iso: string) => {
    if (!uid) return;
    if (!daysByUser.has(uid)) daysByUser.set(uid, new Set());
    daysByUser.get(uid)!.add(iso.slice(0, 10));
  };
  for (const m of umsgs) {
    const uid = chatUser.get(m.chat_id);
    if (uid) {
      activatedIds.add(uid);
      touch(uid, m.created_at);
    }
  }
  for (const d of deposits) touch(d.user_id, d.created_at);

  const activated = activatedIds.size;
  const paidIds = new Set(deposits.map((d) => d.user_id));
  const paid = paidIds.size;

  // Returning = active on ≥2 distinct days. Active7d = any activity in last week.
  let returning = 0;
  daysByUser.forEach((days) => {
    if (days.size >= 2) returning++;
  });

  const active7 = new Set<string>();
  for (const m of umsgs)
    if (m.created_at >= weekAgo) {
      const uid = chatUser.get(m.chat_id);
      if (uid) active7.add(uid);
    }
  for (const d of deposits) if (d.created_at >= weekAgo) active7.add(d.user_id);

  const new7d = profiles.filter((p) => p.created_at >= weekAgo).length;

  const revenueCredits = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
  const revenueUsd = revenueCredits / 1000;

  // Deposits by currency — where the paying users are.
  const curMap = new Map<string, { count: number; credits: number }>();
  for (const d of deposits) {
    const c = curMap.get(d.currency) ?? { count: 0, credits: 0 };
    c.count++;
    c.credits += Number(d.amount || 0);
    curMap.set(d.currency, c);
  }
  const currencyMix = Array.from(curMap.entries())
    .map(([currency, v]) => ({ currency, ...v }))
    .sort((a, b) => b.credits - a.credits);

  // What people spend on — chat vs research vs code vs image.
  const featMap = new Map<string, { count: number; credits: number }>();
  for (const u of usage) {
    const kind = u.metadata?.kind || "chat";
    const f = featMap.get(kind) ?? { count: 0, credits: 0 };
    f.count++;
    f.credits += Math.abs(Number(u.amount || 0));
    featMap.set(kind, f);
  }
  const featureUsage = Array.from(featMap.entries())
    .map(([kind, v]) => ({ kind, ...v }))
    .sort((a, b) => b.count - a.count);

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return NextResponse.json({
    funnel: {
      signedUp: totalUsers,
      activated,
      paid,
      activatedPct: pct(activated, totalUsers),
      paidPctOfActivated: pct(paid, activated),
      paidPctOfAll: pct(paid, totalUsers),
    },
    health: {
      new7d,
      active7d: active7.size,
      returning,
      returningPct: pct(returning, totalUsers),
      arpu: (totalUsers ? revenueUsd / totalUsers : 0).toFixed(2),
      arppu: (paid ? revenueUsd / paid : 0).toFixed(2),
      referredCount: profiles.filter((p) => p.referred_by).length,
    },
    featureUsage,
    currencyMix,
  });
}
