-- Behavioural checks for 20260930000300_dashboard_audit_privileges.
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'researcher@example.org'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'volunteer@example.org');
UPDATE public.users SET role = 'researcher' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
SELECT public.log_export('darwin_core', 42, true, '{"species":"cat"}') IS NULL;
RESET ROLE;
SELECT CASE WHEN count(*) = 1 AND bool_and(actor_id = 'aaaaaaaa-0000-0000-0000-00000000000a' AND actor_role = 'researcher' AND row_count = 42 AND includes_precise_coordinates)
  THEN 'PASS 1: a researcher export is logged with their id and role' ELSE 'FAIL 1' END
FROM public.export_audit;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
DO $$ BEGIN
  PERFORM public.log_export('darwin_core', 1, false, '{}');
  RAISE NOTICE 'FAIL 2: a volunteer logged an export';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 2: only researchers can log exports';
END $$;
RESET ROLE;

SELECT CASE WHEN NOT has_table_privilege('authenticated', 'public.user_stats', 'update')
             AND NOT has_table_privilege('authenticated', 'public.observations_map', 'insert')
             AND NOT has_table_privilege('authenticated', 'public.colonies', 'truncate')
             AND has_table_privilege('authenticated', 'public.user_stats', 'select')
             AND has_table_privilege('authenticated', 'public.colonies', 'insert')
  THEN 'PASS 3: read-only views and truncate are locked, normal access kept' ELSE 'FAIL 3' END;
ROLLBACK;
