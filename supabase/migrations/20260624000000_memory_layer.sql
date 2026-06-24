-- ============================================================
-- Memory layer.
--
-- Two artifacts per "commit" (one per assistant turn we decide is
-- worth remembering):
--   * memories      — distilled, durable facts about the user, with a
--                     vector embedding for semantic recall. This is the
--                     fast, searchable INDEX.
--   * chat_archives — the canonical store-of-record lives on 0G Storage;
--                     this row just pins the content-addressed root hash.
--
-- 0G Storage holds the canonical blob ({ memories, chat }); Postgres is a
-- rebuildable mirror. Every memory row carries the og_root_hash of the
-- blob it was committed in, so any memory is provable against 0G.
-- ============================================================

create extension if not exists vector;

-- ---------- chat_archives ----------
-- One row per memory commit: the full conversation snapshot stored on 0G.
create table chat_archives (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  chat_id       uuid not null references chats(id) on delete cascade,
  og_root_hash  text not null,                 -- 0G Storage content id (content-addressed)
  og_tx_hash    text,                          -- upload tx (null if storage was unavailable)
  message_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_archives_user on chat_archives(user_id, created_at desc);
create index idx_archives_chat on chat_archives(chat_id, created_at desc);

-- ---------- memories ----------
-- 1536 dims matches text-embedding-3-small / ada-002 (the OpenAI-compatible
-- default). Nullable so a memory can still be stored when no embedding model
-- is configured — recall then falls back to recency.
create table memories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  content       text not null,
  embedding     vector(1536),
  source_chat_id uuid references chats(id) on delete set null,
  og_root_hash  text,                          -- 0G blob this memory was committed in
  created_at    timestamptz not null default now()
);

create index idx_memories_user on memories(user_id, created_at desc);
-- IVFFlat cosine index for semantic recall. Built once; fine for our scale.
create index idx_memories_embedding on memories
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table memories      enable row level security;
alter table chat_archives enable row level security;

create policy "Users can view own memories"
  on memories for select using (auth.uid() = user_id);

create policy "Users can delete own memories"
  on memories for delete using (auth.uid() = user_id);

create policy "Users can view own archives"
  on chat_archives for select using (auth.uid() = user_id);

-- Writes go through the service-role server routes (security definer RPCs
-- below), so no insert policies for the anon/authenticated roles.

-- ============================================================
-- Semantic recall: top-K of the CALLER's memories by cosine similarity.
-- The embedding is passed as a text literal ("[0.1,...]") and cast inside,
-- which is more robust over PostgREST than a vector-typed argument. Falls
-- back to recency when no embedding is supplied (e.g. the embedding model is
-- unconfigured) so recall always returns something. Scoped to auth.uid().
-- ============================================================
create or replace function match_memories(
  p_embedding text,
  p_limit     integer default 6
)
returns table (
  id           uuid,
  content      text,
  similarity   float,
  created_at   timestamptz
) as $$
declare
  v_user_id uuid := auth.uid();
  v_vec     vector(1536);
begin
  if v_user_id is null then
    return;
  end if;

  if p_embedding is null then
    return query
      select m.id, m.content, 0::float as similarity, m.created_at
      from memories m
      where m.user_id = v_user_id
      order by m.created_at desc
      limit p_limit;
  else
    v_vec := p_embedding::vector(1536);
    return query
      select m.id, m.content,
             1 - (m.embedding <=> v_vec) as similarity,
             m.created_at
      from memories m
      where m.user_id = v_user_id
        and m.embedding is not null
      order by m.embedding <=> v_vec
      limit p_limit;
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Insert a distilled memory for the CALLER. Embedding passed as a text
-- literal (cast inside) or NULL. Returns the new row id.
-- ============================================================
create or replace function record_memory(
  p_content        text,
  p_embedding      text,
  p_source_chat_id uuid,
  p_og_root_hash   text
)
returns uuid as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into memories (user_id, content, embedding, source_chat_id, og_root_hash)
  values (
    v_user_id,
    p_content,
    case when p_embedding is null then null else p_embedding::vector(1536) end,
    p_source_chat_id,
    p_og_root_hash
  )
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Pin a 0G archive blob for one of the caller's chats.
-- ============================================================
create or replace function record_chat_archive(
  p_chat_id       uuid,
  p_og_root_hash  text,
  p_og_tx_hash    text,
  p_message_count integer
)
returns uuid as $$
declare
  v_user_id uuid := auth.uid();
  v_owner   uuid;
  v_id      uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select user_id into v_owner from chats where id = p_chat_id;
  if not found or v_owner <> v_user_id then
    raise exception 'Chat not found or unauthorized';
  end if;

  insert into chat_archives (user_id, chat_id, og_root_hash, og_tx_hash, message_count)
  values (v_user_id, p_chat_id, p_og_root_hash, p_og_tx_hash, p_message_count)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;
