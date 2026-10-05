-- Behavioural checks for 20260929000200_public_observation_codes.
-- Two users submit sightings the way the app does; every observation must get
-- a distinct, per-species sequential code that clients cannot change.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.org'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.org');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
SELECT public.accept_consent(1, 'en') IS NULL AS consented_a;
SELECT public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-00000000000a","protocol":"transect","start_time":"2026-09-29T08:00:00Z","complete_session":true},"observations":[{"id":"11111111-0000-0000-0000-00000000000a","observed_at":"2026-09-29T08:05:00Z","species":"dog","location":{"latitude":36.80,"longitude":10.18}},{"id":"11111111-0000-0000-0000-00000000000b","observed_at":"2026-09-29T08:06:00Z","species":"cat","location":{"latitude":36.801,"longitude":10.181}}]}') IS NOT NULL AS a_submitted;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT public.accept_consent(1, 'en') IS NULL AS consented_b;
SELECT public.submit_survey_bundle('{"session":{"id":"cccccccc-0000-0000-0000-00000000000b","protocol":"incidental","start_time":"2026-09-29T09:00:00Z","complete_session":false},"observations":[{"id":"11111111-0000-0000-0000-00000000000c","observed_at":"2026-09-29T09:00:00Z","species":"dog","location":{"latitude":-12.05,"longitude":-77.04}}]}') IS NOT NULL AS b_submitted;
RESET ROLE;

-- 1. Distinct codes across users, sequential per species, right format
SELECT CASE WHEN count(*) = 3 AND count(DISTINCT public_code) = 3
             AND bool_and(public_code ~ '^(CAT|DOG|OBS)-[0-9]{6}$')
             AND (SELECT public_code FROM public.observations WHERE id = '11111111-0000-0000-0000-00000000000c')
                 > (SELECT public_code FROM public.observations WHERE id = '11111111-0000-0000-0000-00000000000a')
             AND (SELECT public_code FROM public.observations WHERE id = '11111111-0000-0000-0000-00000000000b') LIKE 'CAT-%'
  THEN 'PASS 1: two users get distinct per-species sequential codes'
  ELSE 'FAIL 1: ' || string_agg(public_code, ',') END
FROM public.observations;

-- 2. A client cannot rename an observation's code
-- (column privileges refuse the write outright; the trigger is a second layer)
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
DO $$ BEGIN
  UPDATE public.observations SET public_code = 'DOG-999999' WHERE id = '11111111-0000-0000-0000-00000000000a';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
SELECT CASE WHEN public_code <> 'DOG-999999'
  THEN 'PASS 2: clients cannot change a code' ELSE 'FAIL 2: code was changed' END
FROM public.observations WHERE id = '11111111-0000-0000-0000-00000000000a';

-- 3. The unique index refuses duplicates even from the database owner
DO $$ BEGIN
  UPDATE public.observations SET public_code = (SELECT public_code FROM public.observations WHERE id = '11111111-0000-0000-0000-00000000000a')
  WHERE id = '11111111-0000-0000-0000-00000000000c';
  RAISE EXCEPTION 'FAIL 3: duplicate code accepted';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 3: duplicate codes are impossible';
END $$;

-- 4. Exact map rows are your own (privacy_and_integrity); every code stays
--    readable to signed-in users through observation_cards, rounded for others
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT CASE WHEN (SELECT count(*) FROM public.observations_map) = 1
         AND (SELECT count(public_code) FROM public.observation_cards((SELECT array_agg(id) FROM public.observations))) = 3
  THEN 'PASS 4: the exact map shows your own sightings; codes stay visible for all' ELSE 'FAIL 4' END;
RESET ROLE;

ROLLBACK;
