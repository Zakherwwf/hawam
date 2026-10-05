-- Behavioural checks for 20261001000100_reidentification.
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.org'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.org'),
  ('cccccccc-0000-0000-0000-00000000000c', 'r@example.org');
UPDATE public.users SET role = 'researcher' WHERE id = 'cccccccc-0000-0000-0000-00000000000c';

SET ROLE authenticated;
-- A registers Ginger from a cat sighting with a left-flank photo
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
SELECT public.accept_consent(1, 'en') IS NULL;
SELECT (public.submit_survey_bundle('{"session":{"id":"50000000-0000-0000-0000-000000000001","protocol":"incidental","start_time":"2026-09-30T08:00:00Z","complete_session":false},
 "observations":[{"id":"60000000-0000-0000-0000-000000000001","observed_at":"2026-09-30T08:00:00Z","species":"cat","coat_pattern":"tabby","location":{"latitude":36.80,"longitude":10.18},
   "individual":{"id":"70000000-0000-0000-0000-000000000001","new":true,"nickname":"Ginger","coat_pattern":"tabby"}}],
 "photos":[{"id":"80000000-0000-0000-0000-000000000001","observation_id":"60000000-0000-0000-0000-000000000001","storage_path":"a/x.jpg","angle":"left_flank","taken_at":"2026-09-30T08:00:00Z"}]}') ->> 'individual_links')::int = 1 AS registered;

-- B resights Ginger nearby; B also tries to link A's observation, and a dog to Ginger
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT public.accept_consent(1, 'en') IS NULL;
SELECT (public.submit_survey_bundle('{"session":{"id":"50000000-0000-0000-0000-000000000002","protocol":"incidental","start_time":"2026-09-30T10:00:00Z","complete_session":false},
 "observations":[
   {"id":"60000000-0000-0000-0000-000000000002","observed_at":"2026-09-30T10:00:00Z","species":"cat","location":{"latitude":36.8001,"longitude":10.1801},"individual":{"id":"70000000-0000-0000-0000-000000000001","decision":"same"}},
   {"id":"60000000-0000-0000-0000-000000000003","observed_at":"2026-09-30T10:01:00Z","species":"dog","location":{"latitude":36.8001,"longitude":10.1801},"individual":{"id":"70000000-0000-0000-0000-000000000001","decision":"same"}}],
 "photos":[{"id":"80000000-0000-0000-0000-000000000002","observation_id":"60000000-0000-0000-0000-000000000002","storage_path":"b/y.jpg","angle":"right_flank","taken_at":"2026-09-30T10:00:00Z"}]}') ->> 'individual_links')::int = 1 AS one_link;
RESET ROLE;

SELECT CASE WHEN (SELECT count(*) FROM public.individuals) = 1
             AND (SELECT created_by FROM public.individuals) = 'aaaaaaaa-0000-0000-0000-00000000000a'
             AND (SELECT status FROM public.individual_links WHERE is_founder) = 'confirmed'
             AND (SELECT linked_individual_id FROM public.observations WHERE id = '60000000-0000-0000-0000-000000000001') = '70000000-0000-0000-0000-000000000001'
  THEN 'PASS 1: a new animal is registered with a confirmed founding sighting' ELSE 'FAIL 1' END;

SELECT CASE WHEN count(*) = 1 AND bool_and(status = 'proposed' AND proposed_by = 'bbbbbbbb-0000-0000-0000-00000000000b')
  THEN 'PASS 2: a resighting is proposed; a dog cannot be linked to a cat' ELSE 'FAIL 2: ' || count(*) END
FROM public.individual_links WHERE NOT is_founder;

-- 3. A volunteer cannot confirm, a researcher can
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
UPDATE public.individual_links SET status = 'confirmed' WHERE NOT is_founder;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
SELECT CASE WHEN (SELECT status FROM public.individual_links WHERE NOT is_founder) = 'proposed'
  THEN 'PASS 3a: volunteers cannot confirm matches' ELSE 'FAIL 3a' END;
UPDATE public.individual_links SET status = 'confirmed' WHERE NOT is_founder;
RESET ROLE;
SELECT CASE WHEN l.status = 'confirmed' AND l.reviewer_id = 'cccccccc-0000-0000-0000-00000000000c' AND l.reviewed_at IS NOT NULL
             AND o.linked_individual_id = l.individual_id AND i.sightings_count = 2 AND i.last_seen = '2026-09-30T10:00:00Z'
  THEN 'PASS 3b: a researcher confirms; reviewer, sighting link and totals follow' ELSE 'FAIL 3b' END
FROM public.individual_links l
JOIN public.observations o ON o.id = l.observation_id
JOIN public.individuals i ON i.id = l.individual_id
WHERE NOT l.is_founder;

-- 4. individuals_app: position, photo and both flanks now known
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
-- The latest sighting is B's: A sees it rounded to ~100 m (privacy_and_integrity), B exactly
SELECT CASE WHEN nickname = 'Ginger' AND has_left_flank AND has_right_flank AND abs(latitude - 36.800) < 1e-9 AND photo_path IS NOT NULL AND pending_links = 0
  THEN 'PASS 4: individuals_app shows the latest position (rounded for others), photo and flanks' ELSE 'FAIL 4' END
FROM public.individuals_app;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
SELECT CASE WHEN abs(latitude - 36.8001) < 1e-9
  THEN 'PASS 4b: the owner of the latest sighting sees the exact position' ELSE 'FAIL 4b' END
FROM public.individuals_app;
RESET ROLE;

-- 5. anon cannot see individuals or links; the core RPC is not callable directly
SELECT CASE WHEN NOT has_table_privilege('anon', 'public.individuals_app', 'select')
             AND NOT has_table_privilege('anon', 'public.individual_links', 'select')
             AND NOT has_function_privilege('authenticated', 'public.submit_survey_bundle_core(jsonb)', 'execute')
             AND has_function_privilege('authenticated', 'public.submit_survey_bundle(jsonb)', 'execute')
  THEN 'PASS 5: no anon access; only the wrapper RPC is callable' ELSE 'FAIL 5' END;
ROLLBACK;
