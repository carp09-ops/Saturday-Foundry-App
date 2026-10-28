-- Additive preview-only editorial controls; no score, season or published-edition writes.
create table public.preview_report_curation (
 season_id uuid not null references public.seasons(id) on delete cascade,
 week_number integer not null check(week_number between 0 and 30),
 pinned_id text,
 hidden_ids text[] not null default '{}',
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(season_id,week_number),
 check(pinned_id is null or length(pinned_id)<=128),
 check(cardinality(hidden_ids)<=200)
);
alter table public.preview_report_curation enable row level security;
revoke all on public.preview_report_curation from public,anon,authenticated;
grant select,insert,update on public.preview_report_curation to authenticated;
create policy report_member_read on public.preview_report_curation for select to authenticated
 using(exists(select 1 from public.seasons s where s.id=season_id and private.is_dynasty_member(s.dynasty_id)));
create policy report_commissioner_insert on public.preview_report_curation for insert to authenticated
 with check(exists(select 1 from public.seasons s where s.id=season_id and private.can_manage_dynasty(s.dynasty_id)));
create policy report_commissioner_update on public.preview_report_curation for update to authenticated
 using(exists(select 1 from public.seasons s where s.id=season_id and private.can_manage_dynasty(s.dynasty_id)))
 with check(exists(select 1 from public.seasons s where s.id=season_id and private.can_manage_dynasty(s.dynasty_id)));
create function public.set_preview_report_story(p_season_id uuid,p_week integer,p_action text,p_story_id text,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.preview_report_curation; d uuid;
begin
 select dynasty_id into d from public.seasons where id=p_season_id;
 -- Keep this RPC SECURITY INVOKER. The caller has no USAGE on private;
 -- inspect the caller's own membership through its existing SELECT/RLS policy.
 if auth.uid() is null or d is null or not exists (
  select 1 from public.dynasty_members dm
  where dm.dynasty_id=d and dm.user_id=(select auth.uid())
   and dm.active=true and dm.role in ('commissioner','co_commissioner')
 ) then raise exception 'Commissioner access required'; end if;
 if p_week is null or p_week not between 0 and 30 or p_action is null or p_action not in ('pin','hide','restore','auto') then raise exception 'Invalid report action'; end if;
 if p_action<>'auto' and (p_story_id is null or p_story_id !~ '^(game|preview|poll):[a-f0-9-]{36}(:[0-9]{1,2})?$') then raise exception 'Invalid story'; end if;
 insert into public.preview_report_curation(season_id,week_number,revision) values(p_season_id,p_week,1) on conflict do nothing;
 select * into r from public.preview_report_curation where season_id=p_season_id and week_number=p_week for update;
 -- New clients use revision zero for a nonexistent row, accepting its initial default.
 if p_revision is null or not (r.revision=p_revision or (p_revision=0 and r.revision=1 and r.pinned_id is null and cardinality(r.hidden_ids)=0)) then raise exception 'The report changed. Refresh before editing.'; end if;
 if p_action='pin' then r.pinned_id=p_story_id;r.hidden_ids=array_remove(r.hidden_ids,p_story_id);
 elsif p_action='hide' then if r.pinned_id=p_story_id then r.pinned_id=null;end if;if not p_story_id=any(r.hidden_ids) then r.hidden_ids=array_append(r.hidden_ids,p_story_id);end if;
 elsif p_action='restore' then r.hidden_ids=array_remove(r.hidden_ids,p_story_id);
 else r.pinned_id=null;
 end if;
 update public.preview_report_curation set pinned_id=r.pinned_id,hidden_ids=r.hidden_ids,revision=r.revision+1,updated_at=now() where season_id=p_season_id and week_number=p_week returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.set_preview_report_story(uuid,integer,text,text,integer) from public,anon,authenticated;
grant execute on function public.set_preview_report_story(uuid,integer,text,text,integer) to authenticated;
