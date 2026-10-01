-- Guard the published coordinate columns against direct client writes.
--
-- observations carries the generalized location, and RLS lets a volunteer
-- update their own observation rows (a researcher updates them too, to link an
-- individual). Without this trigger, a client could PATCH
-- observations.location_public with the animal's real position: a coordinate
-- that never passed through public.generalize_point(), sitting in the column
-- every export and every map reads.
--
-- The rule this enforces: the published location is always derived from the
-- restricted precise point, never asserted by a client.

create or replace function public.protect_generalized_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Inside submit_survey_bundle() and the generalization triggers, current_user
  -- is the definer-function owner, not the caller's role. Those paths compute
  -- the values from the precise point and are trusted; a client is not.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception
      'observations must be created through public.submit_survey_bundle(), '
      'so the published location is derived from the precise point'
      using errcode = '42501';
  end if;

  -- An update may change the animal's attributes. It may not move the dot.
  new.grid_cell_id := old.grid_cell_id;
  new.location_public := old.location_public;
  new.coordinate_uncertainty_m := old.coordinate_uncertainty_m;
  new.data_generalizations := old.data_generalizations;
  new.information_withheld := old.information_withheld;
  return new;
end;
$$;

comment on function public.protect_generalized_columns() is
  'Keeps observations.location_public derived rather than client-supplied. '
  'Every published coordinate must come from public.generalize_point().';

create trigger observations_protect_generalized_columns
  before insert or update on public.observations
  for each row execute function public.protect_generalized_columns();

-- The same reasoning for sessions.distance_km would be wrong: effort is
-- reported by the client and is not a location. Left writable on purpose.
