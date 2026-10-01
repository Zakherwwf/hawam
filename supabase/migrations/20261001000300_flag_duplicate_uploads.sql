-- Data fix: walks the app uploaded more than once.
--
-- Until the fix in the app (one upload queue, one uploader, stable ids for
-- old records), the same quick sighting could be sent again under a new
-- session id, sometimes from a different account signed in on the phone.
-- A copy has the exact same start time and the exact same sightings
-- (species and time to the millisecond). The first upload is kept as is;
-- later copies are flagged 'duplicate_upload', which leaves them out of
-- statistics, exports, leaderboards and the shared map. Nothing is deleted.

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
