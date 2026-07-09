-- ============================================================
-- Signup bonus: 100 free credits for new users
-- ------------------------------------------------------------
-- Gives new users a starter balance so they can try AskZero before paying.
--
-- The previous bonus (20260605000000) broke every signup ("Database error
-- saving new user") because it ALSO inserted a `transactions` row inside the
-- trigger. This version grants the credits by setting `credits_balance` in the
-- same hardened profile insert (from 20260607000000) and does NOT touch
-- `transactions`, so it can't reintroduce that failure. All the earlier
-- hardening is preserved:
--   * security definer + `set search_path = public` + schema-qualified names
--   * null-safe display_name
--   * `on conflict (id) do nothing`
--
-- Units: 1000 credits = $1, so 100 credits ≈ $0.10 (~10 messages on a cheap
-- model). Only affects NEW users — existing 0-balance users are not backfilled.
--
-- IMPORTANT: if the migration runner already recorded this filename as applied,
-- it will NOT re-run it — paste the function body below into the Supabase SQL
-- Editor to update production.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, credits_balance)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user'
    ),
    100  -- signup bonus: 100 free credits (1000 credits = $1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The on_auth_user_created trigger already points at handle_new_user(),
-- so redefining the function is enough — no trigger change needed.
