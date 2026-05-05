-- ============================================================
-- Atomic deposit completion.
--
-- The webhook and verify routes can both fire for the same
-- reference (e.g. user returns to /deposit while the webhook
-- is in flight). Doing the "is it pending?" check and the
-- credit + status flip as separate statements lets two
-- concurrent callers both pass the check and both credit.
--
-- This function does the flip atomically: the UPDATE only
-- claims the row when status is still 'pending', so exactly
-- one caller wins and credits the balance.
-- ============================================================
create or replace function complete_deposit(
  p_reference text,
  p_credits   numeric
)
returns jsonb as $$
declare
  v_user_id     uuid;
  v_new_balance numeric;
begin
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
$$ language plpgsql security definer;
