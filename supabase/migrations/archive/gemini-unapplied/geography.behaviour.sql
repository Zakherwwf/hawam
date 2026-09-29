-- Behavioural checks for migration 20260929000002 (global geography).
-- Uses small synthetic reference polygons so CI does not need the full
-- Natural Earth / timezone downloads. Rolled back at the end.
\set ON_ERROR_STOP 1
BEGIN;

-- 1. SQL grid matches packages/shared generalizeTo1KmGrid() exactly
SELECT CASE WHEN bool_and(public.generate_1km_cell_id(p) = id
                          AND ST_X(public.snap_to_1km_grid_centroid(p)) = lon
                          AND ST_Y(public.snap_to_1km_grid_centroid(p)) = lat)
  THEN 'PASS 1: SQL grid matches TypeScript grid' ELSE 'FAIL 1: grid mismatch' END
FROM (VALUES
  (ST_SetSRID(ST_MakePoint(10.181, 36.801), 4326), '1KM-N4084-E904', 10.17615, 36.7973),
  (ST_SetSRID(ST_MakePoint(-77.04, -12.05), 4326), '1KM-S1338-W8364', -77.04433, -12.04955),
  (ST_SetSRID(ST_MakePoint(72.88, 19.07), 4326), '1KM-N2116-E7645', 72.87684, 19.06757),
  (ST_SetSRID(ST_MakePoint(139.69, 35.68), 4326), '1KM-N3960-E12594', 139.68486, 35.68018)
) v(p, id, lon, lat);

-- 2. Cells are ~1 km wide far from Tunisia (the old UTM 32N grid gave 230 m in Lima)
SELECT CASE WHEN w BETWEEN 950 AND 1050
  THEN 'PASS 2: Lima cell width ~1 km (' || round(w) || ' m)' ELSE 'FAIL 2: Lima cell width ' || w END
FROM (SELECT ST_Distance(
  public.snap_to_1km_grid_centroid(ST_SetSRID(ST_MakePoint(-77.04, -12.05), 4326))::geography,
  public.snap_to_1km_grid_centroid(ST_SetSRID(ST_MakePoint(-77.04 + 0.0093, -12.05), 4326))::geography) AS w) s;

-- Synthetic reference polygons around Lima
INSERT INTO public.ref_countries (iso_a2, name, geom) VALUES ('PE', 'Peru', ST_MakeEnvelope(-78, -13, -76, -11, 4326));
INSERT INTO public.ref_admin1 (code, iso_a2, name, geom) VALUES ('PE-LIM', 'PE', 'Lima', ST_MakeEnvelope(-78, -13, -76, -11, 4326));
INSERT INTO public.ref_timezones (tzid, geom) VALUES ('America/Lima', ST_MakeEnvelope(-80, -15, -70, -5, 4326));

INSERT INTO auth.users (id, email) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x');
INSERT INTO public.profiles (id) VALUES ('aaaaaaaa-0000-0000-0000-000000000001');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
SELECT public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-000000000001","complete_session":true},"observations":[{"id":"11111111-0000-0000-0000-000000000001","species":"dog","observed_at":"2026-09-29T11:30:00Z","location":{"type":"Point","coordinates":[-77.04,-12.05]}}]}') IS NOT NULL AS submitted;
RESET ROLE;

-- 3. Observation and session attributed; local time derived from IANA zone
SELECT CASE WHEN o.country_code = 'PE' AND o.admin1_code = 'PE-LIM' AND o.timezone = 'America/Lima'
             AND o.observed_at_local = '2026-09-29 06:30:00' AND s.country_code = 'PE' AND s.timezone = 'America/Lima'
  THEN 'PASS 3: country, region, timezone and local time set' ELSE 'FAIL 3' END
FROM public.observations o JOIN public.sessions s ON s.id = o.session_id;

-- 4. Darwin Core view carries GBIF taxonomy and 1 km coordinates only
SELECT CASE WHEN "taxonKey" = 6164210 AND "countryCode" = 'PE' AND "coordinateUncertaintyInMeters" = 707
  THEN 'PASS 4: dwc_occurrence exposes taxonKey and countryCode' ELSE 'FAIL 4' END
FROM public.dwc_occurrence;

-- 5. Backfill fills rows that predate the reference data
UPDATE public.observations SET country_code = NULL, admin1_code = NULL;
SELECT CASE WHEN public.backfill_observation_geography() = 1
  THEN 'PASS 5a: backfill updated 1 row' ELSE 'FAIL 5a' END;
SELECT CASE WHEN country_code = 'PE' AND admin1_code = 'PE-LIM'
  THEN 'PASS 5b: backfill restores attribution' ELSE 'FAIL 5b' END
FROM public.observations;

ROLLBACK;
