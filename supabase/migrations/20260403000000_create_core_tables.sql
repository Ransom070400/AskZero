-- ============================================================
-- AskZero core schema: profiles, transactions, chats, messages
-- ============================================================

-- ---------- enums ----------
create type transaction_type   as enum ('deposit', 'usage', 'refund');
create type transaction_status as enum ('pending', 'completed', 'failed');
create type currency_code      as enum ('NGN', 'USD', '0G');
create type message_role       as enum ('user', 'assistant', 'system');

-- ---------- profiles ----------
create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  display_name    text not null default '',
  avatar_url      text,
  credits_balance numeric not null default 0,  -- stored in USD cents
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- transactions ----------
create table transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  type            transaction_type not null,
  amount          numeric not null,              -- positive = credit, negative = debit
  currency        currency_code not null default 'USD',
  original_amount numeric not null default 0,    -- amount in original currency
  reference       text unique,                   -- payment provider reference
  status          transaction_status not null default 'pending',
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ---------- chats ----------
create table chats (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  title           text not null default 'New Chat',
  model           text not null default 'default',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- messages ----------
create table messages (
  id              uuid primary key default gen_random_uuid(),
  chat_id         uuid not null references chats(id) on delete cascade,
  role            message_role not null,
  content         text not null,
  token_count     integer,
  cost_credits    numeric,                       -- cost in credits for this message
  created_at      timestamptz not null default now()
);

-- ---------- indexes ----------
create index idx_transactions_user   on transactions(user_id, created_at desc);
create index idx_chats_user          on chats(user_id, updated_at desc);
create index idx_messages_chat       on messages(chat_id, created_at asc);

-- ---------- updated_at trigger ----------
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trg_chats_updated_at
  before update on chats
  for each row execute function update_updated_at();

-- ---------- auto-create profile on signup ----------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles     enable row level security;
alter table transactions enable row level security;
alter table chats        enable row level security;
alter table messages     enable row level security;

-- profiles: users can read/update only their own row
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- transactions: users can read their own transactions
create policy "Users can view own transactions"
  on transactions for select using (auth.uid() = user_id);

-- chats: full CRUD on own chats
create policy "Users can view own chats"
  on chats for select using (auth.uid() = user_id);

create policy "Users can create own chats"
  on chats for insert with check (auth.uid() = user_id);

create policy "Users can update own chats"
  on chats for update using (auth.uid() = user_id);

create policy "Users can delete own chats"
  on chats for delete using (auth.uid() = user_id);

-- messages: users can read/insert messages in their own chats
create policy "Users can view messages in own chats"
  on messages for select
  using (exists (select 1 from chats where chats.id = messages.chat_id and chats.user_id = auth.uid()));

create policy "Users can insert messages in own chats"
  on messages for insert
  with check (exists (select 1 from chats where chats.id = messages.chat_id and chats.user_id = auth.uid()));

-- ============================================================
-- Atomic credit deduction function (prevents race conditions)
-- ============================================================
create or replace function deduct_credits(
  p_user_id  uuid,
  p_amount   numeric,   -- positive number to deduct
  p_metadata jsonb default '{}'
)
returns numeric as $$
declare
  v_new_balance numeric;
begin
  -- Atomically deduct and return new balance; lock the row
  update profiles
  set credits_balance = credits_balance - p_amount
  where id = p_user_id
    and credits_balance >= p_amount
  returning credits_balance into v_new_balance;

  if not found then
    raise exception 'Insufficient credits';
  end if;

  -- Log the transaction
  insert into transactions (user_id, type, amount, currency, original_amount, status, metadata)
  values (p_user_id, 'usage', -p_amount, 'USD', p_amount, 'completed', p_metadata);

  return v_new_balance;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Add credits function
-- ============================================================
create or replace function add_credits(
  p_user_id         uuid,
  p_amount          numeric,   -- amount in USD cents to add
  p_currency        currency_code,
  p_original_amount numeric,
  p_reference       text
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

  insert into transactions (user_id, type, amount, currency, original_amount, reference, status)
  values (p_user_id, 'deposit', p_amount, p_currency, p_original_amount, p_reference, 'completed');

  return v_new_balance;
end;
$$ language plpgsql security definer;
