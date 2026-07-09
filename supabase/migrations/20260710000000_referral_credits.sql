-- ============================================================
-- Referral credits: invite a friend — both get free credits
-- ------------------------------------------------------------
-- A viral sibling to the signup bonus (20260709000000). When a new user
-- redeems a referrer's code, BOTH sides are granted credits.
--
-- SAFETY: this deliberately does NOT touch handle_new_user(). The 20260605
-- signup bonus broke every signup ("Database error saving new user") by doing
-- extra work inside that trigger. Here:
--   * referral codes are allocated LAZILY (referral_info) the first time a user
--     opens their referral card — never on the signup insert path, so a code
--     collision can never break signup.
--   * redemption happens AFTER signup via redeem_referral(), a security-definer
--     RPC the client calls once the session exists.
--
-- Units: 1000 credits = $1. Referrer earns 200 (~$0.20), the new user earns 100
-- (~$0.10) on top of their signup bonus. Grants are logged as 'bonus'
-- transactions (added in 20260604120000) so paid-revenue metrics stay clean.
--
-- IMPORTANT: if the migration runner already recorded this filename as applied,
-- paste the bodies below into the Supabase SQL Editor to update production.
-- ============================================================

-- ---------- schema ----------
alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by  uuid references public.profiles(id);

create index if not exists idx_profiles_referred_by on public.profiles(referred_by);

-- ---------- referral_info(): ensure a code exists, return code + stats --------
-- Runs as the caller's identity via auth.uid(). Security definer so it can
-- allocate a globally-unique code and count referrals across profiles (which
-- RLS would otherwise hide). The collision-retry loop uses a subtransaction so a
-- clash rolls back cleanly and tries again.
create or replace function public.referral_info()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_try   text;
  v_count integer;
  v_earned numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select referral_code into v_code from public.profiles where id = v_uid;

  if v_code is null then
    for i in 1..10 loop
      -- 7 chars from an unambiguous alphabet (no I/O/0/1): ~34e9 combinations.
      v_try := (
        select string_agg(
          substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                 (floor(random() * 32) + 1)::int, 1), '')
        from generate_series(1, 7)
      );
      begin
        update public.profiles set referral_code = v_try where id = v_uid;
        v_code := v_try;
        exit;
      exception when unique_violation then
        -- code already taken — loop and try another
      end;
    end loop;
    if v_code is null then
      raise exception 'Could not allocate referral code';
    end if;
  end if;

  select count(*) into v_count
    from public.profiles where referred_by = v_uid;

  select coalesce(sum(amount), 0) into v_earned
    from public.transactions
   where user_id = v_uid
     and type = 'bonus'
     and metadata->>'kind' = 'referral';

  return jsonb_build_object(
    'code', v_code,
    'referred_count', v_count,
    'earned', v_earned,
    'referrer_bonus', 200,
    'referee_bonus', 100
  );
end;
$$;

-- ---------- redeem_referral(code): credit both sides, once -------------------
create or replace function public.redeem_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_referrer     uuid;
  v_referee_new  numeric;
  v_referrer_bonus constant numeric := 200;
  v_referee_bonus  constant numeric := 100;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_code), '') = '' then
    raise exception 'Enter a referral code';
  end if;

  -- One-time: a user who was already referred can't redeem again.
  if exists (select 1 from public.profiles where id = v_uid and referred_by is not null) then
    raise exception 'You have already used a referral code';
  end if;

  select id into v_referrer
    from public.profiles
   where upper(referral_code) = upper(trim(p_code));

  if v_referrer is null then
    raise exception 'Invalid referral code';
  end if;
  if v_referrer = v_uid then
    raise exception 'You cannot use your own referral code';
  end if;

  -- Claim the referral atomically; the referred_by IS NULL guard makes
  -- concurrent double-redeems impossible.
  update public.profiles set referred_by = v_referrer
   where id = v_uid and referred_by is null;
  if not found then
    raise exception 'You have already used a referral code';
  end if;

  -- Credit both sides.
  update public.profiles set credits_balance = credits_balance + v_referee_bonus
   where id = v_uid returning credits_balance into v_referee_new;
  update public.profiles set credits_balance = credits_balance + v_referrer_bonus
   where id = v_referrer;

  -- Ledger entries (unique references also enforce one-time at the DB level).
  insert into public.transactions
    (user_id, type, amount, currency, original_amount, reference, status, metadata)
  values
    (v_uid, 'bonus', v_referee_bonus, 'USD', 0, 'ref-in:' || v_uid, 'completed',
      jsonb_build_object('kind', 'referral', 'role', 'referee', 'referrer', v_referrer)),
    (v_referrer, 'bonus', v_referrer_bonus, 'USD', 0, 'ref-out:' || v_uid, 'completed',
      jsonb_build_object('kind', 'referral', 'role', 'referrer', 'referee', v_uid));

  return jsonb_build_object(
    'referee_bonus', v_referee_bonus,
    'referrer_bonus', v_referrer_bonus,
    'balance', v_referee_new
  );
end;
$$;

grant execute on function public.referral_info() to authenticated;
grant execute on function public.redeem_referral(text) to authenticated;
