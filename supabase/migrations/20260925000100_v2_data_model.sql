-- The v2 data model.
--
-- Three things this adds, in order of scientific importance:
--
-- 1. **The animal's position, distinct from the observer's.** Until now one
--    point served as both, which is wrong: a dog seen 40 m across a car park
--    is not where the phone is. Distance sampling and SECR both need the
--    separation, so we store the observer fix, the bearing and distance the
--    surveyor gave, and the animal position derived from them -- plus which
--    method produced it, because a compass bearing and a tap on a map deserve
--    different confidence.
-- 2. **Raw track points.** Sessions carry a simplified line for drawing. The
--    raw fixes now live in their own table, including the ones the filter
--    rejected, with the reason. Raw data is never destroyed: a filter that
--    turns out to be wrong can be re-run, a deleted point cannot.
-- 3. **Sync metadata** (updated_at, deleted_at, server_version) so an offline
--    device can reconcile, and soft deletes so a delete can propagate.

-- ---------------------------------------------------------------------------
-- Vocabularies
-- ---------------------------------------------------------------------------

create type public.location_method as enum ('compass', 'map_tap', 'same_as_observer');
create type public.validation_status as enum ('pending', 'valid', 'flagged');
create type public.colony_type as enum ('cat_colony', 'feeding_point', 'dog_pack_area');

-- ---------------------------------------------------------------------------
-- sessions: richer effort metadata
-- ---------------------------------------------------------------------------

alter table public.sessions
  add column moving_time_s integer check (moving_time_s is null or moving_time_s >= 0),
  add column device_model text,
  -- Which 1 km H3 cells this session touched, for coverage and quests.
  add column h3_cells_res9 text[] not null default '{}',
  -- Android can report a fix as mocked. A survey built on spoofed positions is
  -- not evidence, so it is recorded and flagged rather than silently trusted.
  add column mock_location_detected boolean not null default false,
  add column validation_status public.validation_status not null default 'pending',
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

comment on column public.sessions.validation_status is
  'Server verdict on plausibility. Gamification only pays out on valid.';

create index sessions_updated_idx on public.sessions (updated_at desc);
create index sessions_h3_idx on public.sessions using gin (h3_cells_res9);

-- ---------------------------------------------------------------------------
-- track_points: every fix, including the rejected ones
-- ---------------------------------------------------------------------------

create table public.track_points (
  id uuid primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  recorded_at timestamptz not null,
  location extensions.geometry (Point, 4326) not null,
  accuracy_m double precision,
  altitude_m double precision,
  speed_mps double precision,
  heading_deg double precision check (heading_deg is null or (heading_deg >= 0 and heading_deg < 360)),
  provider text,
  is_mock boolean not null default false,
  -- Null means the point was accepted. Anything else records why the filter
  -- dropped it, so the decision can be reviewed instead of just trusted.
  rejected_reason text,
  created_at timestamptz not null default now()
);

comment on table public.track_points is
  'Raw GPS fixes. Never deleted in favour of the simplified line: the '
  'simplification is a display choice, these are the measurement.';

create index track_points_session_idx on public.track_points (session_id, recorded_at);
create index track_points_geom_idx on public.track_points using gist (location);
create index track_points_accepted_idx on public.track_points (session_id)
  where rejected_reason is null;

-- ---------------------------------------------------------------------------
-- observation_locations: observer and animal, and how we got from one to
-- the other
-- ---------------------------------------------------------------------------

alter table public.observation_locations
  add column animal_location extensions.geometry (Point, 4326),
  add column location_method public.location_method not null default 'same_as_observer',
  add column bearing_deg double precision
    check (bearing_deg is null or (bearing_deg >= 0 and bearing_deg < 360)),
  add column distance_estimate_m double precision
    check (distance_estimate_m is null or (distance_estimate_m >= 0 and distance_estimate_m <= 5000));

comment on column public.observation_locations.location_precise is
  'Where the observer stood. Not where the animal was -- see animal_location.';
comment on column public.observation_locations.animal_location is
  'Where the animal was, derived from bearing and distance, or tapped on the '
  'map. Falls back to the observer position when the method is '
  'same_as_observer.';
comment on column public.observation_locations.location_method is
  'How animal_location was obtained. A compass bearing and a map tap carry '
  'different confidence and analysts need to be able to tell them apart.';

-- Everything recorded so far was taken at the observer's own position.
update public.observation_locations
   set animal_location = location_precise
 where animal_location is null;

alter table public.observation_locations
  alter column animal_location set not null;

create index observation_locations_animal_geom_idx
  on public.observation_locations using gist (animal_location);

/**
 * An observation always has an animal position.
 *
 * When a caller supplies none -- a quick sighting, or a pre-v2 client -- the
 * animal is taken to have been where the observer stood, which is exactly what
 * `location_method = same_as_observer` means. Expressed as a trigger so the
 * invariant holds for every writer rather than for the ones we remembered to
 * update.
 */
create or replace function public.default_animal_location()
returns trigger
language plpgsql
as $$
begin
  if new.animal_location is null then
    new.animal_location := new.location_precise;
    new.location_method := 'same_as_observer';
  end if;
  return new;
end;
$$;

create trigger observation_locations_default_animal_location
  before insert or update on public.observation_locations
  for each row execute function public.default_animal_location();

-- ---------------------------------------------------------------------------
-- observations: spatial indexing, admin units, welfare, sync metadata
-- ---------------------------------------------------------------------------

alter table public.observations
  -- H3 at two resolutions: res 9 (~0.1 km²) drives coverage and exploration,
  -- res 7 (~5 km²) drives regional quests and leaderboards.
  add column h3_res9 text,
  add column h3_res7 text,
  add column governorate_code text,
  add column delegation_code text,
  add column is_welfare_alert boolean not null default false,
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

create index observations_h3_res9_idx on public.observations (h3_res9);
create index observations_h3_res7_idx on public.observations (h3_res7);
create index observations_welfare_idx on public.observations (observed_at desc)
  where is_welfare_alert;
create index observations_updated_idx on public.observations (updated_at desc);
create index observations_admin_idx on public.observations (governorate_code, delegation_code);

-- ---------------------------------------------------------------------------
-- observation_animals: one row per animal when a group was recorded
--
-- A record of "six dogs" can still describe each one. The columns match the
-- per-animal attributes already on observations, so a single animal stays a
-- single row on observations and only groups need these.
-- ---------------------------------------------------------------------------

create table public.observation_animals (
  id uuid primary key,
  observation_id uuid not null references public.observations (id) on delete cascade,
  ordinal integer not null check (ordinal >= 1),
  sex public.sex not null default 'unknown',
  age_class public.age_class not null default 'unknown',
  reproductive_status public.reproductive_status not null default 'unknown',
  body_condition_score smallint check (body_condition_score between 1 and 5),
  visible_health_issues public.health_issue[] not null default '{}',
  ear_tip_or_notch public.tristate not null default 'unknown',
  collar_or_tag public.tristate not null default 'unknown',
  behaviour public.behaviour,
  being_fed_by_people public.tristate not null default 'unknown',
  coat_pattern public.coat_pattern,
  primary_colour text,
  individual_id uuid references public.individuals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint observation_animals_health_none_is_exclusive check (
    not ('none' = any (visible_health_issues)) or array_length(visible_health_issues, 1) = 1
  ),
  constraint observation_animals_reproductive_matches_sex check (
    reproductive_status in ('none_visible', 'unknown') or sex = 'female'
  ),
  unique (observation_id, ordinal)
);

comment on table public.observation_animals is
  'Per-animal detail inside a group sighting. ICAM scales apply here exactly '
  'as they do on a single-animal observation.';

create index observation_animals_observation_idx on public.observation_animals (observation_id);

-- ---------------------------------------------------------------------------
-- colonies and feeding points: persistent map features
-- ---------------------------------------------------------------------------

create table public.colonies (
  id uuid primary key,
  type public.colony_type not null,
  location extensions.geometry (Point, 4326) not null,
  name text check (name is null or char_length(name) <= 120),
  notes text,
  created_by uuid references public.users (id) on delete set null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.colonies is
  'Cat colonies, feeding stations and dog-pack areas. Persistent features '
  'rather than sightings: they describe a place, not a moment.';

create index colonies_geom_idx on public.colonies using gist (location);

alter table public.observations
  add column colony_id uuid references public.colonies (id) on delete set null;

-- ---------------------------------------------------------------------------
-- privacy_zones
--
-- v2 reintroduces one protection, and only one: a surveyor's own track points
-- inside a zone they define are hidden from everybody else. Animal
-- observations stay fully visible -- the zone protects the person's home, not
-- the data. Same idea as Strava's privacy zones.
-- ---------------------------------------------------------------------------

create table public.privacy_zones (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  centre extensions.geography (Point, 4326) not null,
  radius_m integer not null check (radius_m between 100 and 1000),
  label text check (label is null or char_length(label) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.privacy_zones is
  'Circles around places a surveyor does not want published -- their home, '
  'usually. Their own track points inside one are hidden from other users.';

create index privacy_zones_user_idx on public.privacy_zones (user_id);
create index privacy_zones_geo_idx on public.privacy_zones using gist (centre);

-- ---------------------------------------------------------------------------
-- Sync metadata elsewhere
-- ---------------------------------------------------------------------------

alter table public.photos
  add column thumbnail_path text,
  add column blur_score double precision,
  add column brightness_score double precision,
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

alter table public.individuals
  add column nickname text check (nickname is null or char_length(nickname) <= 60),
  add column primary_colour text,
  add column identifiability text check (identifiability in ('high', 'low')),
  add column sightings_count integer not null default 0,
  add column colony_id uuid references public.colonies (id) on delete set null,
  add column ear_tipped public.tristate not null default 'unknown',
  add column status text not null default 'active'
    check (status in ('active', 'not_seen_recently', 'reported_deceased')),
  add column updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
--
-- Sync pulls "everything changed since X", so a stale updated_at means a
-- device silently misses an edit. A trigger is the only way to be sure.
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'sessions', 'observations', 'photos', 'individuals',
    'observation_animals', 'colonies', 'privacy_zones'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.touch_updated_at()',
      target || '_touch_updated_at', target
    );
  end loop;
end;
$$;
