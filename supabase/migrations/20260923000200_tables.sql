-- Core tables.
--
-- The central design decision: precise coordinates live in their own tables
-- (observation_locations, session_tracks), never as a column inside a table
-- that regular users can read. Row-level security is row-level; a restricted
-- column inside a readable row is a leak waiting to happen.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'volunteer',
  preferred_language public.language not null default 'ar',
  -- Version of the consent text the user accepted. Null means not yet consented;
  -- the app must block recording until it is set.
  consent_version integer,
  consent_accepted_at timestamptz,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

comment on table public.users is
  'Application profile per auth user. Minimal personal data by design.';
comment on column public.users.role is
  'Only researcher and admin may read precise coordinates.';

-- Every new auth user gets a profile with the least-privileged role.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, role)
  values (new.id, 'volunteer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- routes: fixed transects defined by researchers and walked repeatedly
-- ---------------------------------------------------------------------------

create table public.routes (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  geometry extensions.geometry (LineString, 4326) not null,
  governorate text,
  delegation text,
  habitat_notes text,
  -- Cached from geometry so clients can show effort without PostGIS.
  length_km double precision,
  is_active boolean not null default true,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

comment on table public.routes is
  'Researcher-defined fixed routes. Repeat visits to the same route are what '
  'make occupancy, N-mixture and trend models possible. Route geometry is '
  'visible to surveyors: it shows where people survey, not where animals are.';

create index routes_geometry_idx on public.routes using gist (geometry);
create index routes_active_idx on public.routes (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- sessions: the unit of survey effort
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key,
  observer_id uuid not null references public.users (id) on delete cascade,
  protocol public.protocol not null,
  route_id uuid references public.routes (id),
  start_time timestamptz not null,
  end_time timestamptz,
  duration_min double precision generated always as (
    case when end_time is null then null
    else extract(epoch from (end_time - start_time)) / 60.0 end
  ) stored,
  -- Transect length, derived from the (restricted) GPS track. This number is
  -- the samplingEffort; it is not itself identifying.
  distance_km double precision check (distance_km is null or distance_km >= 0),
  -- The eBird "complete checklist" question. True means "I recorded every cat
  -- and dog I saw", which licenses treating zero rows as real absence.
  complete_session boolean not null,
  number_of_observers integer not null default 1 check (number_of_observers between 1 and 50),
  weather public.weather,
  time_of_day public.time_of_day,
  app_version text,
  device_gps_accuracy_avg double precision,
  notes text,
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),

  constraint sessions_end_after_start check (end_time is null or end_time >= start_time),
  -- An incidental sighting carries no effort, so it cannot belong to a route.
  constraint sessions_incidental_has_no_route
    check (protocol <> 'incidental' or route_id is null)
);

comment on table public.sessions is
  'One survey occasion. Effort metadata lives here; the walked path is in '
  'session_tracks because it identifies the observer''s movements.';
comment on column public.sessions.complete_session is
  'True = observer recorded every cat and dog seen. A complete session with '
  'zero observations is a valid non-detection and must never be discarded.';

create index sessions_observer_idx on public.sessions (observer_id, start_time desc);
create index sessions_route_idx on public.sessions (route_id, start_time) where route_id is not null;
create index sessions_protocol_idx on public.sessions (protocol, start_time);

-- ---------------------------------------------------------------------------
-- session_tracks: RESTRICTED. The observer's walked path.
-- ---------------------------------------------------------------------------

create table public.session_tracks (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  track extensions.geometry (LineString, 4326) not null,
  point_count integer,
  created_at timestamptz not null default now()
);

comment on table public.session_tracks is
  'RESTRICTED. A GPS track reveals both where animals were found and where a '
  'volunteer walks. Readable only by researcher and admin.';

create index session_tracks_geom_idx on public.session_tracks using gist (track);

-- ---------------------------------------------------------------------------
-- individuals: populated later by photo re-identification
-- ---------------------------------------------------------------------------

create table public.individuals (
  id uuid primary key default extensions.gen_random_uuid(),
  species public.species not null,
  coat_pattern public.coat_pattern,
  coat_description text,
  first_seen timestamptz,
  last_seen timestamptz,
  confirmed_by uuid references public.users (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint individuals_last_seen_after_first
    check (last_seen is null or first_seen is null or last_seen >= first_seen)
);

comment on table public.individuals is
  'A re-identified animal. Rows are created by researchers confirming photo '
  'matches; capture-recapture and SECR need this identity chain.';

-- ---------------------------------------------------------------------------
-- observations: PUBLIC-SAFE. Generalized location only.
-- ---------------------------------------------------------------------------

create table public.observations (
  id uuid primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  observed_at timestamptz not null,

  -- Generalized location. Derived from the restricted precise point by
  -- public.generalize_point(); see the next migration. Never write these by
  -- hand -- the trigger overwrites them.
  grid_cell_id text not null,
  location_public extensions.geometry (Point, 4326) not null,
  coordinate_uncertainty_m double precision not null,
  gps_accuracy_m double precision,
  data_generalizations text not null,
  information_withheld text not null,

  species public.species not null,
  group_size integer not null default 1 check (group_size between 1 and 500),
  -- Observer's field estimate of perpendicular distance, for distance sampling.
  distance_from_path_m double precision
    check (distance_from_path_m is null or distance_from_path_m >= 0),
  -- Same quantity computed from the recorded track, as a cross-check.
  distance_computed_m double precision,

  sex public.sex not null default 'unknown',
  age_class public.age_class not null default 'unknown',
  reproductive_status public.reproductive_status not null default 'unknown',
  -- ICAM 5-point visual scale: 1 very thin, 5 obese.
  body_condition_score smallint check (body_condition_score between 1 and 5),
  visible_health_issues public.health_issue[] not null default '{}',
  ear_tip_or_notch public.tristate not null default 'unknown',
  collar_or_tag public.tristate not null default 'unknown',
  behaviour public.behaviour,
  being_fed_by_people public.tristate not null default 'unknown',
  habitat_type public.habitat_type,
  food_sources_visible public.food_source[] not null default '{}',
  coat_pattern public.coat_pattern,
  notes text,

  linked_individual_id uuid references public.individuals (id) on delete set null,
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),

  -- '{}' means health was not assessed; '{none}' means assessed and clear.
  -- Those are different facts, so 'none' may not be mixed with real problems.
  constraint observations_health_none_is_exclusive check (
    not ('none' = any (visible_health_issues)) or array_length(visible_health_issues, 1) = 1
  ),
  -- Only a female can be recorded lactating or visibly pregnant.
  constraint observations_reproductive_status_matches_sex check (
    reproductive_status in ('none_visible', 'unknown') or sex = 'female'
  )
);

comment on table public.observations is
  'One record of one animal or group. Contains NO precise coordinates: the '
  'exact point lives in observation_locations, restricted to researchers.';
comment on column public.observations.grid_cell_id is
  'Identifier of the 1 km cell this record is published at, e.g. TN32N-E0512-N3987.';
comment on column public.observations.distance_computed_m is
  'Perpendicular distance to the walked track, computed server-side. A '
  'cross-check on the observer estimate, not a replacement for it.';

create index observations_session_idx on public.observations (session_id);
create index observations_cell_idx on public.observations (grid_cell_id, species);
create index observations_observed_at_idx on public.observations (observed_at desc);
create index observations_individual_idx on public.observations (linked_individual_id)
  where linked_individual_id is not null;
create index observations_public_geom_idx on public.observations using gist (location_public);

-- ---------------------------------------------------------------------------
-- observation_locations: RESTRICTED. The whole point of this schema.
-- ---------------------------------------------------------------------------

create table public.observation_locations (
  observation_id uuid primary key references public.observations (id) on delete cascade,
  location_precise extensions.geometry (Point, 4326) not null,
  created_at timestamptz not null default now()
);

comment on table public.observation_locations is
  'RESTRICTED: exact animal coordinates. Municipalities in Tunisia sometimes '
  'cull or poison free-roaming animals, so this table is readable only by the '
  'researcher and admin roles, and only ever written through '
  'public.submit_survey_bundle(). Not a volunteer''s own rows either: the '
  'device keeps its local copy, the server does not hand precise points back.';

create index observation_locations_geom_idx
  on public.observation_locations using gist (location_precise);

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------

create table public.photos (
  id uuid primary key,
  observation_id uuid not null references public.observations (id) on delete cascade,
  storage_path text not null unique,
  angle public.photo_angle not null,
  taken_at timestamptz not null,
  width_px integer check (width_px is null or width_px > 0),
  height_px integer check (height_px is null or height_px > 0),
  -- Set when the on-device blur/darkness check warned but the user kept the shot.
  quality_warning text,
  -- Personal EXIF is stripped on device before upload; GPS from EXIF is copied
  -- into observation_locations instead.
  exif_stripped boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.photos is
  'Photographs for individual re-identification. Left and right flanks are '
  'both requested because coat patterns are asymmetric.';

create index photos_observation_idx on public.photos (observation_id);
create index photos_angle_idx on public.photos (angle);

-- ---------------------------------------------------------------------------
-- individual_matches: the review queue, and the hook for a future matcher
-- ---------------------------------------------------------------------------

create table public.individual_matches (
  id uuid primary key default extensions.gen_random_uuid(),
  photo_a uuid not null references public.photos (id) on delete cascade,
  photo_b uuid not null references public.photos (id) on delete cascade,
  method public.match_method not null,
  score double precision check (score is null or (score >= 0 and score <= 1)),
  status public.match_status not null default 'proposed',
  reviewer_id uuid references public.users (id),
  reviewed_at timestamptz,
  individual_id uuid references public.individuals (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint individual_matches_distinct_photos check (photo_a <> photo_b),
  constraint individual_matches_reviewed_has_reviewer
    check (status = 'proposed' or reviewer_id is not null)
);

comment on table public.individual_matches is
  'Proposed and reviewed photo matches. method = ''algorithm'' rows are the '
  'insertion point for a future HotSpotter/Wildbook-style matcher: it writes '
  'proposed rows here and a researcher confirms them. No matcher is built yet.';

-- One pair, one verdict, regardless of which photo was named first.
create unique index individual_matches_pair_idx on public.individual_matches (
  least(photo_a, photo_b), greatest(photo_a, photo_b), method
);
create index individual_matches_queue_idx on public.individual_matches (status, created_at)
  where status = 'proposed';

-- ---------------------------------------------------------------------------
-- export_audit: every precise-coordinate export leaves a trace
-- ---------------------------------------------------------------------------

create table public.export_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references public.users (id),
  actor_role public.user_role,
  export_type text not null,
  includes_precise_coordinates boolean not null,
  row_count integer,
  filters jsonb,
  exported_at timestamptz not null default now()
);

comment on table public.export_audit is
  'Append-only log of data exports. Any export carrying precise coordinates '
  'must write a row here before the data is returned.';

create index export_audit_actor_idx on public.export_audit (actor_id, exported_at desc);
create index export_audit_precise_idx on public.export_audit (exported_at desc)
  where includes_precise_coordinates;
