-- Saturday Foundry — stream-title league matching (companion to the
-- title-aware stream-live-check; Corey's call, 2026-11-02)
-- Run this once in the Supabase SQL editor, AFTER migration.sql. Safe to
-- re-run. No table changes — it only recreates v_stream_channels.
--
-- Coaches put their team name in the stream title. To show a stream only in
-- the league it belongs to, the checker needs to know each coach's team in
-- each dynasty's ACTIVE season. This view gains team_name / team_slug /
-- abbreviation columns, sourced from the active season's program rows (one
-- team per coach per dynasty — older seasons no longer multiply rows).

create or replace view public.v_stream_channels as
select distinct sp.dynasty_id, sp.person_id, p.stream_platform as platform, p.stream_url,
       sp.team_name, sp.team_slug, sp.abbreviation
  from public.v_season_programs sp
  join public.v_dynasty_seasons ds
    on ds.season_id = sp.season_id and ds.is_active
  join public.people p on p.id = sp.person_id
 where p.stream_url is not null and p.stream_url <> '';

grant select on public.v_stream_channels to authenticated;
