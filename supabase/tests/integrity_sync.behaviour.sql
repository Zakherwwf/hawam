-- Behavioural checks for 20260930000200_validation_routes_colonies.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.org'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.org');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
SELECT public.accept_consent(1, 'en') IS NULL;
-- An honest 10-minute walk, ~110 m, fixes 60 s apart
SELECT public.submit_survey_bundle('{"session":{"id":"c0000000-0000-0000-0000-000000000001","protocol":"transect","start_time":"2026-09-30T08:00:00Z","end_time":"2026-09-30T08:10:00Z","distance_km":0.11,"complete_session":true},"observations":[],"track_points":[
 {"recorded_at":"2026-09-30T08:00:00Z","latitude":36.8000,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-09-30T08:01:00Z","latitude":36.8005,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-09-30T08:02:00Z","latitude":36.8010,"longitude":10.18,"accuracy_m":5}]}') IS NOT NULL;
-- A spoofed walk: one mock fix
SELECT public.submit_survey_bundle('{"session":{"id":"c0000000-0000-0000-0000-000000000002","protocol":"transect","start_time":"2026-09-30T09:00:00Z","end_time":"2026-09-30T09:10:00Z","distance_km":0.1,"complete_session":true},"observations":[],"track_points":[
 {"recorded_at":"2026-09-30T09:00:00Z","latitude":36.80,"longitude":10.18,"accuracy_m":5,"is_mock":true},
 {"recorded_at":"2026-09-30T09:01:00Z","latitude":36.8005,"longitude":10.18,"accuracy_m":5}]}') IS NOT NULL;
-- A drive: 300 m every 10 s
SELECT public.submit_survey_bundle('{"session":{"id":"c0000000-0000-0000-0000-000000000003","protocol":"transect","start_time":"2026-09-30T10:00:00Z","end_time":"2026-09-30T10:03:00Z","distance_km":1.5,"complete_session":true},"observations":[],"track_points":[
 {"recorded_at":"2026-09-30T10:00:00Z","latitude":36.800,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-09-30T10:00:10Z","latitude":36.803,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-09-30T10:00:20Z","latitude":36.806,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-09-30T10:00:30Z","latitude":36.809,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-09-30T10:00:40Z","latitude":36.812,"longitude":10.18,"accuracy_m":5}]}') IS NOT NULL;
RESET ROLE;

-- The deferred trigger runs at commit; inside this test transaction fire it now
SET CONSTRAINTS ALL IMMEDIATE;

SELECT CASE WHEN validation_status = 'valid' AND cardinality(validation_reasons) = 0
  THEN 'PASS 1: an honest walk is validated automatically' ELSE 'FAIL 1: ' || validation_status || ' ' || validation_reasons::text END
FROM public.sessions WHERE id = 'c0000000-0000-0000-0000-000000000001';

SELECT CASE WHEN validation_status = 'flagged' AND 'mock_location' = ANY (validation_reasons)
  THEN 'PASS 2: a mock-location fix flags the session' ELSE 'FAIL 2: ' || validation_status END
FROM public.sessions WHERE id = 'c0000000-0000-0000-0000-000000000002';

SELECT CASE WHEN validation_status = 'flagged' AND 'vehicle_speed' = ANY (validation_reasons) AND 'average_speed' = ANY (validation_reasons)
  THEN 'PASS 3: driving is flagged (segment and average speed)' ELSE 'FAIL 3: ' || validation_reasons::text END
FROM public.sessions WHERE id = 'c0000000-0000-0000-0000-000000000003';

-- 4. The observer cannot un-flag their own session
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
DO $$ BEGIN
  UPDATE public.sessions SET validation_status = 'valid', validation_reasons = '{}' WHERE id = 'c0000000-0000-0000-0000-000000000002';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
SELECT CASE WHEN validation_status = 'flagged'
  THEN 'PASS 4: observers cannot change their own verdict' ELSE 'FAIL 4: verdict changed' END
FROM public.sessions WHERE id = 'c0000000-0000-0000-0000-000000000002';

-- 5. routes_app serves GeoJSON to signed-in users
INSERT INTO public.routes (name, geometry, created_by)
VALUES ('Harbour loop', extensions.ST_GeomFromText('LINESTRING(10.18 36.80, 10.19 36.81)', 4326), 'aaaaaaaa-0000-0000-0000-00000000000a');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT CASE WHEN count(*) = 1 AND bool_and((geometry ->> 'type') = 'LineString' AND length_km > 1)
  THEN 'PASS 5: routes_app returns the line as GeoJSON with a length' ELSE 'FAIL 5' END
FROM public.routes_app;

-- 6. A volunteer registers a colony (EWKT location) and another logs a visit
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
INSERT INTO public.colonies (id, type, species, location, name, created_by, estimated_population, sterilised_count, has_water)
VALUES ('d0000000-0000-0000-0000-000000000001', 'cat_colony', 'cat', 'SRID=4326;POINT(10.18 36.80)', 'Market cats', 'aaaaaaaa-0000-0000-0000-00000000000a', 8, 3, true);
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
INSERT INTO public.colony_visits (id, colony_id, tags, notes)
VALUES ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '{food_ok}', 'two kittens');
SELECT CASE WHEN count(*) = 1 AND bool_and(visit_count = 1 AND abs(latitude - 36.80) < 1e-9 AND species = 'cat' AND sterilised_count = 3)
  THEN 'PASS 6: colonies and visits are shared through colonies_app' ELSE 'FAIL 6' END
FROM public.colonies_app;
RESET ROLE;

-- 7. Sterilised cannot exceed the population
DO $$ BEGIN
  INSERT INTO public.colonies (id, type, location, estimated_population, sterilised_count)
  VALUES ('d0000000-0000-0000-0000-000000000002', 'cat_colony', 'SRID=4326;POINT(10 36)', 2, 5);
  RAISE NOTICE 'FAIL 7: impossible counts accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 7: sterilised cannot exceed the population';
END $$;

-- 8. anon reads none of it
SELECT CASE WHEN NOT has_table_privilege('anon', 'public.routes_app', 'select')
             AND NOT has_table_privilege('anon', 'public.colonies_app', 'select')
             AND NOT has_table_privilege('anon', 'public.colony_visits', 'select')
             AND NOT has_table_privilege('anon', 'public.colonies', 'select')
  THEN 'PASS 8: anon holds no grant on routes, colonies or visits' ELSE 'FAIL 8: anon can read' END;

ROLLBACK;
