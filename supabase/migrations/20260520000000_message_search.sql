-- ============================================================
-- Full-text search over message content
-- ============================================================

-- Generated tsvector column (stored, English config). Generated columns can't
-- be GIN-indexed directly via CREATE INDEX on the expression in some pg
-- versions, so we materialize it as STORED and index that.
alter table messages
  add column if not exists content_search tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists idx_messages_content_fts
  on messages using gin(content_search);

-- Search RPC: returns matching messages with chat title + snippet, scoped
-- to the calling user via auth.uid(). SECURITY DEFINER so we can still
-- enforce ownership via an explicit chats.user_id check rather than
-- depending on RLS for cross-table joins.
create or replace function search_messages(p_query text, p_limit int default 20)
returns table (
  message_id   uuid,
  chat_id      uuid,
  chat_title   text,
  role         message_role,
  snippet      text,
  created_at   timestamptz,
  rank         real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.chat_id,
    c.title,
    m.role,
    ts_headline(
      'english',
      m.content,
      websearch_to_tsquery('english', p_query),
      'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=18,MinWords=6'
    ) as snippet,
    m.created_at,
    ts_rank(m.content_search, websearch_to_tsquery('english', p_query)) as rank
  from messages m
  join chats c on c.id = m.chat_id
  where c.user_id = auth.uid()
    and m.content_search @@ websearch_to_tsquery('english', p_query)
  order by rank desc, m.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

grant execute on function search_messages(text, int) to authenticated;
