-- Staged for release approval. Do not apply to production during preview QA.
begin;
create table if not exists private.h2h_results (
 game_id uuid primary key references public.games(id) on delete cascade,
 submitted_by uuid not null references public.people(id),
 opponent_person uuid not null references public.people(id),
 status text not null check(status in ('pending','confirmed','disputed','resolved')),
 version integer not null default 1,
 home_score integer not null, away_score integer not null,
 confirmed_by uuid references public.people(id),
 reviewed_by uuid references public.people(id),
 note text, submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(submitted_by<>opponent_person)
);
create table if not exists private.h2h_events (
 id bigint generated always as identity primary key,
 game_id uuid not null references public.games(id) on delete cascade,
 actor uuid references public.people(id), action text not null,
 before_state jsonb, after_state jsonb, created_at timestamptz not null default now()
);
alter table private.h2h_results enable row level security;
alter table private.h2h_events enable row level security;
revoke all on private.h2h_results,private.h2h_events from public,anon,authenticated;

-- Explicitly authorized wrappers are required because players cannot directly
-- update games under existing RLS. Tables and internal routines stay private.
create or replace function private.h2h_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare gid uuid; d uuid; st public.game_status; humans integer; oldv jsonb;
begin
 if tg_table_name='games' then gid:=old.id; else gid:=old.game_id; end if;
 select g.dynasty_id,g.status into d,st from public.games g where g.id=gid for update;
 if tg_table_name='games' then
  if (new.status,new.week_number,new.season_id,new.dynasty_id) is not distinct from (old.status,old.week_number,old.season_id,old.dynasty_id) then return new; end if;
 else
  if (new.score,new.team_id,new.season_program_id,new.person_id,new.side) is not distinct from (old.score,old.team_id,old.season_program_id,old.person_id,old.side) then return new; end if;
 end if;
 select count(distinct pm.person_id) into humans from public.game_participants gp join public.program_memberships pm on pm.season_program_id=gp.season_program_id where gp.game_id=gid;
 if humans>=2 or exists(select 1 from private.h2h_results where game_id=gid) then
  -- Initial submit updates participant scores while the game is scheduled.
  -- General Edit RPCs mark the game completed before touching scores, so they
  -- cannot bypass this guard. Only commissioner corrections are allowed.
  if auth.uid() is not null and not private.can_manage_dynasty(d) then
   if tg_table_name='game_participants' then
    if st='completed' then raise exception 'User vs user finals require opponent validation; corrections require a commissioner'; end if;
   else
    if old.status='completed' or new.source is distinct from 'hq_entry' then raise exception 'User vs user finals require opponent validation; corrections require a commissioner'; end if;
   end if;
  end if;
  select to_jsonb(r) into oldv from private.h2h_results r where game_id=gid;
  if oldv is not null then
   update private.h2h_results set status='disputed',version=version+1,confirmed_by=null,reviewed_by=null,note='Game changed. Commissioner review required.',updated_at=now() where game_id=gid;
   insert into private.h2h_events(game_id,actor,action,before_state,after_state)
   select gid,p.person_id,'edit_invalidated',oldv,to_jsonb(r) from private.h2h_results r left join public.profiles p on p.id=auth.uid() where r.game_id=gid;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.h2h_guard() from public,anon,authenticated;
drop trigger if exists h2h_guard_scores on public.game_participants;
create trigger h2h_guard_scores before update on public.game_participants for each row execute function private.h2h_guard();
drop trigger if exists h2h_guard_game on public.games;
create trigger h2h_guard_game before update on public.games for each row execute function private.h2h_guard();

create or replace function public.submit_game_result(p_game_id uuid,p_my_score integer,p_opponent_score integer,p_my_rank integer default null,p_opponent_rank integer default null,p_overtime boolean default false,p_network text default null,p_event_name text default null)
returns table(game_id uuid,status public.game_status,result character,my_score integer,opponent_score integer)
language plpgsql security definer set search_path='' as $$
declare
 person uuid; opp_person uuid; g public.games%rowtype; me public.game_participants%rowtype; opp public.game_participants%rowtype;
 v private.h2h_results%rowtype; won char(1); hs integer; aws integer; human_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_my_score is null or p_opponent_score is null or p_my_score<0 or p_opponent_score<0 or p_my_score=p_opponent_score then raise exception 'Enter valid, non-tied final scores'; end if;
 if p_my_rank is not null and (p_my_rank<1 or p_my_rank>25) or p_opponent_rank is not null and (p_opponent_rank<1 or p_opponent_rank>25) then raise exception 'Rank must be 1-25'; end if;
 select p.person_id into person from public.profiles p where p.id=auth.uid();
 if person is null then raise exception 'Account must be linked to a dynasty person'; end if;
 select * into g from public.games where id=p_game_id for update;
 if not found then raise exception 'Game not found'; end if;
 if not private.is_dynasty_member(g.dynasty_id) then raise exception 'Dynasty membership required'; end if;
 if g.is_bye or g.status='cancelled' then raise exception 'This game cannot have a final result'; end if;
 select gp.* into me from public.game_participants gp join public.program_memberships pm on pm.season_program_id=gp.season_program_id where gp.game_id=p_game_id and pm.person_id=person order by gp.is_primary desc limit 1 for update of gp;
 if not found then raise exception 'You can only submit your own team result'; end if;
 select gp.* into opp from public.game_participants gp where gp.game_id=p_game_id and gp.id<>me.id order by gp.is_primary asc limit 1 for update;
 if not found then raise exception 'Opponent is not configured'; end if;
 select count(distinct pm.person_id) into human_count from public.program_memberships pm where pm.season_program_id=opp.season_program_id;
 if human_count>1 then raise exception 'Opponent ownership is ambiguous; commissioner review required'; end if;
 select pm.person_id into opp_person from public.program_memberships pm where pm.season_program_id=opp.season_program_id limit 1;
 hs:=case when me.side='home' then p_my_score else p_opponent_score end;
 aws:=case when me.side='away' then p_my_score else p_opponent_score end;
 won:=case when p_my_score>p_opponent_score then 'W' else 'L' end;
 if opp_person is not null and opp_person<>person and g.status='completed' then
  select * into v from private.h2h_results where private.h2h_results.game_id=p_game_id;
  if v.game_id is null then raise exception 'Historical final: commissioner review required before validation'; end if;
  if v.home_score<>hs or v.away_score<>aws then raise exception 'Final already entered. Use Validate Final to confirm or flag the saved score'; end if;
  -- Same-score duplicate is idempotent. It does not implicitly confirm.
  return query select p_game_id,g.status,won,me.score,opp.score;return;
 end if;
 if g.status='completed' and not private.can_manage_dynasty(g.dynasty_id) then raise exception 'Completed results require commissioner correction'; end if;
 update public.game_participants set score=p_my_score,rank=p_my_rank,result=won where id=me.id;
 update public.game_participants set score=p_opponent_score,rank=p_opponent_rank,result=case when won='W' then 'L' else 'W' end where id=opp.id;
 update public.games set status='completed',overtime=coalesce(p_overtime,false),network=coalesce(nullif(trim(p_network),''),network),event_name=coalesce(nullif(trim(p_event_name),''),event_name),source='hq_entry',data_quality_flag=null,updated_at=now() where id=p_game_id;
 if opp_person is not null and opp_person<>person then
  insert into private.h2h_results(game_id,submitted_by,opponent_person,status,home_score,away_score) values(p_game_id,person,opp_person,'pending',hs,aws);
  insert into private.h2h_events(game_id,actor,action,after_state) select p_game_id,person,'submitted',to_jsonb(r) from private.h2h_results r where r.game_id=p_game_id;
 end if;
 perform private.maybe_auto_advance_active_week(g.dynasty_id,g.season_id,g.week_number);
 return query select p_game_id,'completed'::public.game_status,won,p_my_score,p_opponent_score;
end $$;
revoke all on function public.submit_game_result(uuid,integer,integer,integer,integer,boolean,text,text) from public,anon;
grant execute on function public.submit_game_result(uuid,integer,integer,integer,integer,boolean,text,text) to authenticated;

create or replace function public.get_h2h_results(p_dynasty_id uuid,p_season_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;
begin
 if auth.uid() is null or not private.is_dynasty_member(p_dynasty_id) then raise exception 'Dynasty membership required'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('submitted_name',sp.display_name,'opponent_name',op.display_name,'confirmed_name',cp.display_name,'reviewed_name',rp.display_name)),'[]'::jsonb) into data
 from private.h2h_results r join public.games g on g.id=r.game_id
 left join public.people sp on sp.id=r.submitted_by left join public.people op on op.id=r.opponent_person
 left join public.people cp on cp.id=r.confirmed_by left join public.people rp on rp.id=r.reviewed_by
 where g.dynasty_id=p_dynasty_id and g.season_id=p_season_id;
 return jsonb_build_object('ready',true,'results',data);
end $$;
revoke all on function public.get_h2h_results(uuid,uuid) from public,anon;
grant execute on function public.get_h2h_results(uuid,uuid) to authenticated;

create or replace function public.validate_h2h_result(p_game_id uuid,p_version integer,p_home_score integer,p_away_score integer,p_confirm boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.games%rowtype; v private.h2h_results%rowtype; person uuid; beforev jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into g from public.games where id=p_game_id for update;
 if not found or not private.is_dynasty_member(g.dynasty_id) then raise exception 'Game membership required'; end if;
 select p.person_id into person from public.profiles p where p.id=auth.uid();
 select * into v from private.h2h_results where game_id=p_game_id;
 if not found then raise exception 'No submitted result to validate'; end if;
 if person is null or person<>v.opponent_person or person=v.submitted_by or not exists(select 1 from public.game_participants gp join public.program_memberships pm on pm.season_program_id=gp.season_program_id where gp.game_id=p_game_id and pm.person_id=person) then raise exception 'Only the opposing user can validate'; end if;
 if v.version is distinct from p_version or v.home_score is distinct from p_home_score or v.away_score is distinct from p_away_score then raise exception 'Score changed. Refresh before validating'; end if;
 if g.status<>'completed' then raise exception 'Game is no longer final'; end if;
 if p_confirm is null then raise exception 'Choose Confirm or Flag'; end if;
 if v.status='confirmed' and p_confirm then return to_jsonb(v); end if;
 if v.status<>'pending' then raise exception 'Result is already reviewed or awaiting commissioner review'; end if;
 if not p_confirm and nullif(trim(p_note),'') is null then raise exception 'Describe the incorrect score for commissioner review'; end if;
 beforev:=to_jsonb(v);
 update private.h2h_results set status=case when p_confirm then 'confirmed' else 'disputed' end,confirmed_by=case when p_confirm then person else null end,note=case when p_confirm then null else left(trim(p_note),500) end,updated_at=now() where game_id=p_game_id returning * into v;
 insert into private.h2h_events(game_id,actor,action,before_state,after_state) values(p_game_id,person,case when p_confirm then 'confirmed' else 'disputed' end,beforev,to_jsonb(v));
 return to_jsonb(v);
end $$;
revoke all on function public.validate_h2h_result(uuid,integer,integer,integer,boolean,text) from public,anon;
grant execute on function public.validate_h2h_result(uuid,integer,integer,integer,boolean,text) to authenticated;

create or replace function public.resolve_h2h_result(p_game_id uuid,p_version integer,p_home_score integer,p_away_score integer,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.games%rowtype; v private.h2h_results%rowtype; person uuid; beforev jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into g from public.games where id=p_game_id for update;
 if not found or not private.can_manage_dynasty(g.dynasty_id) then raise exception 'Commissioner required'; end if;
 select p.person_id into person from public.profiles p where p.id=auth.uid();
 if person is null then raise exception 'Account must be linked to a person'; end if;
 if p_home_score is null or p_away_score is null or p_home_score<0 or p_away_score<0 or p_home_score=p_away_score then raise exception 'Enter valid non-tied final scores'; end if;
 if nullif(trim(p_note),'') is null then raise exception 'Commissioner resolution requires a note'; end if;
 select * into v from private.h2h_results where game_id=p_game_id;
 if not found then raise exception 'No submitted result to review'; end if;
 if v.version is distinct from p_version then raise exception 'Score changed. Refresh before reviewing'; end if;
 if g.is_bye or g.status='cancelled' then raise exception 'Game cannot be resolved'; end if;
 beforev:=to_jsonb(v);
 update public.game_participants set score=case when side='home' then p_home_score else p_away_score end,result=case when (side='home' and p_home_score>p_away_score) or (side='away' and p_away_score>p_home_score) then 'W' else 'L' end where game_id=p_game_id;
 update public.games set status='completed',source='hq_edit',updated_at=now() where id=p_game_id;
 update private.h2h_results set status='resolved',home_score=p_home_score,away_score=p_away_score,version=version+1,confirmed_by=null,reviewed_by=person,note=left(trim(p_note),500),updated_at=now() where game_id=p_game_id returning * into v;
 insert into private.h2h_events(game_id,actor,action,before_state,after_state) values(p_game_id,person,'resolved',beforev,to_jsonb(v));
 perform private.maybe_auto_advance_active_week(g.dynasty_id,g.season_id,g.week_number);
 return to_jsonb(v);
end $$;
revoke all on function public.resolve_h2h_result(uuid,integer,integer,integer,text) from public,anon;
grant execute on function public.resolve_h2h_result(uuid,integer,integer,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
