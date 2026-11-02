-- Saturday Foundry — recent broadcasts (companion to app 10.1.50)
-- Run this once in the Supabase SQL editor, AFTER migration.sql. Safe to re-run.
--
-- What it adds:
--   coach_live_status gains last_* columns. When a stream ends, the checker
--   (stream-live-check) copies the just-finished broadcast into them instead
--   of forgetting it, so the Watch tab can show each coach's most recent
--   broadcast with a replay link after they go offline.
--   v_coach_live is recreated to expose the new columns to the app.

alter table public.coach_live_status
  add column if not exists last_title      text,
  add column if not exists last_url        text,
  add column if not exists last_started_at timestamptz,
  add column if not exists last_ended_at   timestamptz;

create or replace view public.v_coach_live as
select s.dynasty_id,
       s.person_id,
       s.is_live,
       s.live_title,
       s.live_url,
       s.started_at,
       s.last_title,
       s.last_url,
       s.last_started_at,
       s.last_ended_at,
       (select max(p.coach_name)
          from public.v_season_programs p
         where p.dynasty_id = s.dynasty_id and p.person_id = s.person_id) as coach_name
  from public.coach_live_status s;

grant select on public.v_coach_live to authenticated;
