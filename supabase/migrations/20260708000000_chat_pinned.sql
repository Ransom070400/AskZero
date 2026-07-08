-- Pinned chats: pinned rows sort to the top of the sidebar.
alter table chats add column if not exists pinned boolean not null default false;
create index if not exists idx_chats_pinned on chats (user_id, pinned, updated_at desc);
