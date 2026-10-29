-- Atomic, opt-in rollover. Do not replace the legacy RPC.
CREATE OR REPLACE FUNCTION public.create_next_season_with_assignments(
 p_dynasty_id uuid, p_year integer, p_assignments jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE old_id uuid; new_id uuid; next_num integer; expected_count integer; item jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_dynasty(p_dynasty_id) THEN RAISE EXCEPTION 'Commissioner access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_dynasty_id::text,0));
 SELECT id INTO old_id FROM public.seasons WHERE dynasty_id=p_dynasty_id AND status='active' FOR UPDATE;
 IF old_id IS NULL THEN RAISE EXCEPTION 'No active season'; END IF;
 IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Assignments required'; END IF;
 SELECT count(DISTINCT person_id) INTO expected_count FROM public.program_memberships WHERE season_id=old_id;
 IF jsonb_array_length(p_assignments)<>expected_count THEN RAISE EXCEPTION 'Confirm every coach'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignments) a WHERE a->>'person_id' IS NULL OR a->>'team_id' IS NULL)
 OR (SELECT count(DISTINCT a->>'person_id') FROM jsonb_array_elements(p_assignments) a)<>expected_count
 OR (SELECT count(DISTINCT a->>'team_id') FROM jsonb_array_elements(p_assignments) a)<>expected_count
 THEN RAISE EXCEPTION 'Missing or duplicate assignments'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_assignments) a WHERE NOT EXISTS(
 SELECT 1 FROM public.program_memberships pm WHERE pm.season_id=old_id AND pm.person_id=(a->>'person_id')::uuid))
 THEN RAISE EXCEPTION 'Unknown coach'; END IF;
 SELECT coalesce(max(season_number),0)+1 INTO next_num FROM public.seasons WHERE dynasty_id=p_dynasty_id;
 UPDATE public.seasons SET status='completed',completed_at=coalesce(completed_at,now()) WHERE id=old_id;
 INSERT INTO public.seasons(dynasty_id,season_number,year,name,status,started_at)
 VALUES(p_dynasty_id,next_num,p_year,'Season '||next_num,'active',now()) RETURNING id INTO new_id;
 INSERT INTO public.season_programs(dynasty_id,season_id,team_id,active,conference_override)
 SELECT p_dynasty_id,new_id,sp.team_id,true,sp.conference_override FROM public.season_programs sp
 WHERE sp.season_id=old_id AND sp.active=true ON CONFLICT DO NOTHING;
 FOR item IN SELECT value FROM jsonb_array_elements(p_assignments) LOOP
  INSERT INTO public.season_programs(dynasty_id,season_id,team_id,active)
  VALUES(p_dynasty_id,new_id,(item->>'team_id')::uuid,true) ON CONFLICT DO NOTHING;
  INSERT INTO public.program_memberships(season_program_id,person_id,role,dynasty_id,season_id)
  SELECT sp.id,pm.person_id,pm.role,p_dynasty_id,new_id FROM public.program_memberships pm
  JOIN public.season_programs sp ON sp.season_id=new_id AND sp.team_id=(item->>'team_id')::uuid
  WHERE pm.season_id=old_id AND pm.person_id=(item->>'person_id')::uuid;
 END LOOP;
 INSERT INTO public.dynasty_settings(dynasty_id,settings,updated_at)
 VALUES(p_dynasty_id,jsonb_build_object('active_week',1),now())
 ON CONFLICT(dynasty_id) DO UPDATE SET settings=coalesce(public.dynasty_settings.settings,'{}'::jsonb)||jsonb_build_object('active_week',1),updated_at=now();
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_next_season_with_assignments(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_next_season_with_assignments(uuid,integer,jsonb) TO authenticated;
