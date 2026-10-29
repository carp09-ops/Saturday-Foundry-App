-- Atomic season rollover with explicit assignments for every active coach.
-- Not applied to production by this PR.
create or replace function public.create_next_season_with_programs(
 p_dynasty_id uuid, p_year integer, p_assignments jsonb
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_old uuid; v_next integer; v_new uuid; v_expected integer; v_actual integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not private.can_manage_dynasty(p_dynasty_id) then raise exception 'Commissioner access required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_dynasty_id::text, 0));
 select id,season_number into v_old,v_next from public.seasons
 where dynasty_id=p_dynasty_id and status='active' for update;
 if v_old is null then raise exception 'No active season'; end if;
 if jsonb_typeof(p_assignments) is distinct from 'array' then raise exception 'Program assignments required'; end if;
 select count(distinct pm.person_id) into v_expected from public.program_memberships pm
 join public.season_programs sp on sp.id=pm.season_program_id
 where pm.season_id=v_old and sp.active=true;
 select count(*) into v_actual from jsonb_array_elements(p_assignments) a;
 if v_actual<>v_expected or exists(
   select 1 from jsonb_array_elements(p_assignments) a
   where not (a ? 'person_id' and a ? 'team_id')
 ) then raise exception 'Every active coach must confirm a program'; end if;
 if exists(select 1 from jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
 group by person_id having count(*)>1) or exists(
 select 1 from jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
 group by team_id having count(*)>1) then raise exception 'Duplicate coach or team assignment'; end if;
 if exists(
 select 1 from jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
 left join public.program_memberships pm on pm.person_id=a.person_id and pm.season_id=v_old
 left join public.season_programs sp on sp.id=pm.season_program_id and sp.active=true
 where pm.id is null or sp.id is null or a.team_id is null
 ) then raise exception 'Assignments must match active coaches'; end if;
 if exists(select 1 from jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
 left join public.teams t on t.id=a.team_id where t.id is null) then raise exception 'Unknown destination team'; end if;
 v_next:=v_next+1;
 update public.seasons set status='completed',completed_at=coalesce(completed_at,now()) where id=v_old;
 insert into public.seasons(dynasty_id,season_number,year,name,status,started_at)
 values(p_dynasty_id,v_next,p_year,'Season '||v_next,'active',now()) returning id into v_new;
 -- Keep all active programs, including CPU programs, except programs vacated by transferring coaches.
 insert into public.season_programs(dynasty_id,season_id,team_id,active,conference_override)
 select p_dynasty_id,v_new,sp.team_id,true,sp.conference_override from public.season_programs sp
 where sp.season_id=v_old and sp.active=true on conflict do nothing;
 -- Add destinations not already in the season. Preserve existing conference override for retained programs.
 insert into public.season_programs(dynasty_id,season_id,team_id,active)
 select p_dynasty_id,v_new,a.team_id,true from jsonb_to_recordset(p_assignments) a(person_id uuid,team_id uuid)
 on conflict do nothing;
 insert into public.program_memberships(season_program_id,person_id,role,dynasty_id,season_id)
 select new_sp.id,pm.person_id,pm.role,p_dynasty_id,v_new
 from public.program_memberships pm
 join jsonb_to_recordset(p_assignments) a(person_id uuid,team_id uuid) on a.person_id=pm.person_id
 join public.season_programs new_sp on new_sp.season_id=v_new and new_sp.team_id=a.team_id
 where pm.season_id=v_old on conflict do nothing;
 insert into public.dynasty_settings(dynasty_id,settings,updated_at)
 values(p_dynasty_id,jsonb_build_object('active_week',1),now())
 on conflict(dynasty_id) do update set settings=coalesce(public.dynasty_settings.settings,'{}'::jsonb)||jsonb_build_object('active_week',1),updated_at=now();
 return v_new;
end;$fn$;
revoke all on function public.create_next_season_with_programs(uuid,integer,jsonb) from public,anon;
grant execute on function public.create_next_season_with_programs(uuid,integer,jsonb) to authenticated;
