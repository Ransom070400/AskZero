-- Reserve credits before inference, settle after.
--
-- Usage used to be charged only after an answer finished. A client that hung
-- up first, a parallel burst that all passed the balance read, or a transient
-- deduct error each produced free (or wrongly drained) answers. Now:
--
--   reserve_credits  takes the projected cost up front (fails if the balance
--                    can't cover it) and records a hold;
--   settle_credits   swaps the hold for the actual cost — refunding the
--                    difference, or collecting the overage as far as the
--                    balance allows — and writes the single 'usage' row;
--   release_stale_credit_holds  refunds holds a crashed request never
--                    settled (run from the hourly cron).
--
-- All service-role only, like the other credit functions.

create table if not exists credit_holds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  amount     numeric not null check (amount > 0),
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_credit_holds_created on credit_holds(created_at);
alter table credit_holds enable row level security;
-- No policies: only the service role touches holds.

create or replace function reserve_credits(
  p_user_id  uuid,
  p_amount   numeric,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update profiles
     set credits_balance = credits_balance - p_amount
   where id = p_user_id
     and credits_balance >= p_amount;
  if not found then
    raise exception 'Insufficient credits';
  end if;

  insert into credit_holds (user_id, amount, metadata)
  values (p_user_id, p_amount, coalesce(p_metadata, '{}'))
  returning id into v_hold_id;

  return v_hold_id;
end;
$$;

create or replace function settle_credits(
  p_hold_id  uuid,
  p_actual   numeric,
  p_metadata jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold        credit_holds%rowtype;
  v_actual      numeric := greatest(coalesce(p_actual, 0), 0);
  v_extra       numeric := 0;
  v_charged     numeric;
  v_new_balance numeric;
begin
  delete from credit_holds where id = p_hold_id returning * into v_hold;
  if not found then
    -- Already settled (or released by the cron): nothing to do.
    return jsonb_build_object('settled', false);
  end if;

  if v_actual > v_hold.amount then
    -- Ran over the projection: collect what the balance allows, never
    -- taking it below zero.
    select least(v_actual - v_hold.amount, greatest(credits_balance, 0))
      into v_extra
      from profiles where id = v_hold.user_id for update;
    v_charged := v_hold.amount + v_extra;
    update profiles
       set credits_balance = credits_balance - v_extra
     where id = v_hold.user_id
    returning credits_balance into v_new_balance;
  else
    v_charged := v_actual;
    update profiles
       set credits_balance = credits_balance + (v_hold.amount - v_actual)
     where id = v_hold.user_id
    returning credits_balance into v_new_balance;
  end if;

  if v_charged > 0 then
    insert into transactions (user_id, type, amount, currency, original_amount, status, metadata)
    values (
      v_hold.user_id, 'usage', -v_charged, 'USD', v_charged, 'completed',
      v_hold.metadata || coalesce(p_metadata, '{}') || jsonb_build_object(
        'reserved', v_hold.amount,
        'full_cost', v_actual,
        'shortfall', greatest(v_actual - v_charged, 0)
      )
    );
  end if;

  return jsonb_build_object(
    'settled',     true,
    'charged',     v_charged,
    'shortfall',   greatest(v_actual - v_charged, 0),
    'new_balance', v_new_balance
  );
end;
$$;

create or replace function release_stale_credit_holds(
  p_older_than interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold  credit_holds%rowtype;
  v_count integer := 0;
begin
  for v_hold in
    delete from credit_holds
     where created_at < now() - p_older_than
    returning *
  loop
    update profiles
       set credits_balance = credits_balance + v_hold.amount
     where id = v_hold.user_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function reserve_credits(uuid, numeric, jsonb)  from public, anon, authenticated;
revoke execute on function settle_credits(uuid, numeric, jsonb)   from public, anon, authenticated;
revoke execute on function release_stale_credit_holds(interval)   from public, anon, authenticated;
grant  execute on function reserve_credits(uuid, numeric, jsonb)  to service_role;
grant  execute on function settle_credits(uuid, numeric, jsonb)   to service_role;
grant  execute on function release_stale_credit_holds(interval)   to service_role;
