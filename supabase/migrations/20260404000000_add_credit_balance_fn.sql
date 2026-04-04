-- Add credit_balance function for deposit verification
create or replace function credit_balance(
  p_user_id uuid,
  p_amount  numeric
)
returns numeric as $$
declare
  v_new_balance numeric;
begin
  update profiles
  set credits_balance = credits_balance + p_amount
  where id = p_user_id
  returning credits_balance into v_new_balance;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_new_balance;
end;
$$ language plpgsql security definer;

-- Ensure transaction update policy exists
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'transactions'
    and policyname = 'Users can update own transactions'
  ) then
    create policy "Users can update own transactions"
      on transactions for update
      using (auth.uid() = user_id);
  end if;
end $$;

-- Ensure transaction insert policy exists
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'transactions'
    and policyname = 'Users can insert own transactions'
  ) then
    create policy "Users can insert own transactions"
      on transactions for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
