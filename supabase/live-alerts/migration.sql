-- Saturday Foundry — live stream alerts backend (companion to app 10.1.41+)
-- Run this once in the Supabase SQL editor. Safe to re-run.
--
-- What it creates:
--   coach_live_status  — one row per coach per dynasty: is_live + stream title/url
--   v_coach_live       — the view the app reads (dynasty_id, person_id, coach_name, ...)
-- The app already reads v_coach_live on every season load; until this runs it
-- simply finds nothing and shows no LIVE UI. The stream-live-check Edge
-- Function (../functions/stream-live-check) keeps the table current.

create table if not exists public.coach_live_status (
  dynasty_id  uuid not null,
  person_id   uuid not null,
  is_live     boolean not null default false,
  live_title  text,
  live_url    text,
  started_at  timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (dynasty_id, person_id)
);

alter table public.coach_live_status enable row level security;

-- Live status is public by design (it points at a public stream), so any
-- signed-in league member may read it. Writes happen only through the
-- service role (the checker function), which bypasses RLS.
drop policy if exists "members read live status" on public.coach_live_status;
create policy "members read live status"
  on public.coach_live_status for select to authenticated using (true);

create or replace view public.v_coach_live as
select s.dynasty_id,
       s.person_id,
       s.is_live,
       s.live_title,
       s.live_url,
       s.started_at,
       (select max(p.coach_name)
          from public.v_season_programs p
         where p.dynasty_id = s.dynasty_id and p.person_id = s.person_id) as coach_name
  from public.coach_live_status s;

grant select on public.v_coach_live to authenticated;

-- ---------------------------------------------------------------------------
-- Channels the checker watches. Streams live on public.people (one channel
-- per person; the set_coach_stream RPC writes there) and v_season_programs
-- supplies the dynasty/person mapping. This ran as-is on 2026-10-30.
-- ---------------------------------------------------------------------------
create or replace view public.v_stream_channels as
select distinct sp.dynasty_id, sp.person_id, p.stream_platform as platform, p.stream_url
  from public.v_season_programs sp
  join public.people p on p.id = sp.person_id
 where p.stream_url is not null and p.stream_url <> '';

grant select on public.v_stream_channels to authenticated;

-- ---------------------------------------------------------------------------
-- Optional: schedule the checker every 5 minutes (requires pg_cron + pg_net).
-- Replace PROJECT_REF and use the service role key as the bearer token, or
-- schedule the same POST from the dashboard's Cron UI instead.
-- ---------------------------------------------------------------------------
-- select cron.schedule('stream-live-check', '*/5 * * * *',
--   $$ select net.http_post(
--        url := 'https://PROJECT_REF.supabase.co/functions/v1/stream-live-check',
--        headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
--        body := '{}'::jsonb) $$);

-- ---------------------------------------------------------------------------
-- Manual test (see it light up in the app before wiring the checker):
-- flip Corey live in WE'RE SO BACK, reload the app, check THE LINE ticker
-- and Florida's game card. Then set is_live back to false.
-- ---------------------------------------------------------------------------
-- insert into public.coach_live_status (dynasty_id, person_id, is_live, live_title)
-- values ('cc811993-dde0-46e4-94f6-d9696f8fcd3d',  -- WE'RE SO BACK
--         'PERSON_ID_OF_THE_COACH'::uuid,
--         true, 'Test stream')
-- on conflict (dynasty_id, person_id)
-- do update set is_live = excluded.is_live, live_title = excluded.live_title, updated_at = now();
