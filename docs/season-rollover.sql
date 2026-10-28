-- Preserve each active program's conference assignment when carrying it into a new season.
-- NULL continues to use the team catalog's default conference.
-- CREATE OR REPLACE retains the existing RPC owner and grants.
CREATE OR REPLACE FUNCTION public.create_next_season(p_dynasty_id uuid, p_year integer DEFAULT NULL::integer, p_carry_programs boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_next integer; v_new uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not private.can_manage_dynasty(p_dynasty_id) then raise exception 'Commissioner access required'; end if;
 select coalesce(max(season_number),0)+1 into v_next from public.seasons where dynasty_id=p_dynasty_id;
 update public.seasons set status='completed',completed_at=coalesce(completed_at,now()) where dynasty_id=p_dynasty_id and status='active';
 insert into public.seasons(dynasty_id,season_number,year,name,status,started_at) values(p_dynasty_id,v_next,p_year,'Season '||v_next,'active',now()) returning id into v_new;
 if p_carry_programs then
   insert into public.season_programs(dynasty_id,season_id,team_id,active,conference_override)
   select p_dynasty_id,v_new,sp.team_id,true,sp.conference_override from public.season_programs sp join public.seasons s on s.id=sp.season_id where sp.dynasty_id=p_dynasty_id and s.season_number=v_next-1 and sp.active=true
   on conflict do nothing;
   insert into public.program_memberships(season_program_id,person_id,role,dynasty_id,season_id)
   select newsp.id,pm.person_id,pm.role,p_dynasty_id,v_new
   from public.program_memberships pm join public.season_programs oldsp on oldsp.id=pm.season_program_id join public.seasons olds on olds.id=oldsp.season_id
   join public.season_programs newsp on newsp.season_id=v_new and newsp.team_id=oldsp.team_id
   where oldsp.dynasty_id=p_dynasty_id and olds.season_number=v_next-1
   on conflict do nothing;
 end if;
 insert into public.dynasty_settings(dynasty_id,settings,updated_at)
 values(p_dynasty_id,jsonb_build_object('active_week',1),now())
 on conflict (dynasty_id) do update set settings=coalesce(public.dynasty_settings.settings,'{}'::jsonb)||jsonb_build_object('active_week',1),updated_at=now();
 return v_new;
end;
$function$

