-- ============================================================
-- Re-engagement email: "your streak ends tonight"
-- ------------------------------------------------------------
-- The daily streak (20260715) is pull-only — it rewards users who already came
-- back, but nothing pulls them back. This closes that loop: a once-daily cron
-- finds users whose streak is INTACT but UNCLAIMED today (claimed yesterday,
-- not yet today) and emails them a nudge to claim before it breaks at midnight.
--
-- Loss-aversion is the whole point of a streak, so we target the highest-value
-- case: people with something to lose right now, ordered by streak length.
--
-- Idempotency: last_reengagement_email guards against re-sending within a day
-- (the cron may run more than once, or be retried). p_limit caps the batch so a
-- send stays under Resend's free-tier 100/day cap until we choose to pay.
--
-- IMPORTANT: if the migration runner already recorded this filename, paste the
-- bodies below into the Supabase SQL Editor to update production.
-- ============================================================

alter table public.profiles
  add column if not exists last_reengagement_email date;

-- ---------- reengagement_targets(): who to nudge, right now ------------------
-- Returns at most p_limit users whose streak breaks tonight unless they claim.
-- SECURITY DEFINER so it can read auth.users for the email; callable only by
-- the service role (the cron's admin client). next_reward is what they'd get by
-- claiming today (streak advances by 1): 10 + streak*5, capped at 50.
create or replace function public.reengagement_targets(p_limit int default 100)
returns table (
  id             uuid,
  email          text,
  display_name   text,
  current_streak int,
  next_reward    int
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    u.email,
    p.display_name,
    p.daily_streak                            as current_streak,
    least(10 + p.daily_streak * 5, 50)        as next_reward
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.daily_streak >= 1
    and p.last_daily_claim = current_date - 1            -- claimed yesterday, streak intact
    and p.last_reengagement_email is distinct from current_date  -- not nudged today
    and u.email is not null
  order by p.daily_streak desc
  limit greatest(p_limit, 0);
$$;

-- ---------- mark_reengagement_sent(): stamp after a successful send ----------
create or replace function public.mark_reengagement_sent(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set last_reengagement_email = current_date
   where id = p_id;
$$;

-- Cron authenticates as the service role via the admin client.
grant execute on function public.reengagement_targets(int) to service_role;
grant execute on function public.mark_reengagement_sent(uuid) to service_role;
