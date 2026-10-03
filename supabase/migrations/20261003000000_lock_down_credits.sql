-- ============================================================
-- Lock down credits.
--
-- Postgres grants EXECUTE on new functions to PUBLIC, and Supabase exposes
-- every public-schema function over PostgREST. The credit functions below are
-- SECURITY DEFINER and take the target user + amount from the caller, so any
-- holder of the anon key could mint credits for any account:
--   * credit_balance / add_credits  — add any amount to any user
--   * deduct_credits                — negative amount = mint; or drain others
--   * complete_deposit              — caller picks the credited amount
-- On top of that, the profiles UPDATE policy had no column restriction (users
-- could set their own credits_balance), and users could insert/update their own
-- transactions (forge a pending deposit, then complete it).
--
-- After this migration only the service role (server-side admin client) can
-- move credits. Users can still update display_name / avatar_url.
--
-- DEPLOY ORDER: ship the app code that uses the admin client FIRST, then run
-- this. Running it against the old code breaks deposits and usage charging.
-- If the migration runner already recorded this filename, paste it into the
-- Supabase SQL Editor.
-- ============================================================

-- ---------- APAC currencies ---------------------------------------------------
-- Stripe deposits in these currencies used to insert their pending row with a
-- currency the enum rejected; the error was ignored and the webhook credited
-- the balance directly. Crediting now flips that pending row, so it must exist.

alter type currency_code add value if not exists 'JPY';
alter type currency_code add value if not exists 'SGD';
alter type currency_code add value if not exists 'HKD';
alter type currency_code add value if not exists 'AUD';
alter type currency_code add value if not exists 'NZD';
alter type currency_code add value if not exists 'MYR';
alter type currency_code add value if not exists 'THB';
alter type currency_code add value if not exists 'KRW';
alter type currency_code add value if not exists 'PHP';
alter type currency_code add value if not exists 'IDR';
alter type currency_code add value if not exists 'INR';
alter type currency_code add value if not exists 'VND';
alter type currency_code add value if not exists 'TWD';

-- ---------- credit functions: reject non-positive amounts ------------------

create or replace function credit_balance(
  p_user_id uuid,
  p_amount  numeric
)
returns numeric as $$
declare
  v_new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update profiles
  set credits_balance = credits_balance + p_amount
  where id = p_user_id
  returning credits_balance into v_new_balance;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_new_balance;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function deduct_credits(
  p_user_id  uuid,
  p_amount   numeric,   -- positive number to deduct
  p_metadata jsonb default '{}'
)
returns numeric as $$
declare
  v_new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update profiles
  set credits_balance = credits_balance - p_amount
  where id = p_user_id
    and credits_balance >= p_amount
  returning credits_balance into v_new_balance;

  if not found then
    raise exception 'Insufficient credits';
  end if;

  insert into transactions (user_id, type, amount, currency, original_amount, status, metadata)
  values (p_user_id, 'usage', -p_amount, 'USD', p_amount, 'completed', p_metadata);

  return v_new_balance;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function add_credits(
  p_user_id         uuid,
  p_amount          numeric,
  p_currency        currency_code,
  p_original_amount numeric,
  p_reference       text
)
returns numeric as $$
declare
  v_new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update profiles
  set credits_balance = credits_balance + p_amount
  where id = p_user_id
  returning credits_balance into v_new_balance;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into transactions (user_id, type, amount, currency, original_amount, reference, status)
  values (p_user_id, 'deposit', p_amount, p_currency, p_original_amount, p_reference, 'completed');

  return v_new_balance;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function complete_deposit(
  p_reference text,
  p_credits   numeric
)
returns jsonb as $$
declare
  v_user_id     uuid;
  v_new_balance numeric;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update transactions
  set status = 'completed', amount = p_credits
  where reference = p_reference
    and status = 'pending'
  returning user_id into v_user_id;

  if v_user_id is null then
    return jsonb_build_object('credited', false, 'reason', 'not_pending');
  end if;

  update profiles
  set credits_balance = credits_balance + p_credits
  where id = v_user_id
  returning credits_balance into v_new_balance;

  return jsonb_build_object(
    'credited',    true,
    'user_id',     v_user_id,
    'new_balance', v_new_balance
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- service role only -----------------------------------------------

revoke execute on function credit_balance(uuid, numeric)                              from public, anon, authenticated;
revoke execute on function deduct_credits(uuid, numeric, jsonb)                       from public, anon, authenticated;
revoke execute on function add_credits(uuid, numeric, currency_code, numeric, text)   from public, anon, authenticated;
revoke execute on function complete_deposit(text, numeric)                            from public, anon, authenticated;

grant execute on function credit_balance(uuid, numeric)                               to service_role;
grant execute on function deduct_credits(uuid, numeric, jsonb)                        to service_role;
grant execute on function add_credits(uuid, numeric, currency_code, numeric, text)    to service_role;
grant execute on function complete_deposit(text, numeric)                             to service_role;

-- The re-engagement helpers were granted to service_role but never revoked
-- from PUBLIC, so reengagement_targets() leaked user emails to anyone.
revoke execute on function public.reengagement_targets(int)    from public, anon, authenticated;
revoke execute on function public.mark_reengagement_sent(uuid) from public, anon, authenticated;

-- ---------- profiles: users may only edit their display fields --------------

revoke insert, update on table profiles from anon, authenticated;
grant update (display_name, avatar_url) on table profiles to authenticated;

-- ---------- transactions: written by the server only -------------------------

drop policy if exists "Users can insert own transactions" on transactions;
drop policy if exists "Users can update own transactions" on transactions;
revoke insert, update, delete on table transactions from anon, authenticated;
