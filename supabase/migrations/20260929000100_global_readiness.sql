-- Global readiness, on top of the live schema (TECHNICAL_REVIEW.md §5, §8).
--
-- 1. Worldwide 1 km grid. generalize_point() projected through UTM zone 32N,
--    which is true-scale only around Tunisia: cells shrank to ~500 m in Asia,
--    and anywhere west of zone 32 the easting went negative and the function
--    raised "coordinate outside the supported grid", so every survey from the
--    Americas failed to sync. The replacement keeps the signature and output
--    columns (every trigger and RPC calls it unchanged) and uses 1 km latitude
--    bands with a per-band longitude step, identical to generalizeTo1KmGrid()
--    in packages/shared/src/grid.ts. Existing rows are regenerated.
-- 2. country_code / admin1_code / timezone / observed_at_local on observations
--    and country_code / timezone on sessions, resolved in PostGIS against
--    reference polygons loaded by supabase/scripts/load_reference_geography.mjs.
-- 3. GBIF taxonomy lookup and a generalised Darwin Core view.
-- 4. Per-user daily quota for the analyze-photo Edge Function.
-- 5. export_my_data(): right of access (GDPR Art. 15). Erasure already exists
--    as delete_my_account().
--
-- Partitioning decision (§8.5): when observations passes ~5M rows, partition
-- by RANGE (observed_at) monthly; country is served by the index below.

-- ---------------------------------------------------------------------------
-- 1. Worldwide grid
-- ---------------------------------------------------------------------------

create or replace function public.generalize_point(
  precise extensions.geometry (Point, 4326),
  gps_accuracy_m double precision default null
)
returns table (
  grid_cell_id text,
  location_public extensions.geometry (Point, 4326),
  coordinate_uncertainty_m double precision,
  data_generalizations text,
  information_withheld text
)
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  -- half the diagonal of a 1 km square: the furthest a point sits from its centroid
  half_diagonal_m constant double precision := 707;
  lat_step constant double precision := 1000.0 / 111000.0;
  lat double precision;
  lat_index bigint;
  lon_step double precision;
  lon_index bigint;
  accuracy double precision;
begin
  if precise is null then
    raise exception 'generalize_point: precise location is required';
  end if;

  lat := greatest(-85.0, least(85.0, extensions.ST_Y(precise)));
  lat_index := floor(lat / lat_step)::bigint;
  lon_step := 1000.0 / (111000.0 * cos(radians((lat_index + 0.5) * lat_step)));
  lon_index := floor(extensions.ST_X(precise) / lon_step)::bigint;

  grid_cell_id := '1KM-'
    || case when lat_index >= 0 then 'N' else 'S' end || abs(lat_index)::text
    || '-'
    || case when lon_index >= 0 then 'E' else 'W' end || abs(lon_index)::text;

  location_public := extensions.ST_SetSRID(
    extensions.ST_MakePoint(
      round(((lon_index + 0.5) * lon_step)::numeric, 5)::double precision,
      round(((lat_index + 0.5) * lat_step)::numeric, 5)::double precision
    ),
    4326
  );

  accuracy := case when gps_accuracy_m is not null and gps_accuracy_m > 0
                   then gps_accuracy_m else 0 end;
  coordinate_uncertainty_m := ceil(half_diagonal_m + accuracy);

  data_generalizations :=
    'Coordinates generalized to the centroid of a worldwide 1 km grid cell.';
  information_withheld :=
    'Precise coordinates withheld to protect free-roaming animals from culling and poisoning. '
    'Available to approved researchers on request.';

  return next;
end;
$$;

comment on function public.generalize_point is
  'Reduce a precise WGS84 point to its worldwide 1 km grid cell centroid. Every '
  'published coordinate in this system passes through here first. Twin of '
  'generalizeTo1KmGrid() in packages/shared.';

-- Regenerate published columns: re-saving the precise point fires
-- observation_locations_sync_public, which calls generalize_point().
update public.observation_locations set location_precise = location_precise;

-- ---------------------------------------------------------------------------
-- 2. Reference geography and attribution
-- ---------------------------------------------------------------------------

-- Polygons are stored subdivided so point lookups touch small geometries;
-- several rows can share one code.
create table if not exists public.ref_countries (
  id bigserial primary key,
  iso_a2 char(2) not null,
  name text not null,
  geom extensions.geometry (Polygon, 4326) not null
);
create index if not exists ref_countries_geom_idx on public.ref_countries using gist (geom);

create table if not exists public.ref_admin1 (
  id bigserial primary key,
  code text not null,          -- ISO 3166-2, e.g. TN-11
  iso_a2 char(2) not null,
  name text not null,
  geom extensions.geometry (Polygon, 4326) not null
);
create index if not exists ref_admin1_geom_idx on public.ref_admin1 using gist (geom);

create table if not exists public.ref_timezones (
  id bigserial primary key,
  tzid text not null,          -- IANA name, e.g. Africa/Tunis
  geom extensions.geometry (Polygon, 4326) not null
);
create index if not exists ref_timezones_geom_idx on public.ref_timezones using gist (geom);

alter table public.ref_countries enable row level security;
alter table public.ref_admin1 enable row level security;
alter table public.ref_timezones enable row level security;
create policy "reference countries readable" on public.ref_countries
  for select to authenticated using (true);
create policy "reference admin1 readable" on public.ref_admin1
  for select to authenticated using (true);
create policy "reference timezones readable" on public.ref_timezones
  for select to authenticated using (true);
grant select on public.ref_countries, public.ref_admin1, public.ref_timezones to authenticated;

alter table public.observations
  add column if not exists country_code char(2),
  add column if not exists admin1_code text,
  add column if not exists timezone text,
  add column if not exists observed_at_local timestamp;  -- wall-clock time where the animal was seen
create index if not exists observations_country_observed_idx
  on public.observations (country_code, observed_at);
create index if not exists observations_cell_observed_idx
  on public.observations (grid_cell_id, observed_at);

alter table public.sessions
  add column if not exists country_code char(2),
  add column if not exists timezone text;

-- Country, first-level region and IANA timezone for a point. Points just
-- offshore or on a simplified coastline fall back to the nearest polygon
-- within 10 km. Timezone polygons include oceans, so tz is always found once
-- they are loaded.
create or replace function public.resolve_geography(
  p extensions.geometry,
  out country_code char(2),
  out admin1_code text,
  out timezone text
)
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
begin
  select c.iso_a2 into country_code from public.ref_countries c
  where extensions.ST_Intersects(c.geom, p) limit 1;
  if country_code is null then
    select c.iso_a2 into country_code from public.ref_countries c
    where extensions.ST_DWithin(c.geom::extensions.geography, p::extensions.geography, 10000)
    order by c.geom operator(extensions.<->) p limit 1;
  end if;

  select a.code into admin1_code from public.ref_admin1 a
  where extensions.ST_Intersects(a.geom, p) limit 1;
  if admin1_code is null then
    select a.code into admin1_code from public.ref_admin1 a
    where extensions.ST_DWithin(a.geom::extensions.geography, p::extensions.geography, 10000)
    order by a.geom operator(extensions.<->) p limit 1;
  end if;

  select t.tzid into timezone from public.ref_timezones t
  where extensions.ST_Intersects(t.geom, p) limit 1;
end;
$$;

create or replace function public.local_wall_time(at timestamptz, tz text)
returns timestamp
language plpgsql
stable
as $$
begin
  if at is null or tz is null then
    return null;
  end if;
  return at at time zone tz;
exception when invalid_parameter_value then
  return null;  -- tz name unknown to this Postgres build
end;
$$;

-- Local time follows observed_at and timezone on every write
create or replace function public.set_observation_local_time()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.observed_at_local := public.local_wall_time(new.observed_at, new.timezone);
  return new;
end;
$$;

create trigger observations_set_local_time
  before insert or update of observed_at, timezone on public.observations
  for each row execute function public.set_observation_local_time();

-- Attribution comes from the precise point, after sync_generalized_location
-- has created the published columns. Sessions take the first attribution.
create or replace function public.attribute_observation_geography()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  g record;
begin
  g := public.resolve_geography(new.location_precise);
  update public.observations
  set country_code = coalesce(g.country_code, country_code),
      admin1_code = coalesce(g.admin1_code, admin1_code),
      timezone = coalesce(g.timezone, timezone)
  where id = new.observation_id;

  update public.sessions s
  set country_code = coalesce(s.country_code, g.country_code),
      timezone = coalesce(s.timezone, g.timezone)
  from public.observations o
  where o.id = new.observation_id and s.id = o.session_id;
  return new;
end;
$$;

create trigger observation_locations_attribute_geography
  after insert or update of location_precise on public.observation_locations
  for each row execute function public.attribute_observation_geography();

-- Zero-animal checklists still need a country: take it from the track start
create or replace function public.attribute_session_geography()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  g record;
begin
  g := public.resolve_geography(extensions.ST_StartPoint(new.track));
  update public.sessions
  set country_code = coalesce(country_code, g.country_code),
      timezone = coalesce(timezone, g.timezone)
  where id = new.session_id;
  return new;
end;
$$;

create trigger session_tracks_attribute_geography
  after insert or update of track on public.session_tracks
  for each row execute function public.attribute_session_geography();

-- Fills rows written before the reference polygons were loaded, or all rows
-- when p_force is true (e.g. after a boundary update). Returns rows updated.
create or replace function public.backfill_observation_geography(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  updated integer;
begin
  update public.observations o
  set country_code = g.country_code,
      admin1_code = g.admin1_code,
      timezone = g.timezone
  from public.observation_locations l,
       lateral public.resolve_geography(l.location_precise) g
  where l.observation_id = o.id
    and (p_force or o.country_code is null or o.timezone is null);
  get diagnostics updated = row_count;

  update public.sessions s
  set country_code = coalesce(s.country_code, g.country_code),
      timezone = coalesce(s.timezone, g.timezone)
  from public.session_tracks t,
       lateral public.resolve_geography(extensions.ST_StartPoint(t.track)) g
  where t.session_id = s.id and (p_force or s.country_code is null or s.timezone is null);

  update public.sessions s
  set country_code = coalesce(s.country_code, o.country_code),
      timezone = coalesce(s.timezone, o.timezone)
  from (
    select distinct on (session_id) session_id, country_code, timezone
    from public.observations
    where country_code is not null
    order by session_id, observed_at
  ) o
  where s.id = o.session_id and (s.country_code is null or s.timezone is null);

  return updated;
end;
$$;

revoke all on function public.backfill_observation_geography(boolean) from public, anon, authenticated;
grant execute on function public.backfill_observation_geography(boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Taxonomy and Darwin Core view
-- ---------------------------------------------------------------------------

-- GBIF backbone keys verified against api.gbif.org/v1/species/match
create table if not exists public.ref_taxa (
  species public.species primary key,
  scientific_name text not null,
  taxon_rank text not null,
  gbif_taxon_key integer not null,
  vernacular_name text not null
);
insert into public.ref_taxa values
  ('cat', 'Felis catus Linnaeus, 1758', 'species', 2435035, 'domestic cat'),
  ('dog', 'Canis lupus familiaris Linnaeus, 1758', 'subspecies', 6164210, 'domestic dog'),
  ('unknown', 'Carnivora', 'order', 732, 'unidentified carnivore')
on conflict (species) do update set
  scientific_name = excluded.scientific_name,
  taxon_rank = excluded.taxon_rank,
  gbif_taxon_key = excluded.gbif_taxon_key,
  vernacular_name = excluded.vernacular_name;
alter table public.ref_taxa enable row level security;
create policy "taxa readable" on public.ref_taxa for select to authenticated using (true);
grant select on public.ref_taxa to authenticated;

-- Generalised occurrences only; security_invoker keeps the caller's RLS.
create or replace view public.dwc_occurrence
with (security_invoker = true) as
select
  o.id as "occurrenceID",
  'HumanObservation' as "basisOfRecord",
  o.session_id as "eventID",
  o.observed_at as "eventDate",
  o.observed_at_local as "eventLocalDateTime",
  o.timezone as "eventTimeZone",
  t.scientific_name as "scientificName",
  t.taxon_rank as "taxonRank",
  t.gbif_taxon_key as "taxonKey",
  t.vernacular_name as "vernacularName",
  o.group_size as "individualCount",
  o.country_code as "countryCode",
  o.admin1_code as "stateProvince",
  extensions.ST_Y(o.location_public) as "decimalLatitude",
  extensions.ST_X(o.location_public) as "decimalLongitude",
  'EPSG:4326' as "geodeticDatum",
  o.coordinate_uncertainty_m as "coordinateUncertaintyInMeters",
  o.data_generalizations as "dataGeneralizations",
  o.information_withheld as "informationWithheld",
  s.protocol::text as "samplingProtocol",
  case when s.distance_km is not null
       then s.distance_km::text || ' km; ' || coalesce(s.duration_min, 0)::text || ' min'
  end as "samplingEffort",
  s.complete_session as "isCompleteChecklist",
  o.distance_from_path_m as "perpendicularDistanceM",
  o.grid_cell_id as "gridCellID"
from public.observations o
join public.sessions s on s.id = o.session_id
left join public.ref_taxa t on t.species = o.species
where s.validation_status is distinct from 'flagged'
  and s.deleted_at is null;

grant select on public.dwc_occurrence to authenticated;

-- ---------------------------------------------------------------------------
-- 4. AI analysis quota (consumed by the analyze-photo Edge Function)
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.users (id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);
alter table public.ai_usage_daily enable row level security;
revoke all on public.ai_usage_daily from anon, authenticated;

-- Atomically counts one request for the caller. True while within the limit.
create or replace function public.consume_ai_quota(p_daily_limit integer default 50)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  counted integer;
begin
  if caller is null then
    return false;
  end if;

  insert into public.ai_usage_daily as u (user_id, usage_date, request_count)
  values (caller, (timezone('utc', now()))::date, 1)
  on conflict (user_id, usage_date)
  do update set request_count = u.request_count + 1
  where u.request_count < p_daily_limit
  returning request_count into counted;

  return counted is not null;
end;
$$;

revoke all on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Right of access
-- ---------------------------------------------------------------------------

-- Every row keyed to the caller, as one JSON document. The caller's own
-- precise locations and tracks are included: it is their own data.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'export_my_data: authentication required' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'export_schema_version', 1,
    'exported_at', now(),
    'profile', (select to_jsonb(u) from public.users u where u.id = caller),
    'privacy_zones', coalesce((
      select jsonb_agg((to_jsonb(z) - 'centre')
        || jsonb_build_object('centre', ST_AsGeoJSON(z.centre)::jsonb))
      from public.privacy_zones z where z.user_id = caller), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'track', (select ST_AsGeoJSON(t.track)::jsonb from public.session_tracks t
                  where t.session_id = s.id)))
      from public.sessions s where s.observer_id = caller), '[]'::jsonb),
    'track_points', coalesce((
      select jsonb_agg((to_jsonb(p) - 'location')
        || jsonb_build_object('location', ST_AsGeoJSON(p.location)::jsonb))
      from public.track_points p
      join public.sessions s on s.id = p.session_id
      where s.observer_id = caller), '[]'::jsonb),
    'observations', coalesce((
      select jsonb_agg((to_jsonb(o) - 'location_public') || jsonb_build_object(
        'location_public', ST_AsGeoJSON(o.location_public)::jsonb,
        'location_precise', ST_AsGeoJSON(l.location_precise)::jsonb,
        'animal_location', ST_AsGeoJSON(l.animal_location)::jsonb,
        'bearing_deg', l.bearing_deg,
        'distance_estimate_m', l.distance_estimate_m))
      from public.observations o
      join public.sessions s on s.id = o.session_id
      left join public.observation_locations l on l.observation_id = o.id
      where s.observer_id = caller), '[]'::jsonb),
    'observation_animals', coalesce((
      select jsonb_agg(to_jsonb(a))
      from public.observation_animals a
      join public.observations o on o.id = a.observation_id
      join public.sessions s on s.id = o.session_id
      where s.observer_id = caller), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(to_jsonb(ph))
      from public.photos ph
      join public.observations o on o.id = ph.observation_id
      join public.sessions s on s.id = o.session_id
      where s.observer_id = caller), '[]'::jsonb),
    'colonies_created', coalesce((
      select jsonb_agg((to_jsonb(c) - 'location')
        || jsonb_build_object('location', ST_AsGeoJSON(c.location)::jsonb))
      from public.colonies c where c.created_by = caller), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Keep the paths the app sends (submit_survey_bundle)
-- ---------------------------------------------------------------------------
-- Identical to 20260923000500 except the track and accuracy handling marked below.

create or replace function public.submit_survey_bundle(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  session_json jsonb := payload -> 'session';
  observation_json jsonb;
  photo_json jsonb;
  caller uuid := auth.uid();
  -- Named *_uuid rather than *_id: a variable called session_id would shadow
  -- observations.session_id and make the later UPDATE ambiguous at runtime.
  session_uuid uuid;
  observation_uuid uuid;
  precise extensions.geometry;
  accuracy double precision;
  generalized record;
  track_points jsonb;
  track_line extensions.geometry;
  inserted_observations integer := 0;
  inserted_photos integer := 0;
begin
  if caller is null then
    raise exception 'submit_survey_bundle: authentication required'
      using errcode = '28000';
  end if;

  if session_json is null then
    raise exception 'submit_survey_bundle: payload.session is required';
  end if;

  -- Recording is blocked until the user has accepted a consent version.
  if not exists (select 1 from public.users u where u.id = caller and u.consent_version is not null) then
    raise exception 'submit_survey_bundle: consent must be accepted before submitting data'
      using errcode = '42501';
  end if;

  session_uuid := (session_json ->> 'id')::uuid;

  insert into public.sessions (
    id, observer_id, protocol, route_id, start_time, end_time, distance_km,
    complete_session, number_of_observers, weather, time_of_day, app_version,
    device_gps_accuracy_avg, notes
  )
  values (
    session_uuid,
    caller,
    (session_json ->> 'protocol')::public.protocol,
    nullif(session_json ->> 'route_id', '')::uuid,
    (session_json ->> 'start_time')::timestamptz,
    nullif(session_json ->> 'end_time', '')::timestamptz,
    nullif(session_json ->> 'distance_km', '')::double precision,
    (session_json ->> 'complete_session')::boolean,
    coalesce((session_json ->> 'number_of_observers')::integer, 1),
    nullif(session_json ->> 'weather', '')::public.weather,
    nullif(session_json ->> 'time_of_day', '')::public.time_of_day,
    session_json ->> 'app_version',
    nullif(session_json ->> 'device_gps_accuracy_avg', '')::double precision,
    session_json ->> 'notes'
  )
  on conflict (id) do update
    set end_time = excluded.end_time,
        distance_km = excluded.distance_km,
        complete_session = excluded.complete_session,
        device_gps_accuracy_avg = excluded.device_gps_accuracy_avg,
        notes = excluded.notes,
        synced_at = now()
    -- A retry may only touch the submitter's own session.
    where public.sessions.observer_id = caller;

  if not exists (select 1 from public.sessions s where s.id = session_uuid and s.observer_id = caller) then
    raise exception 'submit_survey_bundle: session % belongs to another observer', session_uuid
      using errcode = '42501';
  end if;

  -- The walked path goes straight into the restricted table. The mobile app
  -- sends the path as a top-level track_points array (with timestamps and
  -- accuracy) and a GeoJSON track; session.track is the original shape. Before
  -- 20260929000100 only session.track was read, so app transects arrived with
  -- no path at all.
  track_points := coalesce(
    case when jsonb_typeof(session_json -> 'track') = 'array' then session_json -> 'track' end,
    case when jsonb_typeof(payload -> 'track_points') = 'array' then payload -> 'track_points' end,
    case when payload #>> '{track,type}' = 'LineString' then (
      select jsonb_agg(jsonb_build_object('longitude', c ->> 0, 'latitude', c ->> 1) order by ord)
      from jsonb_array_elements(payload #> '{track,coordinates}') with ordinality as x(c, ord)
    ) end
  );
  if track_points is not null and jsonb_array_length(track_points) >= 2 then
    select extensions.ST_SetSRID(
             extensions.ST_MakeLine(
               extensions.ST_MakePoint((p ->> 'longitude')::double precision,
                                       (p ->> 'latitude')::double precision)
               order by ordinality
             ),
             4326
           )
      into track_line
      from jsonb_array_elements(track_points) with ordinality as t(p, ordinality);

    insert into public.session_tracks (session_id, track, point_count)
    values (session_uuid, track_line, jsonb_array_length(track_points))
    on conflict (session_id) do update
      set track = excluded.track, point_count = excluded.point_count;
  end if;

  -- Raw GPS fixes are kept, never simplified away (CLAUDE.md 1.5). Fixes
  -- worse than 30 m are stored with a rejected_reason rather than dropped.
  -- A retried bundle does not duplicate them.
  if jsonb_typeof(payload -> 'track_points') = 'array'
     and not exists (select 1 from public.track_points tp where tp.session_id = session_uuid) then
    insert into public.track_points (
      id, session_id, recorded_at, location, accuracy_m, altitude_m, speed_mps, heading_deg,
      provider, is_mock, rejected_reason
    )
    select
      extensions.gen_random_uuid(),
      session_uuid,
      coalesce(nullif(p ->> 'recorded_at', '')::timestamptz, (session_json ->> 'start_time')::timestamptz),
      extensions.ST_SetSRID(
        extensions.ST_MakePoint((p ->> 'longitude')::double precision, (p ->> 'latitude')::double precision),
        4326
      ),
      nullif(p ->> 'accuracy_m', '')::double precision,
      nullif(p ->> 'altitude_m', '')::double precision,
      nullif(p ->> 'speed_mps', '')::double precision,
      nullif(p ->> 'heading_deg', '')::double precision,
      nullif(p ->> 'provider', ''),
      coalesce(nullif(p ->> 'is_mock', '')::boolean, false),
      case when nullif(p ->> 'accuracy_m', '')::double precision > 30 then 'low_accuracy' end
    from jsonb_array_elements(payload -> 'track_points') as t(p)
    where p ? 'latitude' and p ? 'longitude';
  end if;

  for observation_json in
    select value from jsonb_array_elements(coalesce(payload -> 'observations', '[]'::jsonb))
  loop
    observation_uuid := (observation_json ->> 'id')::uuid;
    -- The app sends accuracy on the observation; the original shape nests it in location
    accuracy := coalesce(
      nullif(observation_json #>> '{location,gps_accuracy_m}', '')::double precision,
      nullif(observation_json ->> 'gps_accuracy_m', '')::double precision
    );
    precise := extensions.ST_SetSRID(
      extensions.ST_MakePoint(
        (observation_json #>> '{location,longitude}')::double precision,
        (observation_json #>> '{location,latitude}')::double precision
      ),
      4326
    );

    select * into generalized from public.generalize_point(precise, accuracy);

    insert into public.observations (
      id, session_id, observed_at, grid_cell_id, location_public,
      coordinate_uncertainty_m, gps_accuracy_m, data_generalizations,
      information_withheld, species, group_size, distance_from_path_m,
      sex, age_class, reproductive_status, body_condition_score,
      visible_health_issues, ear_tip_or_notch, collar_or_tag, behaviour,
      being_fed_by_people, habitat_type, food_sources_visible, coat_pattern, notes
    )
    values (
      observation_uuid,
      session_uuid,
      (observation_json ->> 'observed_at')::timestamptz,
      generalized.grid_cell_id,
      generalized.location_public,
      generalized.coordinate_uncertainty_m,
      accuracy,
      generalized.data_generalizations,
      generalized.information_withheld,
      (observation_json ->> 'species')::public.species,
      coalesce((observation_json ->> 'group_size')::integer, 1),
      nullif(observation_json ->> 'distance_from_path_m', '')::double precision,
      coalesce(nullif(observation_json ->> 'sex', '')::public.sex, 'unknown'),
      coalesce(nullif(observation_json ->> 'age_class', '')::public.age_class, 'unknown'),
      coalesce(nullif(observation_json ->> 'reproductive_status', '')::public.reproductive_status, 'unknown'),
      nullif(observation_json ->> 'body_condition_score', '')::smallint,
      coalesce(
        (select array_agg(value::text::public.health_issue)
         from jsonb_array_elements_text(coalesce(observation_json -> 'visible_health_issues', '[]'::jsonb)) as value),
        '{}'
      ),
      coalesce(nullif(observation_json ->> 'ear_tip_or_notch', '')::public.tristate, 'unknown'),
      coalesce(nullif(observation_json ->> 'collar_or_tag', '')::public.tristate, 'unknown'),
      nullif(observation_json ->> 'behaviour', '')::public.behaviour,
      coalesce(nullif(observation_json ->> 'being_fed_by_people', '')::public.tristate, 'unknown'),
      nullif(observation_json ->> 'habitat_type', '')::public.habitat_type,
      coalesce(
        (select array_agg(value::text::public.food_source)
         from jsonb_array_elements_text(coalesce(observation_json -> 'food_sources_visible', '[]'::jsonb)) as value),
        '{}'
      ),
      nullif(observation_json ->> 'coat_pattern', '')::public.coat_pattern,
      observation_json ->> 'notes'
    )
    -- A retried sync must not duplicate or silently rewrite a stored record.
    on conflict (id) do nothing;

    if found then
      inserted_observations := inserted_observations + 1;
    end if;

    insert into public.observation_locations (observation_id, location_precise)
    values (observation_uuid, precise)
    on conflict (observation_id) do nothing;
  end loop;

  -- Distance to the walked path, for distance sampling. Computed here because
  -- it needs the restricted track and the restricted points together.
  if track_line is not null then
    update public.observations o
    set distance_computed_m = round(
      extensions.ST_Distance(ol.location_precise::extensions.geography,
                             track_line::extensions.geography)::numeric, 2
    )
    from public.observation_locations ol
    where ol.observation_id = o.id and o.session_id = session_uuid;
  end if;

  for photo_json in
    select value from jsonb_array_elements(coalesce(payload -> 'photos', '[]'::jsonb))
  loop
    insert into public.photos (
      id, observation_id, storage_path, angle, taken_at, width_px, height_px, quality_warning
    )
    values (
      (photo_json ->> 'id')::uuid,
      (photo_json ->> 'observation_id')::uuid,
      photo_json ->> 'storage_path',
      (photo_json ->> 'angle')::public.photo_angle,
      (photo_json ->> 'taken_at')::timestamptz,
      nullif(photo_json ->> 'width_px', '')::integer,
      nullif(photo_json ->> 'height_px', '')::integer,
      nullif(photo_json ->> 'quality_warning', '')
    )
    on conflict (id) do nothing;

    if found then
      inserted_photos := inserted_photos + 1;
    end if;
  end loop;

  -- Deliberately returns counts only. Never echo back a precise coordinate.
  return jsonb_build_object(
    'session_id', session_uuid,
    'observations_inserted', inserted_observations,
    'photos_inserted', inserted_photos
  );
end;
$$;


revoke execute on function public.submit_survey_bundle(jsonb) from public, anon;
grant execute on function public.submit_survey_bundle(jsonb) to authenticated;
