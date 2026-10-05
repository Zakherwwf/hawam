-- Objects created by this repo's migrations (20260929*) must not be granted to
-- anon, even though Supabase grants new objects to anon by default.
\set ON_ERROR_STOP 1
SELECT CASE WHEN count(*) = 0
  THEN 'PASS 1: anon holds no grant on objects added since 20260929'
  ELSE 'FAIL 1: anon can use ' || string_agg(name, ', ') END
FROM (
  SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('ref_countries','ref_admin1','ref_timezones','ref_taxa','ai_usage_daily',
                      'dwc_occurrence','observations_map','ref_countries_id_seq','ref_admin1_id_seq',
                      'ref_timezones_id_seq','observation_code_cat_seq','observation_code_dog_seq',
                      'observation_code_other_seq')
    AND (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
         OR (c.relkind = 'S' AND has_sequence_privilege('anon', c.oid, 'USAGE,UPDATE')))
  UNION ALL
  SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('resolve_geography','local_wall_time','set_observation_local_time',
                      'attribute_observation_geography','attribute_session_geography',
                      'backfill_observation_geography','consume_ai_quota','export_my_data',
                      'next_observation_code','assign_observation_code')
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
) leaks;

SELECT CASE WHEN has_table_privilege('authenticated', 'public.ref_taxa', 'SELECT')
             AND NOT has_table_privilege('authenticated', 'public.ref_taxa', 'INSERT')
             AND has_table_privilege('authenticated', 'public.observations_map', 'SELECT')
  THEN 'PASS 2: signed-in users read reference data and the map, and cannot write reference data'
  ELSE 'FAIL 2' END;
