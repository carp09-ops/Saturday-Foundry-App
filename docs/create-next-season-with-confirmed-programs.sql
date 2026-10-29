-- Deploy only after isolated database tests. Existing create_next_season remains for legacy compatibility.
CREATE OR REPLACE FUNCTION public.create_next_season_with_programs(
 p_dynasty_id uuid, p_expected_season_id uuid, p_year integer, p_assignments jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_next integer; v_new uuid; v_old uuid; v_expected integer; v_actual integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_dynasty(p_dynasty_id) THEN RAISE EXCEPTION 'Commissioner authorization required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_dynasty_id::text,0));
 SELECT id INTO v_old FROM public.seasons WHERE dynasty_id=p_dynasty_id AND status='active' FOR UPDATE;
 IF v_old IS DISTINCT FROM p_expected_season_id THEN RAISE EXCEPTION 'Active season changed. Refresh before continuing'; END IF;
 IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Program confirmations required'; END IF;
 SELECT count(*) INTO v_expected FROM public.program_memberships pm JOIN public.season_programs sp ON sp.id=pm.season_program_id WHERE pm.season_id=v_old AND sp.active=true;
 SELECT count(*) INTO v_actual FROM jsonb_array_elements(p_assignments) a;
 IF v_actual<>v_expected OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_assignments) a WHERE (a->>'person_id') IS NULL OR (a->>'team_id') IS NULL OR (a->>'confirmed') IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'Confirm every active coach'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_assignments) a GROUP BY a->>'person_id' HAVING count(*)>1) OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_assignments) a GROUP BY a->>'team_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate coach or team selection'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_assignments) a WHERE NOT EXISTS (SELECT 1 FROM public.program_memberships pm JOIN public.season_programs sp ON sp.id=pm.season_program_id WHERE pm.season_id=v_old AND sp.active=true AND pm.person_id=(a->>'person_id')::uuid)) THEN RAISE EXCEPTION 'Coach selection does not match active season'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_assignments) a WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id=(a->>'team_id')::uuid AND t.active=true AND t.selectable=true)) THEN RAISE EXCEPTION 'Invalid destination team'; END IF;
 SELECT coalesce(max(season_number),0)+1 INTO v_next FROM public.seasons WHERE dynasty_id=p_dynasty_id;
 UPDATE public.seasons SET status='completed',completed_at=coalesce(completed_at,now()) WHERE id=v_old;
 INSERT INTO public.seasons(dynasty_id,season_number,year,name,status,started_at) VALUES(p_dynasty_id,v_next,p_year,'Season '||v_next,'active',now()) RETURNING id INTO v_new;
 INSERT INTO public.season_programs(dynasty_id,season_id,team_id,active,conference_override)
 SELECT p_dynasty_id,v_new,(a->>'team_id')::uuid,true,CASE WHEN oldsp.team_id=(a->>'team_id')::uuid THEN oldsp.conference_override ELSE NULL END
 FROM jsonb_array_elements(p_assignments) a JOIN public.program_memberships pm ON pm.person_id=(a->>'person_id')::uuid AND pm.season_id=v_old JOIN public.season_programs oldsp ON oldsp.id=pm.season_program_id;
 INSERT INTO public.program_memberships(season_program_id,person_id,role,dynasty_id,season_id)
 SELECT newsp.id,pm.person_id,pm.role,p_dynasty_id,v_new FROM jsonb_array_elements(p_assignments) a JOIN public.program_memberships pm ON pm.person_id=(a->>'person_id')::uuid AND pm.season_id=v_old JOIN public.season_programs newsp ON newsp.season_id=v_new AND newsp.team_id=(a->>'team_id')::uuid;
 INSERT INTO public.dynasty_settings(dynasty_id,settings,updated_at) VALUES(p_dynasty_id,jsonb_build_object('active_week',1),now()) ON CONFLICT(dynasty_id) DO UPDATE SET settings=coalesce(public.dynasty_settings.settings,'{}'::jsonb)||jsonb_build_object('active_week',1),updated_at=now();
 RETURN v_new;
END;$function$;
REVOKE ALL ON FUNCTION public.create_next_season_with_programs(uuid,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_next_season_with_programs(uuid,uuid,integer,jsonb) TO authenticated;
