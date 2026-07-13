-- ============================================================
-- Daily reward + login streak
-- ------------------------------------------------------------
-- A reason to come back tomorrow: claim free credits once a day, and a
-- consecutive-day streak grows the reward (10 → +5/day, capped at 50). Miss a
-- day and the streak resets. Grants are logged as 'bonus' transactions (added
-- in 20260604120000) so paid-revenue metrics stay clean.
--
-- Server-enforced once-per-day: the claim locks the profile row, checks
-- last_daily_claim against current_date, and the 'daily:<uid>:<date>' unique
-- transaction reference is a second guard against double claims.
--
-- IMPORTANT: if the migration runner already recorded this filename, paste the
-- bodies below into the Supabase SQL Editor to update production.
-- ============================================================

alter table public.profiles
  add column if not exists last_daily_claim date,
  add column if not exists daily_streak     int not null default 0;

-- ---------- daily_reward_status(): what the card should show -----------------
create or replace function public.daily_reward_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_last   date;
  v_streak int;
  v_next   int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select last_daily_claim, coalesce(daily_streak, 0)
    into v_last, v_streak
    from public.profiles where id = v_uid;

  -- Streak they'd hold after claiming right now.
  if v_last = current_date then
    v_next := v_streak;                 -- already claimed today
  elsif v_last = current_date - 1 then
    v_next := v_streak + 1;             -- continuing the streak
  else
    v_next := 1;                        -- new / broken streak
  end if;

  return jsonb_build_object(
    'can_claim', v_last is distinct from current_date,
    'claimed_today', v_last = current_date,
    'current_streak', coalesce(v_streak, 0),
    'next_streak', v_next,
    'next_reward', least(10 + (v_next - 1) * 5, 50)
  );
end;
$$;

-- ---------- claim_daily_reward(): grant today's credits ----------------------
create or replace function public.claim_daily_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_last      date;
  v_streak    int;
  v_new       int;
  v_reward    int;
  v_balance   numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the row so two tabs can't double-claim.
  select last_daily_claim, coalesce(daily_streak, 0)
    into v_last, v_streak
    from public.profiles where id = v_uid for update;

  if v_last = current_date then
    raise exception 'Already claimed today';
  end if;

  v_new := case when v_last = current_date - 1 then v_streak + 1 else 1 end;
  v_reward := least(10 + (v_new - 1) * 5, 50);

  update public.profiles
     set credits_balance  = credits_balance + v_reward,
         last_daily_claim = current_date,
         daily_streak     = v_new
   where id = v_uid
   returning credits_balance into v_balance;

  insert into public.transactions
    (user_id, type, amount, currency, original_amount, reference, status, metadata)
  values
    (v_uid, 'bonus', v_reward, 'USD', 0,
     'daily:' || v_uid || ':' || to_char(current_date, 'YYYY-MM-DD'),
     'completed',
     jsonb_build_object('kind', 'daily', 'streak', v_new));

  return jsonb_build_object('reward', v_reward, 'streak', v_new, 'balance', v_balance);
end;
$$;

grant execute on function public.daily_reward_status() to authenticated;
grant execute on function public.claim_daily_reward() to authenticated;
