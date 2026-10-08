-- Shared factual weekly editions. Internal generator is callable only by triggers/administration.
create table public.weekly_story_editions (
 dynasty_id uuid not null references public.dynasties(id) on delete cascade,
 season_id uuid not null references public.seasons(id) on delete cascade,
 week_number integer not null check (week_number >= 0),
 payload jsonb not null,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key (season_id, week_number)
);
alter table public.weekly_story_editions enable row level security;
create policy weekly_stories_member_read on public.weekly_story_editions
 for select to authenticated using (private.is_dynasty_member(dynasty_id));
revoke all on public.weekly_story_editions from anon, authenticated;
grant select on public.weekly_story_editions to authenticated;

create or replace function private.refresh_weekly_stories(p_season uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
 d uuid; sn integer; active_w integer; w integer; rw integer; preview_w integer;
 recaps jsonb; movers jsonb; previews jsonb; lead jsonb; edition jsonb;
 prior_poll integer; prior_count integer; current_count integer;
begin
 select s.dynasty_id,s.season_number into d,sn from public.seasons s where s.id=p_season;
 if d is null then return; end if;
 if auth.uid() is not null and not private.is_dynasty_member(d) then
  raise exception 'Dynasty membership required';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_season::text,193));
 select case when (ds.settings->>'active_week') ~ '^\d+$' then (ds.settings->>'active_week')::integer end
 into active_w from public.dynasty_settings ds join public.seasons s on s.id=p_season
 where ds.dynasty_id=d and s.status='active';
 for w in
  select distinct x.week_number from (
   select g.week_number from public.games g where g.season_id=p_season and g.status='completed' and not g.is_bye
   union select r.week_number from public.weekly_rankings r where r.season_id=p_season and r.poll_type='top25'
   union select active_w where active_w is not null
   union select e.week_number from public.weekly_story_editions e where e.season_id=p_season
  ) x where x.week_number>=0 order by x.week_number
 loop
  select coalesce(max(g.week_number),w) into rw from public.games g where g.season_id=p_season and g.status='completed' and not g.is_bye and g.week_number<=w;
  with entries as materialized (
   select distinct on (v.id,coalesce(v.person_id,p.person_id)) v.*,
    coalesce(v.person_id,p.person_id) story_person,coalesce(v.coach_name,p.coach_name) story_name
   from public.v_game_entries v
   left join public.v_season_programs p on p.season_id=v.season_id and p.team_id=v.team_id
   where v.season_id=p_season and coalesce(v.person_id,p.person_id) is not null
   order by v.id,coalesce(v.person_id,p.person_id)
  ), facts as (
   select g.*,stats.wins,stats.losses,stats.prior_wins,stats.prior_losses,
    (select count(*) from entries b where b.story_person=g.story_person and b.status='completed'
      and b.week_number<=rw and b.week_number>coalesce((select max(l.week_number) from entries l
       where l.story_person=g.story_person and l.status='completed' and l.result is distinct from g.result and l.week_number<=rw),-1)
      and b.result=g.result) streak
   from entries g cross join lateral (
    select count(*) filter(where b.result='W') wins,count(*) filter(where b.result='L') losses,
     count(*) filter(where b.result='W' and b.week_number<rw) prior_wins,
     count(*) filter(where b.result='L' and b.week_number<rw) prior_losses
    from entries b where b.story_person=g.story_person and b.status='completed' and not b.is_bye
     and b.week_number<=rw and b.points_for is not null and b.points_against is not null
   ) stats
   where g.week_number=rw and g.status='completed' and not g.is_bye
    and g.points_for is not null and g.points_against is not null and g.result in ('W','L')
  ), articles as (
   select jsonb_build_object(
    'id',p_season::text||'|weekly|'||rw||'|'||f.story_person||'|'||f.id,
    'person_id',f.story_person,'coach_name',f.story_name,'team',f.team_name,'game_id',f.id,
    'headline',case
     when f.game_type='national_championship' and f.result='W' then f.team_name||' reaches the summit'
     when f.game_type in ('conference_championship','bowl','playoff') then f.team_name||': '||coalesce(f.event_name,replace(f.game_type::text,'_',' '))||' '||case when f.result='W' then 'won' else 'ends in defeat' end
     when f.result='W' and f.opponent_rank between 1 and 25 and (f.team_rank is null or f.team_rank>f.opponent_rank) then f.team_name||' shakes up the rankings'
     when f.result='W' and f.streak>=3 then f.team_name||' makes it '||f.streak||' straight'
     when f.result='L' and f.prior_losses=0 and f.prior_wins>=2 then f.team_name||' takes its first loss'
     when f.result='W' and f.points_against=0 then f.team_name||' leaves no opening'
     when f.overtime then f.team_name||': settled in overtime'
     when abs(f.points_for-f.points_against)<=7 then f.team_name||': a Saturday on the edge'
     when f.result='W' and f.prior_wins=0 then f.team_name||' gets on the board'
     when f.result='L' and f.streak>=3 then f.team_name||' searches for a reset'
     else f.team_name||case when f.result='W' then ' keeps moving forward' else ' faces the next test' end end,
    'fact',f.story_name||' · '||f.team_name||case when f.result='W' then ' beat ' else ' lost to ' end||
     case when f.opponent_rank is not null then '#'||f.opponent_rank||' ' else '' end||f.opponent_team||', '||f.points_for||'–'||f.points_against||case when f.overtime then ' in overtime.' else '.' end,
    'body',case
     when f.result='W' and f.opponent_rank between 1 and 25 then 'A ranked win gives '||f.team_name||' a result worth carrying into the next week. '
     when f.result='L' and f.prior_losses=0 and f.prior_wins>=2 then 'The unbeaten start is over. The next result will show how the team responds. '
     when f.result='W' and f.streak>=3 then 'Momentum is becoming a pattern: '||f.streak||' consecutive wins. '
     when f.overtime then 'Regulation was not enough to separate these teams. '
     when abs(f.points_for-f.points_against)<=7 then 'One possession separated the final scores. '
     when f.result='L' and f.streak>=3 then 'The losing run has reached '||f.streak||' games. A turnaround starts with the next matchup. '
     when f.result='W' then 'Another completed chapter adds to the season résumé. '
     else 'This result changes the week ahead, with the next matchup offering a chance to respond. ' end||
     'Through Week '||rw||', '||f.story_name||' stands at '||f.wins||'–'||f.losses||'.',
    'importance',case when f.game_type='national_championship' then 100 when f.game_type<>'regular_season' then 85
     when f.result='W' and f.opponent_rank between 1 and 25 and (f.team_rank is null or f.team_rank>f.opponent_rank) then 80
     when f.overtime then 70 when f.streak>=3 then 65 else 40 end,
    'result',f.result,'record',f.wins||'–'||f.losses,'overtime',f.overtime) article
   from facts f
  ), idle as (
   select jsonb_build_object('id',p_season::text||'|weekly|'||rw||'|'||p.person_id||'|desk',
    'person_id',p.person_id,'coach_name',p.coach_name,'team',p.team_name,
    'headline',p.team_name||': the weekly desk',
    'fact',p.coach_name||' · '||p.team_name||' has no completed result recorded for Week '||rw||'.',
    'body','The edition will update when a result is entered. Upcoming recorded matchups appear below.',
    'importance',0) article
   from public.v_season_programs p where p.season_id=p_season and p.active and p.person_id is not null
    and not exists(select 1 from facts f where f.story_person=p.person_id)
  ) select coalesce(jsonb_agg(a.article order by (a.article->>'importance')::integer desc,a.article->>'coach_name'),'[]'::jsonb)
  into recaps from (select article from articles union all select article from idle) a;

  select max(r.week_number) into prior_poll from public.weekly_rankings r
   where r.season_id=p_season and r.poll_type='top25' and r.week_number<w;
  select count(*) into prior_count from public.weekly_rankings r where r.season_id=p_season and r.poll_type='top25' and r.week_number=prior_poll;
  select count(*) into current_count from public.weekly_rankings r where r.season_id=p_season and r.poll_type='top25' and r.week_number=w;
  with changes as (
   select c.rank,p.rank prior_rank,c.team_id,t.name,c.wins,c.losses,
    case when p.rank is null then 26-c.rank else abs(p.rank-c.rank) end magnitude
   from public.weekly_rankings c join public.teams t on t.id=c.team_id
   left join public.weekly_rankings p on p.season_id=c.season_id and p.poll_type=c.poll_type and p.week_number=prior_poll and p.team_id=c.team_id
   where c.season_id=p_season and c.poll_type='top25' and c.week_number=w
    and (c.rank is distinct from p.rank) and prior_count=25 and current_count=25
  ), top_changes as (select * from changes order by magnitude desc,rank limit 6)
  select coalesce(jsonb_agg(jsonb_build_object('team_id',team_id,'team',name,'rank',rank,'previous_rank',prior_rank,
   'headline',name||case when prior_rank is null then ' enters the Top 25 at #'||rank when prior_rank>rank then ' climbs to #'||rank else ' slides to #'||rank end,
   'fact',case when prior_rank is null then 'Unranked in the Week '||prior_poll||' poll.' else '#'||prior_rank||' in Week '||prior_poll||'; #'||rank||' in Week '||w||'.' end||' Record: '||wins||'–'||losses||'.') order by magnitude desc,rank),'[]'::jsonb)
  into movers from top_changes;

  preview_w:=case when exists(select 1 from public.games g where g.season_id=p_season and g.week_number=w and g.status='completed' and not g.is_bye) then w+1 else w end;
  select coalesce(jsonb_agg(jsonb_build_object('game_id',v.id,'person_id',coalesce(v.person_id,p.person_id),
   'coach_name',coalesce(v.coach_name,p.coach_name),'team',v.team_name,'opponent',v.opponent_team,
   'week',v.week_number,'headline',v.team_name||case when v.home_away='away' then ' at ' else ' vs ' end||v.opponent_team,
   'fact',coalesce(v.schedule_stage_label,v.week_label,'Week '||v.week_number)||' · '||case when v.home_away='away' then 'Away' else 'Home' end||
    case when v.is_conference_game then ' · Conference matchup' else '' end,
   'body',case when v.game_type in ('conference_championship','national_championship','playoff') then 'Postseason stakes: '||coalesce(v.event_name,replace(v.game_type::text,'_',' '))||'.'
    when v.is_conference_game then 'The conference race adds weight to the next result.' else 'A new opponent, and the next chance to shape the season.' end)
   order by v.team_name),'[]'::jsonb)
  into previews from public.v_game_entries v
  left join public.v_season_programs p on p.season_id=v.season_id and p.team_id=v.team_id
  where v.season_id=p_season and v.week_number=preview_w and not v.is_bye
   and coalesce(v.person_id,p.person_id) is not null;
  lead:=case when (recaps->0->>'importance')::integer>0 then recaps->0
    when jsonb_array_length(movers)>0 then movers->0
    when jsonb_array_length(previews)>0 then previews->0 else recaps->0 end;
  edition:=jsonb_build_object('season',sn,'week',w,'lead',lead,'recaps',recaps,'recap_week',rw,'movers',movers,
   'previews',previews,'preview_week',preview_w,'poll_count',current_count,'previous_poll_week',prior_poll,'engine','weekly-v1');
  insert into public.weekly_story_editions(dynasty_id,season_id,week_number,payload)
   values(d,p_season,w,edition)
   on conflict(season_id,week_number) do update set payload=excluded.payload,
    revision=public.weekly_story_editions.revision+1,updated_at=now()
   where public.weekly_story_editions.payload is distinct from excluded.payload;
 end loop;

end $$;
revoke all on function private.refresh_weekly_stories(uuid) from public,anon,authenticated;

create or replace function private.weekly_stories_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare s uuid;
begin
 if TG_TABLE_NAME='game_participants' then
  for s in select distinct g.season_id from changed_rows c join public.games g on g.id=c.game_id loop perform private.refresh_weekly_stories(s); end loop;
 elsif TG_TABLE_NAME='dynasty_settings' then
  for s in select distinct ss.id from changed_rows c join public.seasons ss on ss.dynasty_id=c.dynasty_id and ss.status='active' loop perform private.refresh_weekly_stories(s); end loop;
 else
  for s in select distinct season_id from changed_rows loop perform private.refresh_weekly_stories(s); end loop;
 end if;
 return null;
end $$;
revoke all on function private.weekly_stories_changed() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['games','game_participants','weekly_rankings','dynasty_settings'] loop
  execute format('create trigger weekly_stories_insert after insert on public.%I referencing new table as changed_rows for each statement execute function private.weekly_stories_changed()',t);
  execute format('create trigger weekly_stories_update after update on public.%I referencing new table as changed_rows for each statement execute function private.weekly_stories_changed()',t);
  execute format('create trigger weekly_stories_delete after delete on public.%I referencing old table as changed_rows for each statement execute function private.weekly_stories_changed()',t);
 end loop;
end $$;
do $$ declare s uuid; begin
 for s in select distinct season_id from public.games union select distinct season_id from public.weekly_rankings loop
  perform private.refresh_weekly_stories(s);
 end loop;
end $$;
