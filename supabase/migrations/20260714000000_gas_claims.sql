-- ============================================================
-- Gas faucet claims
-- ------------------------------------------------------------
-- Community voters need exactly 0.001 0G to 5x their vote. The /gas page lets
-- them claim it once per wallet. This table enforces one-claim-per-address (the
-- unique constraint) and records the payout tx.
--
-- Written ONLY by the server (service-role client in /api/gas). RLS is enabled
-- with no policies, so it is completely inaccessible to browser/anon clients.
-- ============================================================

create table if not exists public.gas_claims (
  id         uuid primary key default gen_random_uuid(),
  address    text not null unique,            -- checksummed wallet address
  tx_hash    text,                            -- payout tx (null until sent)
  ip         text,                            -- best-effort, for abuse triage
  amount     numeric not null default 0.001,  -- 0G sent
  created_at timestamptz not null default now()
);

alter table public.gas_claims enable row level security;
-- No policies on purpose: only the service-role key may read/write this table.
