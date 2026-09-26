-- Runs every 30 minutes inside your Supabase database and calls the ingest endpoint.
-- Replace YOUR_INGEST_SECRET with your INGEST_SECRET before running.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('consensus-ingest') where exists (select 1 from cron.job where jobname = 'consensus-ingest');

select cron.schedule('consensus-ingest', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://consensus-cmc.vercel.app/api/ingest',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_INGEST_SECRET'),
    timeout_milliseconds := 60000
  );
$$);

-- Check it later with:
--   select jobname, schedule, active from cron.job;
--   select status, created from net._http_response order by created desc limit 5;
