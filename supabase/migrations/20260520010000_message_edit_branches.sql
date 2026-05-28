-- ============================================================
-- Preserve old branches when a user message is edited.
-- Instead of deleting the prior conversation tail, soft-delete it
-- and keep a pointer (replaces_id) from the new user message to the
-- original one it superseded. This lets the UI show "view previous
-- version" without losing history (or receipts) for past attempts.
-- ============================================================

alter table messages
  add column if not exists deleted_at timestamptz,
  add column if not exists replaces_id uuid references messages(id) on delete set null;

create index if not exists idx_messages_chat_active
  on messages(chat_id, created_at asc)
  where deleted_at is null;

create index if not exists idx_messages_replaces
  on messages(replaces_id)
  where replaces_id is not null;

-- ============================================================
-- RPC: atomically supersede a user message + its downstream tail.
-- Soft-deletes everything from p_message_id onward (by created_at)
-- in the same chat and returns the deleted ids so the client can
-- reconcile its optimistic state. The caller then inserts the new
-- user message with replaces_id = p_message_id.
-- ============================================================
create or replace function supersede_message(p_message_id uuid)
returns table (deleted_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id    uuid;
  v_created_at timestamptz;
begin
  select m.chat_id, m.created_at
    into v_chat_id, v_created_at
  from messages m
  join chats c on c.id = m.chat_id
  where m.id = p_message_id
    and c.user_id = auth.uid()
    and m.deleted_at is null;

  if v_chat_id is null then
    raise exception 'Message not found or not owned by caller';
  end if;

  return query
  update messages
     set deleted_at = now()
   where chat_id = v_chat_id
     and created_at >= v_created_at
     and deleted_at is null
  returning id;
end;
$$;

grant execute on function supersede_message(uuid) to authenticated;
