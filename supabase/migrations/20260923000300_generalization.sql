-- Location generalization.
--
-- This is the enforcement point for the project's one non-negotiable rule:
-- precise coordinates never reach a non-researcher. Everything published is
-- snapped to the centroid of a 1 km grid cell first.
--
-- packages/shared/src/geo/grid.ts is the TypeScript twin of this function, used
-- for client-side preview. tests/rls asserts the two agree; if you change the
-- maths here, change it there too.

-- Tunisia lies entirely within UTM zone 32N (6E-12E; the country spans about
-- 7.5E-11.6E), so one projected grid is valid nationwide.
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
  grid_size_m constant double precision := 1000;
  -- Half-diagonal of a 1 km cell: the furthest the published centroid can sit
  -- from the true position, before GPS error is added. round(sqrt(2)*1000/2).
  half_diagonal_m constant double precision := 707;
  -- Standard UTM false northing. Tunisia is north of the equator, but a corrupt
  -- coordinate must still yield a well-formed cell id rather than 'N-166'.
  southern_false_northing constant double precision := 10000000;
  projected extensions.geometry;
  easting double precision;
  northing double precision;
  northing_adjusted double precision;
  cell_e bigint;
  cell_n bigint;
  centroid_e double precision;
  centroid_n double precision;
  centroid extensions.geometry;
  accuracy double precision;
begin
  if precise is null then
    raise exception 'generalize_point: precise location is required';
  end if;

  projected := extensions.ST_Transform(precise, 32632);
  easting := extensions.ST_X(projected);
  northing := extensions.ST_Y(projected);
  northing_adjusted := case when northing < 0 then northing + southern_false_northing
                            else northing end;

  cell_e := floor(easting / grid_size_m)::bigint;
  cell_n := floor(northing_adjusted / grid_size_m)::bigint;

  if cell_e < 0 or cell_n < 0 then
    raise exception 'generalize_point: coordinate outside the supported grid (%, %)',
      extensions.ST_Y(precise), extensions.ST_X(precise);
  end if;

  centroid_e := cell_e * grid_size_m + grid_size_m / 2;
  centroid_n := cell_n * grid_size_m + grid_size_m / 2;
  if northing < 0 then
    centroid_n := centroid_n - southern_false_northing;
  end if;

  centroid := extensions.ST_Transform(
    extensions.ST_SetSRID(extensions.ST_MakePoint(centroid_e, centroid_n), 32632),
    4326
  );

  -- Round to 5 decimal places (~1 m). The centroid is already generalized;
  -- extra digits would imply a precision the value does not have. The
  -- TypeScript twin rounds identically so the two agree exactly.
  grid_cell_id := 'TN32N-E' || lpad(cell_e::text, 4, '0') || '-N' || lpad(cell_n::text, 4, '0');
  location_public := extensions.ST_SetSRID(
    extensions.ST_MakePoint(
      round(extensions.ST_X(centroid)::numeric, 5)::double precision,
      round(extensions.ST_Y(centroid)::numeric, 5)::double precision
    ),
    4326
  );

  accuracy := case when gps_accuracy_m is not null and gps_accuracy_m > 0
                   then gps_accuracy_m else 0 end;
  coordinate_uncertainty_m := ceil(half_diagonal_m + accuracy);

  data_generalizations :=
    'Coordinates generalized to the centroid of a 1 km grid cell (EPSG:32632).';
  information_withheld :=
    'Precise coordinates withheld to protect free-roaming animals from culling and poisoning. '
    'Available to approved researchers on request.';

  return next;
end;
$$;

comment on function public.generalize_point is
  'Reduce a precise WGS84 point to its 1 km grid cell centroid. Every published '
  'coordinate in this system passes through here first.';

-- ---------------------------------------------------------------------------
-- Keep observations.location_public in step with the restricted precise point.
--
-- The RPC computes these columns when it inserts, but this trigger is the
-- guarantee: whatever the precise point is, the published columns are derived
-- from it and cannot be set to something else by hand.
-- ---------------------------------------------------------------------------

create or replace function public.sync_generalized_location()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  generalized record;
  accuracy double precision;
begin
  select gps_accuracy_m into accuracy
  from public.observations where id = new.observation_id;

  select * into generalized
  from public.generalize_point(new.location_precise, accuracy);

  update public.observations
  set grid_cell_id = generalized.grid_cell_id,
      location_public = generalized.location_public,
      coordinate_uncertainty_m = generalized.coordinate_uncertainty_m,
      data_generalizations = generalized.data_generalizations,
      information_withheld = generalized.information_withheld
  where id = new.observation_id;

  return new;
end;
$$;

create trigger observation_locations_sync_public
  after insert or update of location_precise on public.observation_locations
  for each row execute function public.sync_generalized_location();

-- Recompute the published columns whenever the accuracy figure changes, so
-- coordinate_uncertainty_m never understates error.
create or replace function public.refresh_uncertainty_on_accuracy_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  precise extensions.geometry;
  generalized record;
begin
  select location_precise into precise
  from public.observation_locations where observation_id = new.id;

  if precise is null then
    return new;
  end if;

  select * into generalized from public.generalize_point(precise, new.gps_accuracy_m);
  new.grid_cell_id := generalized.grid_cell_id;
  new.location_public := generalized.location_public;
  new.coordinate_uncertainty_m := generalized.coordinate_uncertainty_m;
  new.data_generalizations := generalized.data_generalizations;
  new.information_withheld := generalized.information_withheld;
  return new;
end;
$$;

create trigger observations_refresh_uncertainty
  before update of gps_accuracy_m on public.observations
  for each row
  when (new.gps_accuracy_m is distinct from old.gps_accuracy_m)
  execute function public.refresh_uncertainty_on_accuracy_change();

-- Cache route length so clients need no PostGIS to show effort.
create or replace function public.set_route_length()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.length_km := extensions.ST_Length(new.geometry::extensions.geography) / 1000.0;
  return new;
end;
$$;

create trigger routes_set_length
  before insert or update of geometry on public.routes
  for each row execute function public.set_route_length();
