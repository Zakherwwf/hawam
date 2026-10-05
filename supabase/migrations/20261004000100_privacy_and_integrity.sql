-- Privacy and integrity hardening (security review, 2026-10-04).
--
-- 1. Who sees exact positions. Signed-in volunteers see each other's
--    profiles and totals (cats and dogs counted, surveys, kilometres,
--    colonies and packs registered or visited), but not each other's walked
--    tracks or the exact spots of each other's animals. Exact positions stay
--    with the record's owner and with researchers/admins. Elsewhere a
--    volunteer gets positions rounded to about 100 m (3 decimal places),
--    enough for "is this the same animal?" within 300 m, not enough to walk
--    straight to it. This reverses the open-georeferencing decision of
--    2026-09-24 for locations only; reading names and counts stays open.
--
-- 2. Effort cannot be edited after upload. The server checks (speed, mock
--    GPS, jumps) run once, when a session is inserted. A direct PATCH could
--    then raise distance_km or flip complete_session and the session kept
--    its "valid" grade and its leaderboard kilometres. Effort and covariate
--    columns are now fixed for client roles once the row exists (the sync
--    functions, which run as owner, are unaffected); the same for the
--    species, size and time of an observation.
--
-- 3. Consent columns are private to their account, as the 2026-09-24
--    migration intended but did not enforce: column privileges on users now
--    expose only the profile columns, and consent is written only through
--    accept_consent().
--
-- 4. people_stats: the public profile figures, one row per person.

-- ---------------------------------------------------------------------------
-- 1. Exact positions: owner or researcher
-- ---------------------------------------------------------------------------

create or replace function public.can_read_precise_locations()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_researcher();
$$;

comment on function public.can_read_precise_locations() is
  'Location gate: researchers and admins. Volunteers read exact positions of their own records only.';

-- Animal positions (observer and animal points)
drop policy if exists observation_locations_select_researcher on public.observation_locations;
drop policy if exists observation_locations_select on public.observation_locations;
create policy observation_locations_select on public.observation_locations
  for select to authenticated
  using (
    public.is_researcher()
    or exists (
      select 1
      from public.observations o
      join public.sessions s on s.id = o.session_id
      where o.id = observation_locations.observation_id and s.observer_id = auth.uid()
    )
  );

-- Walked lines
drop policy if exists session_tracks_select_researcher on public.session_tracks;
drop policy if exists session_tracks_select on public.session_tracks;
create policy session_tracks_select on public.session_tracks
  for select to authenticated
  using (
    public.is_researcher()
    or exists (select 1 from public.sessions s where s.id = session_tracks.session_id and s.observer_id = auth.uid())
  );

-- Raw GPS fixes: your own always; researchers outside the walker's privacy zones
drop policy if exists track_points_select on public.track_points;
create policy track_points_select on public.track_points
  for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = track_points.session_id
        and (
          s.observer_id = auth.uid()
          or (public.is_researcher() and not public.is_in_privacy_zone(s.observer_id, track_points.location))
        )
    )
  );

-- Known animals: exact last position for researchers and for animals whose
-- latest sighting is your own; rounded to ~100 m for everyone else. The view
-- runs with its owner's rights so the rounding can read the restricted table;
-- every column it returns is already readable to signed-in users.
create or replace view public.individuals_app
with (security_invoker = off) as
select
  i.id,
  i.species,
  i.nickname,
  i.coat_pattern,
  i.created_by,
  i.created_at,
  i.first_seen,
  i.last_seen,
  i.sightings_count,
  case when last_obs.mine or public.is_researcher() then last_obs.latitude else round(last_obs.latitude::numeric, 3)::double precision end as latitude,
  case when last_obs.mine or public.is_researcher() then last_obs.longitude else round(last_obs.longitude::numeric, 3)::double precision end as longitude,
  last_obs.observation_id as last_observation_id,
  photo.storage_path as photo_path,
  coalesce(sides.has_left, false) as has_left_flank,
  coalesce(sides.has_right, false) as has_right_flank,
  (select count(*) from public.individual_links l where l.individual_id = i.id and l.status = 'proposed')::integer as pending_links
from public.individuals i
left join lateral (
  select
    l.observation_id,
    extensions.ST_Y(ol.location_precise) as latitude,
    extensions.ST_X(ol.location_precise) as longitude,
    s.observer_id = auth.uid() as mine
  from public.individual_links l
  join public.observations o on o.id = l.observation_id
  join public.sessions s on s.id = o.session_id
  join public.observation_locations ol on ol.observation_id = o.id
  where l.individual_id = i.id and l.status <> 'rejected' and o.deleted_at is null
  order by o.observed_at desc
  limit 1
) last_obs on true
left join lateral (
  select p.storage_path
  from public.individual_links l
  join public.photos p on p.observation_id = l.observation_id
  where l.individual_id = i.id and l.status <> 'rejected' and p.deleted_at is null
  order by (p.angle in ('left_flank', 'right_flank')) desc, p.taken_at desc
  limit 1
) photo on true
left join lateral (
  select bool_or(p.angle = 'left_flank') as has_left, bool_or(p.angle = 'right_flank') as has_right
  from public.individual_links l
  join public.photos p on p.observation_id = l.observation_id
  where l.individual_id = i.id and l.status <> 'rejected'
) sides on true
where auth.uid() is not null;

comment on view public.individuals_app is
  'Known animals with their latest position (exact for researchers and the '
  'owner of that sighting, ~100 m otherwise), photo and photographed flanks.';

revoke all on public.individuals_app from anon, authenticated;
grant select on public.individuals_app to authenticated;

-- Sighting cards for profiles: one row per observation, with the position
-- exact for its owner and researchers and rounded to ~100 m for others; the
-- observer's standing point, bearing and distance only for owner/researcher.
create or replace function public.observation_cards(ids uuid[])
returns table (
  id uuid,
  observed_at timestamptz,
  species public.species,
  group_size integer,
  public_code text,
  observer_id uuid,
  observer_name text,
  body_condition_score smallint,
  sex public.sex,
  age_class public.age_class,
  ear_tip_or_notch public.tristate,
  coat_pattern public.coat_pattern,
  notes text,
  latitude double precision,
  longitude double precision,
  exact boolean,
  observer_latitude double precision,
  observer_longitude double precision,
  bearing_deg double precision,
  distance_estimate_m double precision,
  perpendicular_distance_m double precision
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    o.id,
    o.observed_at,
    o.species,
    o.group_size,
    o.public_code,
    s.observer_id,
    u.display_name,
    o.body_condition_score,
    o.sex,
    o.age_class,
    o.ear_tip_or_notch,
    o.coat_pattern,
    o.notes,
    case when full_view then ST_Y(ol.animal_location) else round(ST_Y(ol.animal_location)::numeric, 3)::double precision end,
    case when full_view then ST_X(ol.animal_location) else round(ST_X(ol.animal_location)::numeric, 3)::double precision end,
    full_view,
    case when full_view then ST_Y(ol.location_precise) end,
    case when full_view then ST_X(ol.location_precise) end,
    case when full_view then ol.bearing_deg end,
    case when full_view then ol.distance_estimate_m end,
    o.distance_computed_m
  from public.observations o
  join public.sessions s on s.id = o.session_id
  left join public.users u on u.id = s.observer_id
  left join public.observation_locations ol on ol.observation_id = o.id
  cross join lateral (select (s.observer_id = auth.uid() or public.is_researcher()) as full_view) v
  where auth.uid() is not null
    and o.id = any (ids)
    and o.deleted_at is null
  limit 500;
$$;

revoke all on function public.observation_cards(uuid[]) from public, anon;
grant execute on function public.observation_cards(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Effort and observations are fixed once uploaded (client roles)
-- ---------------------------------------------------------------------------

create or replace function public.protect_session_effort()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Not security definer: current_user is the caller. The sync functions run
  -- as owner and may still correct a session; a direct PATCH may not.
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.observer_id := old.observer_id;
    new.protocol := old.protocol;
    new.route_id := old.route_id;
    new.route_version := old.route_version;
    new.start_time := old.start_time;
    new.end_time := old.end_time;
    new.distance_km := old.distance_km;
    new.complete_session := old.complete_session;
    new.number_of_observers := old.number_of_observers;
    new.weather := old.weather;
    new.time_of_day := old.time_of_day;
    new.device_gps_accuracy_avg := old.device_gps_accuracy_avg;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_session_effort() from public, anon, authenticated;

drop trigger if exists sessions_protect_effort on public.sessions;
create trigger sessions_protect_effort
  before update on public.sessions
  for each row execute function public.protect_session_effort();

create or replace function public.protect_observation_counts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.session_id := old.session_id;
    new.species := old.species;
    new.group_size := old.group_size;
    new.observed_at := old.observed_at;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_observation_counts() from public, anon, authenticated;

drop trigger if exists observations_protect_counts on public.observations;
create trigger observations_protect_counts
  before update on public.observations
  for each row execute function public.protect_observation_counts();

-- ---------------------------------------------------------------------------
-- 3. Consent columns private; consent written by accept_consent() only
-- ---------------------------------------------------------------------------

revoke select, update, insert on public.users from authenticated;
grant select (id, role, display_name, preferred_language, created_at) on public.users to authenticated;
-- role stays guarded by users_update_self (no self-promotion) and users_admin_all.
-- The consent columns stay writable by their own row's owner (users_update_self)
-- because app builds already installed write consent directly; they are no
-- longer readable by anyone else, which was the exposure. Current builds use
-- accept_consent().
grant update (display_name, preferred_language, role, consent_version, consent_accepted_at) on public.users to authenticated;

-- Accepting again keeps the first acceptance time unless the version changes
create or replace function public.accept_consent(version integer, language public.language default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'accept_consent: authentication required' using errcode = '28000';
  end if;
  update public.users u
  set consent_accepted_at = case
        when u.consent_accepted_at is null or u.consent_version is distinct from accept_consent.version then now()
        else u.consent_accepted_at
      end,
      consent_version = accept_consent.version,
      preferred_language = coalesce(accept_consent.language, u.preferred_language)
  where u.id = auth.uid();
end;
$$;

revoke execute on function public.accept_consent(integer, public.language) from public, anon;
grant execute on function public.accept_consent(integer, public.language) to authenticated;

-- Your own consent state, for the app
create or replace function public.my_consent()
returns table (consent_version integer, consent_accepted_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.consent_version, u.consent_accepted_at from public.users u where u.id = auth.uid();
$$;

revoke all on function public.my_consent() from public, anon;
grant execute on function public.my_consent() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Public profile figures
-- ---------------------------------------------------------------------------

create or replace view public.people_stats
with (security_invoker = on) as
select
  u.id as user_id,
  u.display_name,
  u.role,
  u.created_at as member_since,
  coalesce(w.surveys, 0) as surveys,
  coalesce(w.km, 0) as distance_km,
  coalesce(w.complete, 0) as complete_checklists,
  w.last_survey_at,
  coalesce(a.cats, 0) as cats_counted,
  coalesce(a.dogs, 0) as dogs_counted,
  coalesce(a.sightings, 0) as sightings,
  coalesce(c.colonies, 0) as colonies_registered,
  coalesce(c.packs, 0) as packs_registered,
  coalesce(v.colonies, 0) as colonies_visited,
  coalesce(v.packs, 0) as packs_visited
from public.users u
left join lateral (
  select
    count(*) filter (where s.protocol <> 'incidental')::integer as surveys,
    round(sum(coalesce(s.distance_km, 0)) filter (where s.protocol = 'transect')::numeric, 2)::double precision as km,
    count(*) filter (where s.protocol <> 'incidental' and s.complete_session)::integer as complete,
    max(s.start_time) as last_survey_at
  from public.sessions s
  where s.observer_id = u.id and s.deleted_at is null and s.validation_status <> 'flagged'
) w on true
left join lateral (
  select
    sum(o.group_size) filter (where o.species = 'cat')::integer as cats,
    sum(o.group_size) filter (where o.species = 'dog')::integer as dogs,
    count(*)::integer as sightings
  from public.observations o
  join public.sessions s on s.id = o.session_id
  where s.observer_id = u.id and o.deleted_at is null and s.deleted_at is null and s.validation_status <> 'flagged'
) a on true
left join lateral (
  select
    count(*) filter (where coalesce(c.species, case c.type when 'dog_pack_area' then 'dog' else 'cat' end) <> 'dog')::integer as colonies,
    count(*) filter (where coalesce(c.species, case c.type when 'dog_pack_area' then 'dog' else 'cat' end) = 'dog')::integer as packs
  from public.colonies c
  where c.created_by = u.id and c.deleted_at is null
) c on true
left join lateral (
  select
    count(distinct cv.colony_id) filter (where coalesce(c.species, case c.type when 'dog_pack_area' then 'dog' else 'cat' end) <> 'dog')::integer as colonies,
    count(distinct cv.colony_id) filter (where coalesce(c.species, case c.type when 'dog_pack_area' then 'dog' else 'cat' end) = 'dog')::integer as packs
  from public.colony_visits cv
  join public.colonies c on c.id = cv.colony_id
  where cv.user_id = u.id and c.deleted_at is null
) v on true;

comment on view public.people_stats is
  'Public profile figures per person: surveys, km, complete checklists, cats '
  'and dogs counted, colonies and packs registered or visited. Flagged '
  'sessions are left out. No locations.';

revoke all on public.people_stats from anon, authenticated;
grant select on public.people_stats to authenticated;
