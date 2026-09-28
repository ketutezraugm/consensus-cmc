-- Rate-limits free-text (LLM-backed) Telegram messages per chat, so one chat can't run up Anthropic
-- API cost. Insert-only; lib/ratelimit.ts counts rows in a recent window before allowing a call.
-- ponytail: no retention/cleanup job — add a daily delete-older-than-1-day cron if this table grows.
create table if not exists chat_events (
  id         bigint generated always as identity primary key,
  chat_id    bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_events_chat_id_created_at_idx on chat_events (chat_id, created_at desc);
alter table chat_events enable row level security;
