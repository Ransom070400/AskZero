-- ============================================================
-- Artifacts: structured outputs surfaced from assistant messages.
-- One assistant message can produce multiple artifacts (rare),
-- and an artifact can be revised across turns — `parent_artifact_id`
-- links revisions, `version` numbers them within a chain.
-- ============================================================

create type artifact_type as enum ('code', 'markdown', 'html', 'svg', 'mermaid', 'react');

create table artifacts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  chat_id            uuid not null references chats(id) on delete cascade,
  message_id         uuid not null references messages(id) on delete cascade,

  type               artifact_type not null,
  title              text not null default '',
  language           text,                          -- e.g. 'typescript', null for non-code
  content            text not null,

  version            integer not null default 1,
  parent_artifact_id uuid references artifacts(id) on delete set null,

  created_at         timestamptz not null default now()
);

create index idx_artifacts_user    on artifacts(user_id, created_at desc);
create index idx_artifacts_chat    on artifacts(chat_id, created_at desc);
create index idx_artifacts_message on artifacts(message_id);
create index idx_artifacts_parent  on artifacts(parent_artifact_id);

alter table artifacts enable row level security;

create policy "Users can view own artifacts"
  on artifacts for select using (auth.uid() = user_id);

-- ============================================================
-- record_artifact: trusted insert callable from authenticated
-- routes. Mirrors record_receipt — verifies caller owns the chat.
-- ============================================================
create or replace function record_artifact(
  p_chat_id            uuid,
  p_message_id         uuid,
  p_type               artifact_type,
  p_title              text,
  p_language           text,
  p_content            text,
  p_parent_artifact_id uuid default null
)
returns uuid as $$
declare
  v_user_id     uuid;
  v_version     integer := 1;
  v_artifact_id uuid;
begin
  select user_id into v_user_id from chats where id = p_chat_id;
  if not found or v_user_id <> auth.uid() then
    raise exception 'Chat not found or unauthorized';
  end if;

  if p_parent_artifact_id is not null then
    select coalesce(max(version), 0) + 1
      into v_version
      from artifacts
      where parent_artifact_id = p_parent_artifact_id
         or id = p_parent_artifact_id;
  end if;

  insert into artifacts (
    user_id, chat_id, message_id, type, title, language, content,
    version, parent_artifact_id
  )
  values (
    v_user_id, p_chat_id, p_message_id, p_type, p_title, p_language, p_content,
    v_version, p_parent_artifact_id
  )
  returning id into v_artifact_id;

  return v_artifact_id;
end;
$$ language plpgsql security definer;
