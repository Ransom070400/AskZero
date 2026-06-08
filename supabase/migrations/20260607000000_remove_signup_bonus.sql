-- ============================================================
-- Remove the signup bonus + harden handle_new_user
-- ------------------------------------------------------------
-- The bonus version of handle_new_user() (20260605000000) was failing on
-- every signup ("Database error saving new user"), so no new users could be
-- created. This restores the original behaviour — create the profile with
-- the default 0 credit balance, no bonus transaction — and hardens the
-- function against the common failure modes:
--
--   * `set search_path = public` + schema-qualified `public.profiles` so the
--     unqualified relation can always be resolved under the auth_admin role.
--   * null-safe display_name (falls back to the email local-part, then
--     'user') so a signup with no name/email can't violate the NOT NULL.
--   * `on conflict (id) do nothing` so a retried signup after a partial
--     failure can't throw a duplicate-key error.
--
-- Notes:
--  * The 'bonus' transaction_type added in
--    20260604120000_add_bonus_transaction_type.sql is left in place —
--    Postgres cannot cleanly drop an enum value, and it is harmless.
--  * Credits already granted during the bonus window are NOT clawed back.
--
-- IMPORTANT: if this migration was already recorded as applied before this
-- hardened content existed, the migration runner will NOT re-run it. Run the
-- function body below directly in the Supabase SQL Editor to fix production.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The on_auth_user_created trigger already points at handle_new_user(),
-- so redefining the function is enough — no trigger change needed.
