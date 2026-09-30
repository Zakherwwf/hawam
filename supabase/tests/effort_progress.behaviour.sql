-- Behavioural checks for 20260930000100_effort_progress.
-- A complete zero-animal walk, a flagged walk and a sighting with one photo:
-- the photo earns XP, the zero checklist counts, the flagged walk does not
-- reach the leaderboard, and anon cannot read it.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.org'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.org');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
SELECT public.accept_consent(1, 'en') IS NULL;
-- Complete transect, 2.5 km, no animals seen
SELECT public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-00000000000a","protocol":"transect","start_time":"2026-09-29T08:00:00Z","end_time":"2026-09-29T08:40:00Z","distance_km":2.5,"complete_session":true},"observations":[]}') IS NOT NULL;
-- Quick sighting with a single photo (angle other)
SELECT public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-00000000000c","protocol":"incidental","start_time":"2026-09-29T10:00:00Z","complete_session":false},"observations":[{"id":"11111111-0000-0000-0000-00000000000a","observed_at":"2026-09-29T10:00:00Z","species":"cat","location":{"latitude":36.80,"longitude":10.18}}],"photos":[{"id":"22222222-0000-0000-0000-00000000000a","observation_id":"11111111-0000-0000-0000-00000000000a","storage_path":"aaaaaaaa-0000-0000-0000-00000000000a/11111111-0000-0000-0000-00000000000a/22222222-0000-0000-0000-00000000000a.jpg","angle":"other","taken_at":"2026-09-29T10:00:00Z"}]}') IS NOT NULL;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT public.accept_consent(1, 'en') IS NULL;
SELECT public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-00000000000b","protocol":"transect","start_time":"2026-09-29T08:00:00Z","end_time":"2026-09-29T08:10:00Z","distance_km":9,"complete_session":true},"observations":[]}') IS NOT NULL;
RESET ROLE;
UPDATE public.sessions SET validation_status = 'flagged' WHERE id = 'cccccccc-0000-0000-0000-00000000000b';

-- 1. Zero-animal complete checklist is counted as such
SELECT CASE WHEN complete_checklist_count = 1 AND zero_checklist_count = 1
  THEN 'PASS 1: a zero-animal complete walk counts as a complete checklist'
  ELSE 'FAIL 1: ' || complete_checklist_count || '/' || zero_checklist_count END
FROM public.user_stats WHERE user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- 2. One photo of any angle earns the photo weight
-- A: 1 obs (10) + 1 completed session with end_time (25) + 2 km (10) + 1 cell (30) + 1 photo (15) = 90
SELECT CASE WHEN photographed_observation_count = 1 AND xp = 90
  THEN 'PASS 2: a single photo earns photo XP' ELSE 'FAIL 2: xp ' || xp || ', photographed ' || photographed_observation_count END
FROM public.user_stats WHERE user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- 3. The effort leaderboard shows effort only and leaves flagged sessions out
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT CASE WHEN count(*) = 1 AND bool_and(user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' AND distance_km = 2.5 AND complete_checklist_count = 1)
  THEN 'PASS 3: effort_leaderboard excludes flagged sessions' ELSE 'FAIL 3: rows ' || count(*) END
FROM public.effort_leaderboard;
RESET ROLE;

-- 4. anon holds no grant on it
SELECT CASE WHEN NOT has_table_privilege('anon', 'public.effort_leaderboard', 'select')
             AND NOT has_table_privilege('anon', 'public.user_stats', 'select')
  THEN 'PASS 4: anon cannot read the leaderboard or stats' ELSE 'FAIL 4: anon can read' END;

ROLLBACK;
