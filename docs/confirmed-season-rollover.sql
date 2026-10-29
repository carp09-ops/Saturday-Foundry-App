-- Staged only: deploy after isolated regression and security review.
CREATE OR REPLACE FUNCTION public.create_next_season_with_assignments(p_dynasty_id uuid,p_year integer,p_assignments jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_id uuid; new_id uuid; next_number integer; expected_count integer; a jsonb; new_program uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_dynasty(p_dynasty_id) THEN RAISE EXCEPTION 'Commissioner access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_dynasty_id::text,0));
 SELECT id INTO old_id FROM public.seasons WHERE dynasty_id=p_dynasty_id AND status='active' FOR UPDATE;
 IF old_id IS NULL THEN RAISE EXCEPTION 'Active season missing'; END IF;
 IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Assignments required'; END IF;
 SELECT count(DISTINCT person_id) INTO expected_count FROM public.program_memberships WHERE season_id=old_id;
 IF jsonb_array_length(p_assignments)<>expected_count OR
 (SELECT count(DISTINCT x->>'person_id') FROM jsonb_array_elements(p_assignments) x)<>expected_count OR
 (SELECT count(DISTINCT x->>'team_id') FROM jsonb_array_elements(p_assignments) x)<>expected_count
 THEN RAISE EXCEPTION 'Confirm exactly one unique program for each coach'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignments) x WHERE x->>'person_id' IS NULL OR x->>'team_id' IS NULL OR
 NOT EXISTS(SELECT 1 FROM public.program_memberships m WHERE m.season_id=old_id AND m.person_id=(x->>'person_id')::uuid))
 THEN RAISE EXCEPTION 'Invalid coach assignment'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignments) x WHERE NOT EXISTS
 (SELECT 1 FROM public.teams t WHERE t.id=(x->>'team_id')::uuid))
 THEN RAISE EXCEPTION 'Invalid program'; END IF;
 SELECT coalesce(max(season_number),0)+1 INTO next_number FROM public.seasons WHERE dynasty_id=p_dynasty_id;
 UPDATE public.seasons SET status='completed',completed_at=coalesce(completed_at,now()) WHERE id=old_id;
 INSERT INTO public.seasons(dynasty_id,season_number,year,name,status,started_at)
 VALUES(p_dynasty_id,next_number,p_year,'Season '||next_number,'active',now()) RETURNING id INTO new_id;
 INSERT INTO public.season_programs(dynasty_id,season_id,team_id,active,conference_override)
 SELECT p_dynasty_id,new_id,team_id,true,conference_override FROM public.season_programs WHERE season_id=old_id AND active=true ON CONFLICT DO NOTHING;
 FOR a IN SELECT value FROM jsonb_array_elements(p_assignments) LOOP
   INSERT INTO public.season_programs(dynasty_id,season_id,team_id,active)
   VALUES(p_dynasty_id,new_id,(a->>'team_id')::uuid,true) ON CONFLICT DO NOTHING;
   SELECT id INTO new_program FROM public.season_programs WHERE season_id=new_id AND team_id=(a->>'team_id')::uuid;
   IF new_program IS NULL THEN RAISE EXCEPTION 'Selected program unavailable'; END IF;
   INSERT INTO public.program_memberships(season_program_id,person_id,role,dynasty_id,season_id)
   SELECT new_program,m.person_id,m.role,p_dynasty_id,new_id FROM public.program_memberships m
   WHERE m.season_id=old_id AND m.person_id=(a->>'person_id')::uuid;
 END LOOP;
 INSERT INTO public.dynasty_settings(dynasty_id,settings,updated_at)
 VALUES(p_dynasty_id,jsonb_build_object('active_week',1),now())
 ON CONFLICT(dynasty_id) DO UPDATE SET settings=coalesce(public.dynasty_settings.settings,'{}'::jsonb)||jsonb_build_object('active_week',1),updated_at=now();
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_next_season_with_assignments(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_next_season_with_assignments(uuid,integer,jsonb) TO authenticated;
