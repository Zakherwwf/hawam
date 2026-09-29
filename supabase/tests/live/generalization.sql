-- generalize_point() is the single place a precise coordinate becomes a
-- publishable one. Everything downstream -- the map, the exports, the Darwin
-- Core fields -- inherits whatever this function decides, so its behaviour is
-- pinned here rather than only exercised through the API.

begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_temp;

select plan(12);

-- A point in central Tunis.
create temporary table fixture as
select * from public.generalize_point(
  extensions.ST_SetSRID(extensions.ST_MakePoint(10.1815, 36.8065), 4326),
  8
);

select ok(
  (select grid_cell_id ~ '^1KM-[NS][0-9]+-[EW][0-9]+$' from fixture),
  'the cell id is a readable, parseable identifier'
);

-- The grid is worldwide: the Americas used to fall outside the UTM 32N grid
select lives_ok(
  $$select * from public.generalize_point(extensions.ST_SetSRID(extensions.ST_MakePoint(-74.0, 40.7), 4326))$$,
  'a point in the Americas generalizes instead of being refused'
);

-- The published point must be the cell centroid, never the animal.
select ok(
  (select extensions.ST_Distance(
     location_public::extensions.geography,
     extensions.ST_SetSRID(extensions.ST_MakePoint(10.1815, 36.8065), 4326)::extensions.geography
   ) > 0 from fixture),
  'the published point is moved off the recorded position'
);
select ok(
  (select extensions.ST_Distance(
     location_public::extensions.geography,
     extensions.ST_SetSRID(extensions.ST_MakePoint(10.1815, 36.8065), 4326)::extensions.geography
   ) <= coordinate_uncertainty_m from fixture),
  'and it stays inside the uncertainty it reports'
);

-- 707 m is the half-diagonal of a 1 km cell; GPS error is added on top so
-- downstream models never understate the error.
select ok(
  (select coordinate_uncertainty_m >= 707 from fixture),
  'uncertainty is at least the cell half-diagonal'
);
select is(
  (select coordinate_uncertainty_m from fixture),
  715::double precision,
  'uncertainty = half-diagonal + reported GPS accuracy'
);

select ok(
  (select data_generalizations like '%1 km%' from fixture),
  'dataGeneralizations says the coordinate was coarsened'
);
select ok(
  (select information_withheld like '%recise%' from fixture),
  'informationWithheld says the precise coordinate is held back'
);

-- Two animals a few metres apart must publish identically, or the difference
-- between the two published points would reveal the real separation.
select is(
  (select extensions.ST_AsText(location_public) from public.generalize_point(
     extensions.ST_SetSRID(extensions.ST_MakePoint(10.18150, 36.80650), 4326))),
  (select extensions.ST_AsText(location_public) from public.generalize_point(
     extensions.ST_SetSRID(extensions.ST_MakePoint(10.18160, 36.80655), 4326))),
  'neighbouring animals collapse onto the same cell centroid'
);

-- A couple of kilometres away is a different cell: the map still carries signal.
select isnt(
  (select grid_cell_id from public.generalize_point(
     extensions.ST_SetSRID(extensions.ST_MakePoint(10.1815, 36.8065), 4326))),
  (select grid_cell_id from public.generalize_point(
     extensions.ST_SetSRID(extensions.ST_MakePoint(10.2015, 36.8265), 4326))),
  'a point two kilometres away lands in a different cell'
);

-- The function is the enforcement point, so it fails loudly rather than
-- silently publishing something it cannot generalize.
select throws_ok(
  $$ select * from public.generalize_point(null) $$,
  'generalize_point: precise location is required',
  'a null location is refused'
);

select ok(
  (select provolatile = 'i' from pg_proc
    where oid = 'public.generalize_point(extensions.geometry, double precision)'::regprocedure),
  'generalize_point is immutable: the same point always publishes to the same cell'
);

select * from finish();
rollback;
