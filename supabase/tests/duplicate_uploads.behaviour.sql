-- Behavioural check for 20261001000300_flag_duplicate_uploads (re-run on test data).
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('dddddddd-0000-0000-0000-00000000000d', 'd@example.org'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'e@example.org');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-00000000000d', true);
SELECT public.accept_consent(1, 'en') IS NULL;
SELECT public.submit_survey_bundle('{"session":{"id":"d0000000-0000-0000-0000-000000000001","protocol":"incidental","start_time":"2026-09-25T14:51:18.742Z","end_time":"2026-09-25T14:51:18.742Z","complete_session":false},"observations":[{"id":"d1000000-0000-0000-0000-000000000001","observed_at":"2026-09-25T14:51:18.742Z","species":"cat","group_size":1,"location":{"latitude":36.8,"longitude":10.18},"observer_location":{"latitude":36.8,"longitude":10.18}}]}') IS NOT NULL;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-00000000000e', true);
SELECT public.accept_consent(1, 'en') IS NULL;
-- The same sighting sent again under a new id from another account
SELECT public.submit_survey_bundle('{"session":{"id":"d0000000-0000-0000-0000-000000000002","protocol":"incidental","start_time":"2026-09-25T14:51:18.742Z","end_time":"2026-09-25T14:51:18.742Z","complete_session":false},"observations":[{"id":"d1000000-0000-0000-0000-000000000002","observed_at":"2026-09-25T14:51:18.742Z","species":"cat","group_size":1,"location":{"latitude":36.8,"longitude":10.18},"observer_location":{"latitude":36.8,"longitude":10.18}}]}') IS NOT NULL;
-- A different sighting at the same start time is not a copy
SELECT public.submit_survey_bundle('{"session":{"id":"d0000000-0000-0000-0000-000000000003","protocol":"incidental","start_time":"2026-09-25T14:51:18.742Z","end_time":"2026-09-25T14:51:18.742Z","complete_session":false},"observations":[{"id":"d1000000-0000-0000-0000-000000000003","observed_at":"2026-09-25T14:51:18.742Z","species":"dog","group_size":1,"location":{"latitude":36.8,"longitude":10.18},"observer_location":{"latitude":36.8,"longitude":10.18}}]}') IS NOT NULL;
SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;
UPDATE public.sessions SET created_at = '2026-09-29T00:00:00Z' WHERE id = 'd0000000-0000-0000-0000-000000000001';
-- Same statement as the migration (psql reads tests from stdin, so no \i)
with sig as (
  select
    s.id,
    s.start_time,
    s.created_at,
    (
      select string_agg(o.species::text || '@' || o.observed_at::text, ',' order by o.observed_at, o.species)
      from public.observations o
      where o.session_id = s.id
    ) as sightings
  from public.sessions s
),
ranked as (
  select id, row_number() over (partition by start_time, sightings order by created_at, id) as n
  from sig
  where sightings is not null
)
update public.sessions s
set validation_status = 'flagged',
    validation_reasons = array_append(
      array_remove(s.validation_reasons, 'duplicate_upload'), 'duplicate_upload')
from ranked r
where r.id = s.id and r.n > 1;
SELECT CASE WHEN
  (SELECT validation_status FROM public.sessions WHERE id = 'd0000000-0000-0000-0000-000000000001') <> 'flagged'
  AND (SELECT validation_status = 'flagged' AND 'duplicate_upload' = ANY (validation_reasons) FROM public.sessions WHERE id = 'd0000000-0000-0000-0000-000000000002')
  AND (SELECT validation_status FROM public.sessions WHERE id = 'd0000000-0000-0000-0000-000000000003') <> 'flagged'
  AND (SELECT count(*) FROM public.sessions WHERE id::text LIKE 'd0000000%') = 3
  THEN 'PASS 1: the later copy is flagged, the first and a different sighting are kept, nothing deleted'
  ELSE 'FAIL 1: duplicate flagging' END;
ROLLBACK;
