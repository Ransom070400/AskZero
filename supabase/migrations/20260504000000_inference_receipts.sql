-- ============================================================
-- Inference receipts: per-message commitments that get
-- batched into Merkle roots and anchored on-chain.
-- ============================================================

create type receipt_status as enum ('pending', 'batched', 'anchored');
create type batch_status   as enum ('pending', 'submitted', 'confirmed', 'failed');

-- ---------- inference_receipts ----------
create table inference_receipts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  chat_id         uuid not null references chats(id) on delete cascade,
  message_id      uuid not null references messages(id) on delete cascade,

  provider        text not null,                 -- e.g. 'integrate:glm-5.1'
  model           text not null,
  input_hash      text not null,                 -- 0x-prefixed keccak256
  output_hash     text not null,
  input_tokens    integer not null,
  output_tokens   integer not null,
  cost_credits    numeric not null,
  tee_attestation text,                          -- null when provider has no TEE proof
  nonce           text not null,                 -- 0x-prefixed 32-byte hex
  receipt_hash    text not null unique,          -- canonical hash, this is the Merkle leaf

  status          receipt_status not null default 'pending',

  -- batch / anchor metadata, filled in by the batcher
  batch_id        uuid,
  merkle_proof    jsonb,                         -- array of sibling hashes
  leaf_index      integer,

  created_at      timestamptz not null default now()
);

create index idx_receipts_user    on inference_receipts(user_id, created_at desc);
create index idx_receipts_pending on inference_receipts(created_at) where status = 'pending';
create index idx_receipts_message on inference_receipts(message_id);
create index idx_receipts_batch   on inference_receipts(batch_id);

-- ---------- receipt_batches ----------
create table receipt_batches (
  id              uuid primary key default gen_random_uuid(),
  merkle_root     text not null unique,          -- 0x-prefixed
  leaf_count      integer not null,
  from_ts         timestamptz not null,
  to_ts           timestamptz not null,

  chain_id        integer not null,
  contract_addr   text not null,
  tx_hash         text,                          -- null until submitted
  block_number    bigint,
  status          batch_status not null default 'pending',

  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz
);

create index idx_batches_status on receipt_batches(status);

alter table inference_receipts
  add constraint fk_receipts_batch
  foreign key (batch_id) references receipt_batches(id) on delete set null;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table inference_receipts enable row level security;
alter table receipt_batches    enable row level security;

-- Users can read their own receipts; writes happen via service role (server route).
create policy "Users can view own receipts"
  on inference_receipts for select using (auth.uid() = user_id);

-- Batches are world-readable: the whole point is public verifiability.
create policy "Anyone can view receipt batches"
  on receipt_batches for select to authenticated using (true);

-- ============================================================
-- Insert helper: callers only need to own the chat. Mirrors the
-- deduct_credits pattern so we don't need a service-role client.
-- ============================================================
create or replace function record_receipt(
  p_chat_id         uuid,
  p_message_id      uuid,
  p_provider        text,
  p_model           text,
  p_input_hash      text,
  p_output_hash     text,
  p_input_tokens    integer,
  p_output_tokens   integer,
  p_cost_credits    numeric,
  p_tee_attestation text,
  p_nonce           text,
  p_receipt_hash    text
)
returns uuid as $$
declare
  v_user_id    uuid;
  v_receipt_id uuid;
begin
  select user_id into v_user_id from chats where id = p_chat_id;
  if not found or v_user_id <> auth.uid() then
    raise exception 'Chat not found or unauthorized';
  end if;

  insert into inference_receipts (
    user_id, chat_id, message_id, provider, model,
    input_hash, output_hash, input_tokens, output_tokens, cost_credits,
    tee_attestation, nonce, receipt_hash
  )
  values (
    v_user_id, p_chat_id, p_message_id, p_provider, p_model,
    p_input_hash, p_output_hash, p_input_tokens, p_output_tokens, p_cost_credits,
    p_tee_attestation, p_nonce, p_receipt_hash
  )
  returning id into v_receipt_id;

  return v_receipt_id;
end;
$$ language plpgsql security definer;
