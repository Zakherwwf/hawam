-- Behavioural checks for 20260929000100_global_readiness on the live schema.
-- The bundle below has the exact shape apps/mobile sends (top-level track and
-- track_points, accuracy on the observation). Every output line must start
-- with PASS. Runs in a transaction that is rolled back.
\set ON_ERROR_STOP 1
BEGIN;

-- Synthetic reference polygons around Lima (CI does not load the full sets)
INSERT INTO public.ref_countries (iso_a2, name, geom) VALUES ('PE', 'Peru', ST_MakeEnvelope(-78, -13, -76, -11, 4326));
INSERT INTO public.ref_admin1 (code, iso_a2, name, geom) VALUES ('PE-LIM', 'PE', 'Lima', ST_MakeEnvelope(-78, -13, -76, -11, 4326));
INSERT INTO public.ref_timezones (tzid, geom) VALUES ('America/Lima', ST_MakeEnvelope(-80, -15, -70, -5, 4326));

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.org'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.org');

-- 1. Grid matches packages/shared generalizeTo1KmGrid() and works in the Americas
SELECT CASE WHEN bool_and(g.grid_cell_id = v.id AND ST_X(g.location_public) = v.lon AND ST_Y(g.location_public) = v.lat)
  THEN 'PASS 1: worldwide grid matches the TypeScript grid (incl. Lima)' ELSE 'FAIL 1: grid mismatch' END
FROM (VALUES
  (10.181, 36.801, '1KM-N4084-E904', 10.17615, 36.7973),
  (-77.04, -12.05, '1KM-S1338-W8364', -77.04433, -12.04955),
  (72.88, 19.07, '1KM-N2116-E7645', 72.87684, 19.06757),
  (139.69, 35.68, '1KM-N3960-E12594', 139.68486, 35.68018)
) v(plon, plat, id, lon, lat),
LATERAL public.generalize_point(ST_SetSRID(ST_MakePoint(v.plon, v.plat), 4326), NULL) g;

SELECT CASE WHEN w BETWEEN 950 AND 1050
  THEN 'PASS 2: Lima cell is ~1 km wide (' || round(w) || ' m)' ELSE 'FAIL 2: width ' || w END
FROM (SELECT ST_Distance(a.location_public::geography, b.location_public::geography) AS w
      FROM public.generalize_point(ST_SetSRID(ST_MakePoint(-77.04, -12.05), 4326), NULL) a,
           public.generalize_point(ST_SetSRID(ST_MakePoint(-77.04 + 0.0093, -12.05), 4326), NULL) b) s;

-- App-shaped bundle from Lima
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
SELECT public.accept_consent(1, 'en') IS NULL AS consented;
\set bundle '{"session":{"id":"cccccccc-0000-0000-0000-000000000001","protocol":"transect","start_time":"2026-09-29T11:00:00Z","end_time":"2026-09-29T11:40:00Z","distance_km":1.2,"complete_session":true,"number_of_observers":1,"app_version":"2.0.0"},"track":{"type":"LineString","coordinates":[[-77.041,-12.051],[-77.035,-12.047],[-77.03,-12.04]]},"track_points":[{"recorded_at":"2026-09-29T11:00:00Z","latitude":-12.051,"longitude":-77.041,"accuracy_m":5},{"recorded_at":"2026-09-29T11:20:00Z","latitude":-12.047,"longitude":-77.035,"accuracy_m":45},{"recorded_at":"2026-09-29T11:40:00Z","latitude":-12.04,"longitude":-77.03,"accuracy_m":6}],"observations":[{"id":"11111111-0000-0000-0000-000000000001","observed_at":"2026-09-29T11:30:00Z","species":"dog","group_size":2,"gps_accuracy_m":8,"location":{"latitude":-12.05,"longitude":-77.04,"type":"Point","coordinates":[-77.04,-12.05]}}],"photos":[]}'
SELECT public.submit_survey_bundle(:'bundle') IS NOT NULL AS submitted;
SELECT public.submit_survey_bundle(:'bundle') IS NOT NULL AS retried;
RESET ROLE;

-- 3. The walked path and raw fixes are kept; the 45 m fix is flagged, not dropped
SELECT CASE WHEN (SELECT point_count FROM public.session_tracks WHERE session_id = 'cccccccc-0000-0000-0000-000000000001') = 3
             AND (SELECT count(*) FROM public.track_points WHERE session_id = 'cccccccc-0000-0000-0000-000000000001') = 3
             AND (SELECT count(*) FROM public.track_points WHERE rejected_reason = 'low_accuracy') = 1
  THEN 'PASS 3: app track stored; 3 raw fixes kept once, 1 flagged low_accuracy' ELSE 'FAIL 3: track not stored as expected' END;

-- 4. Observation: grid, accuracy-aware uncertainty, attribution, local time
SELECT CASE WHEN o.grid_cell_id = '1KM-S1338-W8364' AND o.gps_accuracy_m = 8 AND o.coordinate_uncertainty_m = 715
             AND o.country_code = 'PE' AND o.admin1_code = 'PE-LIM' AND o.timezone = 'America/Lima'
             AND o.observed_at_local = '2026-09-29 06:30:00'
             AND s.country_code = 'PE' AND s.timezone = 'America/Lima'
  THEN 'PASS 4: Lima observation generalized, attributed and in local time'
  ELSE 'FAIL 4: ' || row_to_json(o)::text END
FROM public.observations o JOIN public.sessions s ON s.id = o.session_id;

-- 5. Darwin Core view
SELECT CASE WHEN "taxonKey" = 6164210 AND "countryCode" = 'PE' AND "eventTimeZone" = 'America/Lima'
  THEN 'PASS 5: dwc_occurrence carries GBIF taxonKey and country' ELSE 'FAIL 5' END
FROM public.dwc_occurrence;

-- 6. Right of access, quota, and the existing guards still hold
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
SELECT CASE WHEN jsonb_array_length(d -> 'observations') = 1 AND jsonb_array_length(d -> 'track_points') = 3
             AND d -> 'observations' -> 0 -> 'location_precise' IS NOT NULL
  THEN 'PASS 6: export_my_data returns own observations, precise points and track' ELSE 'FAIL 6' END
FROM (SELECT public.export_my_data() AS d) x;
SELECT CASE WHEN public.consume_ai_quota(2) AND public.consume_ai_quota(2) AND NOT public.consume_ai_quota(2)
  THEN 'PASS 7: AI quota enforced per user per day' ELSE 'FAIL 7' END;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
SELECT public.accept_consent(1, 'en') IS NULL AS consented_b;
DO $$ BEGIN
  PERFORM public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-000000000001","protocol":"transect","start_time":"2026-09-29T11:00:00Z","complete_session":false}}');
  RAISE EXCEPTION 'FAIL 8: foreign session accepted';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 8: another user cannot claim the session';
END $$;
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  PERFORM public.export_my_data();
  RAISE EXCEPTION 'FAIL 9: anon ran export_my_data';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 9: anon cannot call export_my_data';
END $$;
RESET ROLE;

-- 10. Backfill after reference data changes
UPDATE public.observations SET country_code = NULL, admin1_code = NULL;
SELECT CASE WHEN public.backfill_observation_geography() = 1
  THEN 'PASS 10a: backfill updated 1 row' ELSE 'FAIL 10a' END;
SELECT CASE WHEN country_code = 'PE' AND admin1_code = 'PE-LIM'
  THEN 'PASS 10b: backfill restores attribution' ELSE 'FAIL 10b' END
FROM public.observations;

ROLLBACK;
