-- Repair report editing without granting private-schema access or bypassing RLS.
create or replace function public.set_preview_report_story(p_season_id uuid,p_week integer,p_action text,p_story_id text,p_revision integer)
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
