-- Catalog-level checks on the access model.
--
-- Exact coordinates and survey tracks are shared with every signed-in user by
-- design. That makes the account boundary the only boundary, so this file
-- pins down the facts underneath it: anon holds no grant anywhere, writes to
-- the location tables still go through submit_survey_bundle(), RLS is enabled
-- and forced, and the location tables are absent from the Realtime
-- publication -- which no API request would reveal, because Realtime pushes
-- rows out rather than answering queries.

begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_temp;

select plan(34);

-- ---------------------------------------------------------------------------
-- The location tables exist and carry RLS
-- ---------------------------------------------------------------------------

select has_table('public', 'observation_locations', 'observation_locations exists');
select has_table('public', 'session_tracks', 'session_tracks exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.observation_locations'::regclass),
  'RLS is enabled on observation_locations'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.observation_locations'::regclass),
  'RLS is forced on observation_locations, so a definer function cannot bypass it by accident'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.session_tracks'::regclass),
  'RLS is enabled on session_tracks'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.session_tracks'::regclass),
  'RLS is forced on session_tracks'
);

-- ---------------------------------------------------------------------------
-- Gate 1: table grants
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.observation_locations', 'SELECT'),
  'anon cannot select observation_locations'
);
select ok(
  not has_table_privilege('anon', 'public.observations_map', 'SELECT'),
  'anon cannot select the exact-location map view'
);
select ok(
  not has_table_privilege('anon', 'public.session_tracks_geojson', 'SELECT'),
  'anon cannot select survey tracks'
);
select ok(
  not has_table_privilege('anon', 'public.leaderboard', 'SELECT'),
  'anon cannot read the leaderboard'
);
select ok(
  not has_table_privilege('anon', 'public.user_stats', 'SELECT'),
  'anon cannot read anyone''s contribution totals'
);
select ok(
  not has_table_privilege('anon', 'public.session_tracks', 'SELECT'),
  'anon cannot select session_tracks'
);
select ok(
  not has_table_privilege('anon', 'public.observations', 'SELECT'),
  'anon cannot select observations'
);
select ok(
  not has_table_privilege('anon', 'public.observations_public', 'SELECT'),
  'anon cannot select observations_public'
);
select ok(
  not has_table_privilege('anon', 'public.map_density_public', 'SELECT'),
  'anon cannot select the density map'
);
select ok(
  not has_table_privilege('anon', 'public.sessions', 'SELECT'),
  'anon cannot select sessions'
);

-- authenticated may issue the SELECT; gate 2 decides whether it returns rows.
select ok(
  has_table_privilege('authenticated', 'public.observation_locations', 'SELECT'),
  'authenticated may attempt a select on observation_locations'
);
select ok(
  not has_table_privilege('authenticated', 'public.observation_locations', 'INSERT'),
  'authenticated cannot insert precise locations: writes go through submit_survey_bundle()'
);
select ok(
  not has_table_privilege('authenticated', 'public.observation_locations', 'UPDATE'),
  'authenticated cannot update precise locations'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_tracks', 'INSERT'),
  'authenticated cannot insert tracks'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_tracks', 'UPDATE'),
  'authenticated cannot update tracks'
);
-- Account deletion must actually delete, so DELETE stays, filtered by policy.
select ok(
  has_table_privilege('authenticated', 'public.observation_locations', 'DELETE'),
  'authenticated keeps DELETE so account deletion can remove their own records'
);

-- ---------------------------------------------------------------------------
-- Gate 2: policies
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'observation_locations' and cmd = 'SELECT'),
  1::bigint,
  'observation_locations has exactly one SELECT policy'
);
select ok(
  (select qual like '%can_read_precise_locations%' from pg_policies
    where schemaname = 'public' and tablename = 'observation_locations' and cmd = 'SELECT'),
  'that policy is keyed on can_read_precise_locations()'
);
-- Curation must not follow the location gate: widening one without splitting
-- them would have let any volunteer rewrite fixed routes.
select ok(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'routes'
      and qual like '%is_researcher%') >= 1,
  'editing routes is gated on is_researcher(), not on the location gate'
);
select ok(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'individuals'
      and qual like '%is_researcher%') >= 1,
  'confirming individuals is gated on is_researcher()'
);
select ok(
  (select qual like '%can_read_precise_locations%' from pg_policies
    where schemaname = 'public' and tablename = 'session_tracks' and cmd = 'SELECT'),
  'session_tracks SELECT is keyed on can_read_precise_locations()'
);
select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'observation_locations'
      and cmd in ('INSERT', 'UPDATE', 'ALL')),
  0::bigint,
  'no policy grants a client a write to observation_locations'
);

-- ---------------------------------------------------------------------------
-- Realtime: the restricted tables must not stream
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from pg_publication_tables
    where schemaname = 'public'
      and tablename in ('observation_locations', 'session_tracks')),
  0::bigint,
  'restricted tables are in no publication: Realtime would replay coordinates to every subscriber'
);

-- ---------------------------------------------------------------------------
-- No precise column hides inside a readable relation
-- ---------------------------------------------------------------------------

select hasnt_column('public', 'observations', 'location_precise',
  'observations carries no precise coordinate column');
select hasnt_column('public', 'observations_public', 'location_precise',
  'observations_public carries no precise coordinate column');
select hasnt_column('public', 'map_density_public', 'observer_id',
  'the density map names no observer');
select hasnt_column('public', 'observations_public', 'observer_id',
  'observations_public names no observer');

-- ---------------------------------------------------------------------------
-- Published coordinates are derived, never client-supplied
-- ---------------------------------------------------------------------------

select has_trigger('public', 'observations', 'observations_protect_generalized_columns',
  'a trigger keeps observations.location_public derived from the precise point');

select * from finish();
rollback;
