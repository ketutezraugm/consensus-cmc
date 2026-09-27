-- Telegram chats that receive automatic alert pushes. An empty symbols array means "all tracked
-- assets" (the previous single-chat behaviour); a non-empty array filters pushes to just those.
create table if not exists subscribers (
  chat_id    bigint primary key,
  symbols    text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table subscribers enable row level security;
