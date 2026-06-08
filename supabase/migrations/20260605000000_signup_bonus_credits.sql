-- ============================================================
-- Signup bonus credits
-- ------------------------------------------------------------
-- New users previously started with credits_balance = 0, and the chat
-- endpoint requires a 5-credit minimum (MIN_CREDITS) to send a message —
-- so a brand-new user literally could not try the product before
-- depositing. This grants a small free balance on signup so the first
-- question is genuinely free, then redefines handle_new_user() to set it.
--
-- Credits are valued at 1000 credits = $1 (1 credit = $0.001), so the
-- 20-credit bonus below is worth ~$0.02 — enough to clear the 5-credit chat
-- minimum and try a few short messages, while costing us at most ~$0.01 per
-- signup even if fully spent. Adjust v_bonus to tune acquisition cost.
--
-- The bonus is logged under a dedicated 'bonus' transaction type (not
-- 'deposit') so it can never inflate the admin Revenue / Deposits metrics,
-- which count only real paid deposits.
--
-- The 'bonus' transaction type is added in the preceding migration
-- (20260604120000_add_bonus_transaction_type.sql). It must be committed in a
-- separate transaction before this one — referencing a newly-added enum value
-- in the same transaction that adds it raises "unsafe use of new value".
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  v_bonus constant numeric := 20;  -- free credits (1000 credits = $1)
begin
  insert into profiles (id, display_name, credits_balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_bonus
  );

  -- Record the bonus as a completed deposit for accounting/audit. The
  -- profile row above is inserted first, so the FK to profiles(id) holds.
  insert into transactions (
    user_id, type, amount, currency, original_amount, reference, status, metadata
  )
  values (
    new.id, 'bonus', v_bonus, 'USD', 0,
    'signup-bonus:' || new.id, 'completed',
    '{"kind":"signup_bonus"}'
  );

  return new;
end;
$$ language plpgsql security definer;

-- The on_auth_user_created trigger already points at handle_new_user(),
-- so redefining the function is enough — no trigger change needed.
--
-- Existing users are intentionally NOT backfilled here: some have already
-- deposited and spent down to 0, and a blanket grant would hand them a
-- freebie. Backfill deliberately if desired with a one-off UPDATE.
