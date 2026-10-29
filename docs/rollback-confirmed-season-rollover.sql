-- Emergency API rollback only. No season records are changed by this script.
-- Use ONLY if the 10.1.0 frontend is reverted to the legacy release.
-- Re-enabling the old carry-forward endpoint brings back the old rollover behavior.
drop function if exists public.create_next_season_with_programs(uuid,uuid,integer,jsonb);
grant execute on function public.create_next_season(uuid,integer,boolean) to authenticated;
