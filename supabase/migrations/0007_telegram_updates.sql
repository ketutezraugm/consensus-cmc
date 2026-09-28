-- De-duplicates Telegram webhook deliveries. Telegram retries an update if it doesn't get a timely
-- 200 response (e.g. a slow model call approaching the function's time limit), which would otherwise
-- run the same message through the bot — and the agent's Gemini calls — a second time.
-- ponytail: no retention/cleanup, matching chat_events (0006) — add a cron if this grows large.
create table if not exists telegram_updates (
  update_id  bigint primary key,
  created_at timestamptz not null default now()
);
alter table telegram_updates enable row level security;
