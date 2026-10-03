-- Behavioural checks for 20261003000100_route_protocols.
-- Run against a disposable copy of the database: psql -f this file. Everything rolls back.
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'researcher@example.org'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'volunteer@example.org');
UPDATE public.users SET role = 'researcher' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
INSERT INTO public.routes (id, name, geometry, created_by, direction_rule, strip_width_m, window_start, window_end)
VALUES ('11111111-0000-0000-0000-000000000001', 'Test loop',
        'SRID=4326;LINESTRING(10.17 36.80, 10.18 36.80, 10.18 36.81)',
        'aaaaaaaa-0000-0000-0000-00000000000a', 'as_drawn', 25, '07:00', '10:00');
RESET ROLE;
SELECT CASE WHEN version = 1 THEN 'PASS 1: a new route starts at version 1' ELSE 'FAIL 1' END
FROM public.routes WHERE id = '11111111-0000-0000-0000-000000000001';

-- A volunteer walks it: the session records the version in force
INSERT INTO public.sessions (id, observer_id, protocol, route_id, start_time, end_time, complete_session)
VALUES ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'transect',
        '11111111-0000-0000-0000-000000000001', now() - interval '1 hour', now(), true);
SELECT CASE WHEN route_version = 1 THEN 'PASS 2: sessions keep the route version they were walked under' ELSE 'FAIL 2' END
FROM public.sessions WHERE id = '22222222-0000-0000-0000-000000000001';

-- Reversing the line bumps the version and keeps the old one
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
UPDATE public.routes SET geometry = extensions.ST_Reverse(geometry) WHERE id = '11111111-0000-0000-0000-000000000001';
UPDATE public.routes SET name = 'Test loop renamed' WHERE id = '11111111-0000-0000-0000-000000000001';
RESET ROLE;
SELECT CASE WHEN r.version = 2 AND (SELECT count(*) FROM public.route_revisions v WHERE v.route_id = r.id AND v.version = 1) = 1
  THEN 'PASS 3: a geometry change bumps the version and stores the old line; a rename does not'
  ELSE 'FAIL 3' END
FROM public.routes r WHERE r.id = '11111111-0000-0000-0000-000000000001';

-- A walked route cannot be hard-deleted, only archived
DO $$ BEGIN
  DELETE FROM public.routes WHERE id = '11111111-0000-0000-0000-000000000001';
  RAISE NOTICE 'FAIL 4: a walked route was deleted';
EXCEPTION WHEN restrict_violation THEN RAISE NOTICE 'PASS 4: walked routes refuse hard delete';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
UPDATE public.routes SET deleted_at = now() WHERE id = '11111111-0000-0000-0000-000000000001';
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.routes_app WHERE id = '11111111-0000-0000-0000-000000000001')
             AND EXISTS (SELECT 1 FROM public.routes_admin WHERE id = '11111111-0000-0000-0000-000000000001' AND deleted_at IS NOT NULL AND NOT is_active)
  THEN 'PASS 5: archived routes leave the app view, stay in the researcher view, and switch off'
  ELSE 'FAIL 5' END;

-- Volunteers cannot see the researcher view or the revision history
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT CASE WHEN (SELECT count(*) FROM public.routes_admin) = 0 AND (SELECT count(*) FROM public.route_revisions) = 0
  THEN 'PASS 6: routes_admin and route_revisions are researcher-only' ELSE 'FAIL 6' END;
RESET ROLE;

SELECT CASE WHEN NOT has_table_privilege('authenticated', 'public.route_revisions', 'insert')
             AND NOT has_table_privilege('authenticated', 'public.track_points_app', 'update')
  THEN 'PASS 7: revision history and the track view are read-only' ELSE 'FAIL 7' END;
ROLLBACK;
