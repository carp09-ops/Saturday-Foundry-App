-- Saturday Foundry: atomic rollover with explicitly confirmed coach programs.
-- Stage/test this in a disposable database before applying to production.
-- The old carry-forward RPC is disabled for browser users to prevent bypassing confirmation.
create or replace function public.create_next_season_with_programs(
  p_dynasty_id uuid,
  p_expected_season_id uuid,
  p_year integer,
  p_assignments jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $rollover$
declare
  v_old uuid;
  v_next integer;
  v_new uuid;
  v_coaches integer;
  v_memberships integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_dynasty(p_dynasty_id) then raise exception 'Commissioner access required'; end if;
  -- Serializes simultaneous attempts within a dynasty, including confirmation retries.
  perform pg_advisory_xact_lock(hashtextextended(p_dynasty_id::text,0));
  select s.id into v_old
    from public.seasons s
    where s.dynasty_id=p_dynasty_id and s.status='active'
    for update;
  if v_old is null then raise exception 'No active season'; end if;
  if v_old is distinct from p_expected_season_id then
    raise exception 'The active season changed. Reload the league before trying again';
  end if;
  if p_year is not null and (p_year < 2020 or p_year > 2100) then
    raise exception 'Invalid season year';
  end if;
  if jsonb_typeof(p_assignments) is distinct from 'array' then
    raise exception 'Program choices are required';
  end if;
  select count(distinct pm.person_id),count(*)
    into v_coaches,v_memberships
    from public.program_memberships pm
    join public.season_programs sp on sp.id=pm.season_program_id
    where pm.season_id=v_old and sp.active;
  if v_coaches=0 or v_memberships<>v_coaches then
    raise exception 'Each active coach must have one existing program';
  end if;
  if jsonb_array_length(p_assignments)<>v_coaches then
    raise exception 'Confirm one program for every active coach';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_assignments) a
    where jsonb_typeof(a) is distinct from 'object'
      or a->>'confirmed' is distinct from 'true'
      or nullif(a->>'person_id','') is null
      or nullif(a->>'team_id','') is null
  ) then raise exception 'Every coach must explicitly confirm a program'; end if;
  if (select count(distinct a->>'person_id') from jsonb_array_elements(p_assignments) a)<>v_coaches
     or (select count(distinct a->>'team_id') from jsonb_array_elements(p_assignments) a)<>v_coaches
  then raise exception 'Duplicate coach or team assignment'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
    left join public.program_memberships pm on pm.person_id=a.person_id and pm.season_id=v_old
    left join public.season_programs sp on sp.id=pm.season_program_id and sp.active
    left join public.teams t on t.id=a.team_id and t.active and coalesce(t.selectable,true)
    where pm.person_id is null or sp.id is null or t.id is null
  ) then raise exception 'Invalid coach or destination team'; end if;

  select coalesce(max(s.season_number),0)+1 into v_next from public.seasons s
  where s.dynasty_id=p_dynasty_id;
  -- All writes below are one PostgreSQL transaction. Any error restores the old season.
  update public.seasons set status='completed',completed_at=coalesce(completed_at,now())
    where id=v_old;
  insert into public.seasons(dynasty_id,season_number,year,name,status,started_at)
    values(p_dynasty_id,v_next,p_year,'Season '||v_next,'active',now())
    returning id into v_new;
  -- Retain active programs and conference overrides (including CPU teams).
  insert into public.season_programs(dynasty_id,season_id,team_id,active,conference_override)
    select p_dynasty_id,v_new,sp.team_id,true,sp.conference_override
    from public.season_programs sp where sp.season_id=v_old and sp.active
    on conflict do nothing;
  -- Add any new school selections, including Florida and West Virginia.
  insert into public.season_programs(dynasty_id,season_id,team_id,active)
    select p_dynasty_id,v_new,a.team_id,true
    from jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
    on conflict do nothing;
  -- Transfer each coach exactly once; their old season memberships remain intact.
  insert into public.program_memberships(season_program_id,person_id,role,dynasty_id,season_id)
    select newsp.id,oldpm.person_id,oldpm.role,p_dynasty_id,v_new
    from public.program_memberships oldpm
    join jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
      on a.person_id=oldpm.person_id
    join public.season_programs newsp on newsp.season_id=v_new and newsp.team_id=a.team_id
    where oldpm.season_id=v_old;
  if (select count(*) from public.program_memberships where season_id=v_new)<>v_coaches then
    raise exception 'Incomplete coach assignments; season change cancelled';
  end if;
  -- Record program transfers in the existing coaching carousel / career ledger.
  -- Staying with the same school does not create a transfer event.
  insert into public.coach_program_moves(
    dynasty_id,season_id,person_id,from_season_program_id,from_team_id,
    to_season_program_id,to_team_id,reason,moved_by)
    select p_dynasty_id,v_new,a.person_id,oldsp.id,oldsp.team_id,
      newsp.id,a.team_id,'Season rollover',auth.uid()
    from jsonb_to_recordset(p_assignments) as a(person_id uuid,team_id uuid)
    join public.program_memberships oldpm on oldpm.person_id=a.person_id and oldpm.season_id=v_old
    join public.season_programs oldsp on oldsp.id=oldpm.season_program_id and oldsp.active
    join public.season_programs newsp on newsp.season_id=v_new and newsp.team_id=a.team_id
    where oldsp.team_id is distinct from a.team_id;
  insert into public.dynasty_settings(dynasty_id,settings,updated_at)
    values(p_dynasty_id,jsonb_build_object('active_week',1),now())
    on conflict(dynasty_id) do update
      set settings=coalesce(public.dynasty_settings.settings,'{}'::jsonb)
          ||jsonb_build_object('active_week',1),updated_at=now();
  return v_new;
end;
$rollover$;

revoke all on function public.create_next_season_with_programs(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.create_next_season_with_programs(uuid,uuid,integer,jsonb) to authenticated;

-- Block the old auto-carry endpoint for signed-in clients. Cached legacy UI fails safely.
revoke execute on function public.create_next_season(uuid,integer,boolean) from public,anon,authenticated;
