-- Behavioural checks for 20261004000100_privacy_and_integrity: access by
-- another volunteer (IDOR), user isolation, field tampering and consent.
-- Run by run_sql_behaviour.sh on a throwaway database. Everything rolls back.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('a1111111-0000-0000-0000-00000000000a', 'alice@example.org'),
  ('b2222222-0000-0000-0000-00000000000b', 'bilel@example.org'),
  ('c3333333-0000-0000-0000-00000000000c', 'researcher@example.org');
UPDATE public.users SET role = 'researcher' WHERE id = 'c3333333-0000-0000-0000-00000000000c';
UPDATE public.users SET display_name = 'Alice' WHERE id = 'a1111111-0000-0000-0000-00000000000a';

-- Alice walks and sees one cat at an exact spot
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-00000000000a', true);
SELECT public.accept_consent(1, 'en') IS NULL;
SELECT public.submit_survey_bundle('{"session":{"id":"e0000000-0000-0000-0000-000000000001","protocol":"transect","start_time":"2026-10-01T08:00:00Z","end_time":"2026-10-01T08:10:00Z","distance_km":0.11,"complete_session":true},
 "observations":[{"id":"e1000000-0000-0000-0000-000000000001","observed_at":"2026-10-01T08:05:00Z","species":"cat","group_size":2,"location":{"latitude":36.801234,"longitude":10.181234},"observer_location":{"latitude":36.801,"longitude":10.181}}],
 "track_points":[
 {"recorded_at":"2026-10-01T08:00:00Z","latitude":36.8000,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-10-01T08:01:00Z","latitude":36.8005,"longitude":10.18,"accuracy_m":5},
 {"recorded_at":"2026-10-01T08:02:00Z","latitude":36.8010,"longitude":10.18,"accuracy_m":5}]}') IS NOT NULL;
SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

-- 1-3. Bilel (another volunteer) cannot read Alice's exact positions or track
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b2222222-0000-0000-0000-00000000000b', true);
SELECT CASE WHEN (SELECT count(*) FROM public.observation_locations WHERE observation_id = 'e1000000-0000-0000-0000-000000000001') = 0
  THEN 'PASS 1: another volunteer cannot read an exact animal position' ELSE 'FAIL 1: exact position leaked' END;
SELECT CASE WHEN (SELECT count(*) FROM public.track_points WHERE session_id = 'e0000000-0000-0000-0000-000000000001') = 0
         AND (SELECT count(*) FROM public.session_tracks WHERE session_id = 'e0000000-0000-0000-0000-000000000001') = 0
  THEN 'PASS 2: another volunteer cannot read a walked track' ELSE 'FAIL 2: track leaked' END;
SELECT CASE WHEN (SELECT count(*) FROM public.observations_map WHERE id = 'e1000000-0000-0000-0000-000000000001') = 0
  THEN 'PASS 3: the exact map view hides other people''s sightings' ELSE 'FAIL 3: observations_map leaked' END;

-- 4. ...but gets a card rounded to ~100 m, without Alice's standing point
SELECT CASE WHEN latitude = 36.801 AND longitude = 10.181 AND NOT exact AND observer_latitude IS NULL AND bearing_deg IS NULL
  THEN 'PASS 4: other people''s sightings are rounded to 3 decimals, standing point hidden'
  ELSE 'FAIL 4: ' || coalesce(latitude::text, 'null') || ' exact=' || exact::text END
FROM public.observation_cards(ARRAY['e1000000-0000-0000-0000-000000000001']::uuid[]);

-- 5. ...and Alice's public profile: totals only
SELECT CASE WHEN cats_counted = 2 AND surveys = 1 AND distance_km > 0
  THEN 'PASS 5: profiles show cats counted, surveys and km to other volunteers' ELSE 'FAIL 5: profile figures wrong' END
FROM public.people_stats WHERE user_id = 'a1111111-0000-0000-0000-00000000000a';

-- 6. Bilel cannot read anyone's consent columns
DO $$ BEGIN
  PERFORM consent_accepted_at FROM public.users LIMIT 1;
  RAISE NOTICE 'FAIL 6: consent columns readable';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 6: consent columns are private';
END $$;

-- 7. Bilel cannot edit Alice's session (RLS: no row matches)
UPDATE public.sessions SET notes = 'tampered' WHERE id = 'e0000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT CASE WHEN notes IS DISTINCT FROM 'tampered'
  THEN 'PASS 7: another volunteer cannot edit a session' ELSE 'FAIL 7: cross-user edit' END
FROM public.sessions WHERE id = 'e0000000-0000-0000-0000-000000000001';

-- 8-10. Alice sees her own exact data, but cannot inflate her own effort or counts
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-00000000000a', true);
SELECT CASE WHEN (SELECT count(*) FROM public.observation_locations WHERE observation_id = 'e1000000-0000-0000-0000-000000000001') = 1
         AND (SELECT count(*) FROM public.track_points WHERE session_id = 'e0000000-0000-0000-0000-000000000001') > 0
  THEN 'PASS 8: the owner reads her own exact positions and track' ELSE 'FAIL 8: owner locked out' END;
UPDATE public.sessions SET distance_km = 200, complete_session = false, notes = 'fine' WHERE id = 'e0000000-0000-0000-0000-000000000001';
UPDATE public.observations SET group_size = 50, species = 'dog' WHERE id = 'e1000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT CASE WHEN distance_km = 0.11 AND complete_session AND notes = 'fine'
  THEN 'PASS 9: effort cannot be edited after upload (notes still can)' ELSE 'FAIL 9: distance ' || distance_km END
FROM public.sessions WHERE id = 'e0000000-0000-0000-0000-000000000001';
SELECT CASE WHEN group_size = 2 AND species = 'cat'
  THEN 'PASS 10: counts and species cannot be edited after upload' ELSE 'FAIL 10: ' || group_size END
FROM public.observations WHERE id = 'e1000000-0000-0000-0000-000000000001';

-- 11. Alice cannot promote herself or write her consent time directly
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-00000000000a', true);
DO $$ BEGIN
  UPDATE public.users SET role = 'admin' WHERE id = 'a1111111-0000-0000-0000-00000000000a';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
END $$;
-- Installed app builds write their own consent directly: allowed for your own row only
UPDATE public.users SET consent_version = 1 WHERE id = 'b2222222-0000-0000-0000-00000000000b';
RESET ROLE;
SELECT CASE WHEN consent_version IS NULL
  THEN 'PASS 11b: nobody can write another account''s consent' ELSE 'FAIL 11b: cross-account consent write' END
FROM public.users WHERE id = 'b2222222-0000-0000-0000-00000000000b';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-00000000000a', true);
RESET ROLE;
SELECT CASE WHEN role = 'volunteer'
  THEN 'PASS 11: a volunteer cannot promote herself' ELSE 'FAIL 11: role is ' || role END
FROM public.users WHERE id = 'a1111111-0000-0000-0000-00000000000a';

-- 12. The researcher reads everything exactly
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c3333333-0000-0000-0000-00000000000c', true);
SELECT CASE WHEN (SELECT count(*) FROM public.observation_locations WHERE observation_id = 'e1000000-0000-0000-0000-000000000001') = 1
         AND (SELECT bool_and(exact) FROM public.observation_cards(ARRAY['e1000000-0000-0000-0000-000000000001']::uuid[]))
  THEN 'PASS 12: researchers read exact positions' ELSE 'FAIL 12: researcher locked out' END;
RESET ROLE;

-- 13. Signed-out visitors get nothing
SET ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.people_stats LIMIT 1;
  RAISE NOTICE 'FAIL 13: anon read people_stats';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS 13: signed-out visitors cannot read profiles';
END $$;
RESET ROLE;

ROLLBACK;
