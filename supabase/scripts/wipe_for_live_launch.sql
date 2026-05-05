-- ============================================================
-- ONE-OFF: full data wipe before Paystack live launch.
--
-- This is NOT a migration. Do not run via `supabase db push`.
-- Paste into Supabase SQL Editor manually after you've decided
-- you really want this. Wrapped in BEGIN/COMMIT so a partial
-- failure rolls back cleanly.
--
-- KEPT:    auth.users, profiles rows (so existing logins still work)
-- WIPED:   chats, messages, transactions, inference_receipts,
--          receipt_batches; profiles.credits_balance reset to 0
-- MANUAL:  files in storage bucket 'chat-attachments' must be
--          deleted from Supabase Studio → Storage (or via API).
-- ============================================================

begin;

-- Sanity guards: refuse to run if the wipe would also touch the
-- production org by accident. Comment these out to actually run.
-- do $$ begin raise notice 'About to wipe %, %, %, %, %, profiles balances',
--   (select count(*) from chats), (select count(*) from messages),
--   (select count(*) from transactions), (select count(*) from inference_receipts),
--   (select count(*) from receipt_batches); end $$;

delete from inference_receipts;
delete from receipt_batches;
delete from messages;
delete from chats;
delete from transactions;
update profiles set credits_balance = 0;

commit;

-- Verify (run separately after commit):
-- select 'chats' as t, count(*) from chats union all
-- select 'messages',           count(*) from messages union all
-- select 'transactions',       count(*) from transactions union all
-- select 'inference_receipts', count(*) from inference_receipts union all
-- select 'receipt_batches',    count(*) from receipt_batches union all
-- select 'nonzero_balances',   count(*) from profiles where credits_balance <> 0;
