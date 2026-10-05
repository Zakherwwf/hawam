-- Georeferencing opened to every signed-in user.
--
-- This reverses the project's original location rule at the owner's explicit
-- instruction. Exact animal positions and complete survey tracks are now
-- readable by any authenticated account; the previous model showed them only
-- to researchers and published 1 km cells to everyone else.
--
-- What this means in practice, recorded here so it is not rediscovered later:
-- sign-up is self-service, so "any signed-in user" is effectively "anyone who
-- registers an email". If that is ever not the intent, the lever is sign-up
-- (invite or approval), not this file -- tightening the gate here again would
-- break the map, the tracks and the leaderboard that now depend on it.
--
-- Two things are deliberately NOT opened:
--   * anon still has nothing. Reading anything requires an account.
--   * curation stays with researchers: routes, confirmed individuals and photo
--     matches are scientific records, not user content.

-- ---------------------------------------------------------------------------
-- Split the gate in two.
--
-- can_read_precise_locations() used to mean "is a researcher", and was reused
-- for curation writes. Widening it without splitting would have let any
-- volunteer edit fixed routes and confirm individual identities.
-- ---------------------------------------------------------------------------

create or replace function public.is_researcher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() in ('researcher', 'admin'), false);
$$;

comment on function public.is_researcher() is
  'Curation gate: who may edit routes, individuals and photo matches.';

create or replace function public.can_read_precise_locations()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Any signed-in account. Not anon.
  select auth.uid() is not null;
$$;

comment on function public.can_read_precise_locations() is
  'Location gate. Now true for every signed-in user: exact coordinates and '
  'survey tracks are shared with the whole signed-in community.';

revoke execute on function public.is_researcher() from public, anon;
grant execute on function public.is_researcher() to authenticated;

-- ---------------------------------------------------------------------------
-- Curation policies move to the researcher gate.
-- ---------------------------------------------------------------------------

drop policy if exists routes_write_researcher on public.routes;
create policy routes_write_researcher on public.routes
  for all to authenticated
  using (public.is_researcher())
  with check (public.is_researcher());

drop policy if exists individuals_write_researcher on public.individuals;
create policy individuals_write_researcher on public.individuals
  for all to authenticated
  using (public.is_researcher())
  with check (public.is_researcher());

drop policy if exists individual_matches_researcher on public.individual_matches;
create policy individual_matches_researcher on public.individual_matches
  for all to authenticated
  using (public.is_researcher())
  with check (public.is_researcher());

drop policy if exists observations_researcher_link on public.observations;
create policy observations_researcher_link on public.observations
  for update to authenticated
  using (public.is_researcher())
  with check (public.is_researcher());

-- ---------------------------------------------------------------------------
-- Reading is now community-wide. Writing stays with the record's owner.
-- ---------------------------------------------------------------------------

drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_all on public.sessions
  for select to authenticated
  using (true);

drop policy if exists observations_select_own on public.observations;
create policy observations_select_all on public.observations
  for select to authenticated
  using (true);

drop policy if exists photos_select_own on public.photos;
create policy photos_select_all on public.photos
  for select to authenticated
  using (true);

-- Profiles are public to signed-in users now, because leaderboards and
-- attribution name people. The consent columns stay private to the account:
-- when someone accepted a consent text is nobody else's business.
drop policy if exists users_select_self on public.users;
create policy users_select_all on public.users
  for select to authenticated
  using (true);

-- Photos follow the same rule as everything else.
drop policy if exists "animal photos: read own or researcher" on storage.objects;
create policy "animal photos: read signed in"
  on storage.objects for select to authenticated
  using (bucket_id = 'animal-photos');

-- ---------------------------------------------------------------------------
-- Exact-location views for the map.
--
-- security_invoker = on: these carry no privilege of their own, they just
-- reshape what the caller may already read.
-- ---------------------------------------------------------------------------

create or replace view public.observations_map
with (security_invoker = on) as
select
  o.id,
  o.session_id,
  o.observed_at,
  o.species,
  o.group_size,
  o.sex,
  o.age_class,
  o.body_condition_score,
  o.coat_pattern,
  o.ear_tip_or_notch,
  o.notes,
  extensions.ST_Y(ol.location_precise) as latitude,
  extensions.ST_X(ol.location_precise) as longitude,
  o.gps_accuracy_m,
  s.observer_id,
  u.display_name as observer_name,
  s.protocol
from public.observations o
join public.observation_locations ol on ol.observation_id = o.id
join public.sessions s on s.id = o.session_id
left join public.users u on u.id = s.observer_id;

comment on view public.observations_map is
  'Exact animal positions with the recorder''s name. Signed-in users only.';

create or replace view public.session_tracks_geojson
with (security_invoker = on) as
select
  t.session_id,
  s.observer_id,
  u.display_name as observer_name,
  s.protocol,
  s.start_time,
  s.end_time,
  s.duration_min,
  s.distance_km,
  s.complete_session,
  t.point_count,
  extensions.ST_AsGeoJSON(t.track) as track_geojson
from public.session_tracks t
join public.sessions s on s.id = t.session_id
left join public.users u on u.id = s.observer_id;

comment on view public.session_tracks_geojson is
  'Walked survey routes as GeoJSON, ready for a map. Signed-in users only.';

grant select on public.observations_map to authenticated;
grant select on public.session_tracks_geojson to authenticated;
revoke all on public.observations_map from anon;
revoke all on public.session_tracks_geojson from anon;
