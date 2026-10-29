-- Atomic coach selections for a new season; apply only after isolated testing.
create or replace function public.create_next_season_confirmed(p_dynasty_id uuid,p_year integer,p_assignments jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare old_id uuid; new_id uuid; next_no int; expected int; item jsonb; program_id uuid;
begin
 if auth.uid() is null or not private.can_manage_dynasty(p_dynasty_id) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_dynasty_id::text,0));
 select id into old_id from public.seasons where dynasty_id=p_dynasty_id and status='active' for update;
 if old_id is null then raise exception 'No active season'; end if;
 select count(distinct person_id) into expected from public.program_memberships where season_id=old_id;
 if jsonb_typeof(p_assignments) is distinct from 'array' or jsonb_array_length(p_assignments)<>expected then raise exception 'Confirm all coaches'; end if;
 if (select count(distinct x->>'person_id') from jsonb_array_elements(p_assignments) x)<>expected or
    (select count(distinct x->>'team_id') from jsonb_array_elements(p_assignments) x)<>expected then raise exception 'Duplicate assignments'; end if;
 if exists(select 1 from jsonb_array_elements(p_assignments) x where
    not exists(select 1 from public.program_memberships m where m.season_id=old_id and m.person_id=(x->>'person_id')::uuid))
 then raise exception 'Unknown coach'; end if;
 select coalesce(max(season_number),0)+1 into next_no from public.seasons where dynasty_id=p_dynasty_id;
 update public.seasons set status='completed',completed_at=coalesce(completed_at,now()) where id=old_id;
 insert into public.seasons(dynasty_id,season_number,year,name,status,started_at)
 values(p_dynasty_id,next_no,p_year,'Season '||next_no,'active',now()) returning id into new_id;
 insert into public.season_programs(dynasty_id,season_id,team_id,active,conference_override)
 select p_dynasty_id,new_id,team_id,true,conference_override from public.season_programs where season_id=old_id and active=true on conflict do nothing;
 for item in select value from jsonb_array_elements(p_assignments) loop
   insert into public.season_programs(dynasty_id,season_id,team_id,active)
   values(p_dynasty_id,new_id,(item->>'team_id')::uuid,true) on conflict do nothing;
   select id into program_id from public.season_programs where season_id=new_id and team_id=(item->>'team_id')::uuid;
   insert into public.program_memberships(season_program_id,person_id,role,dynasty_id,season_id)
   select program_id,m.person_id,m.role,p_dynasty_id,new_id from public.program_memberships m
   where m.season_id=old_id and m.person_id=(item->>'person_id')::uuid;
 end loop;
 insert into public.dynasty_settings(dynasty_id,settings,updated_at)
 values(p_dynasty_id,jsonb_build_object('active_week',1),now())
 on conflict(dynasty_id) do update set settings=coalesce(public.dynasty_settings.settings,'{}'::jsonb)||jsonb_build_object('active_week',1),updated_at=now();
 return new_id;
end $$;
revoke all on function public.create_next_season_confirmed(uuid,integer,jsonb) from public,anon;
grant execute on function public.create_next_season_confirmed(uuid,integer,jsonb) to authenticated;
