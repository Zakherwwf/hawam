-- Behavioural checks for migration 20260929000001 (security & privacy hardening).
-- Every line of output must start with PASS. Runs inside a transaction that is
-- rolled back. Run with: supabase/tests/run_sql_behaviour.sh
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x');
INSERT INTO public.profiles (id) VALUES ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
INSERT INTO storage.objects (bucket_id, name, owner_id) VALUES
  ('animal-photos', 'observations/11111111-0000-0000-0000-000000000001/p1.jpg', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('animal-photos', 'observations/orphan/p9.jpg', 'aaaaaaaa-0000-0000-0000-000000000001');

\set bundle '{"session":{"id":"cccccccc-0000-0000-0000-000000000001","protocol":"transect","complete_session":true,"distance_km":1.2,"notes":"left from my house"},"track":{"type":"LineString","coordinates":[[10.18,36.80],[10.19,36.81]]},"track_points":[{"recorded_at":"2026-09-29T10:00:00Z","latitude":36.80,"longitude":10.18}],"observations":[{"id":"11111111-0000-0000-0000-000000000001","species":"cat","location":{"type":"Point","coordinates":[10.181,36.801]},"notes":"near my door"},{"id":"11111111-0000-0000-0000-000000000002","species":"dog","location":{"type":"Point","coordinates":[10.182,36.802]}},{"id":"11111111-0000-0000-0000-000000000003","species":"cat","location":{"type":"Point","coordinates":[10.183,36.803]}}],"photos":[{"id":"22222222-0000-0000-0000-000000000001","observation_id":"11111111-0000-0000-0000-000000000001","storage_path":"observations/11111111-0000-0000-0000-000000000001/p1.jpg","angle":"face"}]}'

-- 1. anon cannot submit
SET ROLE anon;
DO $$ BEGIN
  PERFORM public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-000000000009","user_id":"aaaaaaaa-0000-0000-0000-000000000001"}}');
  RAISE EXCEPTION 'FAIL: anon submit succeeded';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 1: anon submit refused';
END $$;
DO $$ BEGIN
  PERFORM 1 FROM public.observations LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon can read observations';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 1b: anon cannot read observations';
END $$;
RESET ROLE;

-- 2. authenticated submit, XP = 50 + min(3*10,20) + 20 = 90
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT CASE WHEN (public.submit_survey_bundle(:'bundle')->>'xp_earned')::INT = 90
  THEN 'PASS 2: xp capped = 90' ELSE 'FAIL 2' END AS r;
SELECT CASE WHEN (public.submit_survey_bundle(:'bundle')->>'already_synced')::BOOLEAN
  THEN 'PASS 3: idempotent retry' ELSE 'FAIL 3' END AS r;

-- 4. another user cannot claim the same session id
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  PERFORM public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-000000000001"}}');
  RAISE EXCEPTION 'FAIL: foreign session id accepted';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 4: foreign session id rejected';
END $$;

-- 5. photo pointing at someone else's observation is rejected
DO $$ BEGIN
  PERFORM public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-000000000002","complete_session":true},"observations":[],"photos":[{"id":"22222222-0000-0000-0000-000000000009","observation_id":"11111111-0000-0000-0000-000000000001","storage_path":"observations/x/y.jpg"}]}');
  RAISE EXCEPTION 'FAIL: cross-bundle photo accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  RAISE NOTICE 'PASS 5: cross-bundle photo rejected';
END $$;

-- 6. zero-animal complete checklist still gets completion bonus: 50 + 0 + 20
SELECT CASE WHEN (public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-000000000003","complete_session":true},"observations":[]}')->>'xp_earned')::INT = 70
  THEN 'PASS 6: zero-animal complete = 70' ELSE 'FAIL 6' END AS r;

-- 7. AI quota
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT CASE WHEN public.consume_ai_quota(2) AND public.consume_ai_quota(2) AND NOT public.consume_ai_quota(2)
  THEN 'PASS 7: quota enforced' ELSE 'FAIL 7' END AS r;

-- 8. export
SELECT CASE WHEN jsonb_array_length(d->'observations') = 3 AND jsonb_array_length(d->'track_points') = 1
             AND jsonb_array_length(d->'photos') = 1 AND d->'profile'->>'id' = 'aaaaaaaa-0000-0000-0000-000000000001'
  THEN 'PASS 8: export complete' ELSE 'FAIL 8: ' || d::TEXT END AS r
FROM (SELECT public.export_my_data() AS d) s;

-- 9. authenticated cannot call the service-only anonymiser
DO $$ BEGIN
  PERFORM public.anonymize_user_contributions('bbbbbbbb-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'FAIL: authenticated ran anonymiser';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 9: anonymiser is service-only';
END $$;
RESET ROLE;

-- 10. erasure keeps de-identified science
SELECT CASE WHEN jsonb_array_length(r->'photo_paths') = 2 AND (r->>'observations_anonymized')::INT = 3
  THEN 'PASS 10a: anonymised, orphan upload included' ELSE 'FAIL 10a: ' || r::TEXT END AS r
FROM (SELECT public.anonymize_user_contributions('aaaaaaaa-0000-0000-0000-000000000001') AS r) s;
DELETE FROM auth.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT CASE WHEN
    (SELECT count(*) FROM public.observations WHERE session_id = 'cccccccc-0000-0000-0000-000000000001' AND user_id IS NULL AND notes IS NULL AND location_public IS NOT NULL) = 3
    AND (SELECT count(*) FROM public.observation_locations_restricted) = 0
    AND (SELECT count(*) FROM public.track_points) = 0
    AND (SELECT count(*) FROM public.photos) = 0
    AND (SELECT track IS NULL AND notes IS NULL AND user_id IS NULL AND distance_km = 1.2 FROM public.sessions WHERE id = 'cccccccc-0000-0000-0000-000000000001')
    AND (SELECT count(*) FROM public.profiles WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0
  THEN 'PASS 10b: user gone, 1 km observations and effort kept' ELSE 'FAIL 10b' END AS r;

ROLLBACK;
