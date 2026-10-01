-- Permanent, unique, human-readable code for every observation.
--
-- The app used to label observations on the device only: survey codes
-- restarted at CAT-001 in every survey and quick-sighting codes were
-- SPECIES-DDMM-<second of the clock mod 1000>, so the same label named
-- different animals, across users and within one user, and the database never
-- stored it. Codes are now assigned here, once, at insert: CAT-000001,
-- DOG-000001, OBS-000001 (species unknown), numbered per species. A sequence
-- never hands out the same number twice and a unique index enforces it.
-- The observation UUID remains the key; the code is its public name.

create sequence if not exists public.observation_code_cat_seq;
create sequence if not exists public.observation_code_dog_seq;
create sequence if not exists public.observation_code_other_seq;

create or replace function public.next_observation_code(p_species public.species)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return case p_species
    when 'cat' then 'CAT-' || lpad(nextval('public.observation_code_cat_seq')::text, 6, '0')
    when 'dog' then 'DOG-' || lpad(nextval('public.observation_code_dog_seq')::text, 6, '0')
    else 'OBS-' || lpad(nextval('public.observation_code_other_seq')::text, 6, '0')
  end;
end;
$$;

revoke all on function public.next_observation_code(public.species) from public, anon, authenticated;

alter table public.observations add column if not exists public_code text;

-- Existing observations are numbered in the order they were made
do $$
declare
  r record;
begin
  for r in
    select id, species from public.observations
    where public_code is null
    order by observed_at, created_at, id
  loop
    update public.observations
    set public_code = public.next_observation_code(r.species)
    where id = r.id;
  end loop;
end;
$$;

alter table public.observations alter column public_code set not null;
create unique index if not exists observations_public_code_key on public.observations (public_code);

-- Assigned on insert; a client can never set or change it. Deliberately not
-- security definer: current_user must be the caller's role for the check to
-- see 'authenticated' (the same reason protect_generalized_columns is not).
-- Inserts only happen inside submit_survey_bundle, running as its owner, which
-- may call next_observation_code.
create or replace function public.assign_observation_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.public_code := public.next_observation_code(new.species);
  elsif current_user in ('anon', 'authenticated') then
    new.public_code := old.public_code;
  end if;
  return new;
end;
$$;

create trigger observations_assign_code
  before insert or update of public_code on public.observations
  for each row execute function public.assign_observation_code();

comment on column public.observations.public_code is
  'Permanent public name of the observation (CAT-000001). Assigned once by the database.';

-- Expose the code where observations are read: the shared map and Darwin Core
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
  o.is_welfare_alert,
  o.notes,
  extensions.ST_Y(ol.animal_location) as latitude,
  extensions.ST_X(ol.animal_location) as longitude,
  extensions.ST_Y(ol.location_precise) as observer_latitude,
  extensions.ST_X(ol.location_precise) as observer_longitude,
  ol.location_method,
  ol.bearing_deg,
  ol.distance_estimate_m,
  o.distance_computed_m as perpendicular_distance_m,
  o.h3_res9,
  o.h3_res7,
  o.gps_accuracy_m,
  s.observer_id,
  u.display_name as observer_name,
  s.protocol,
  o.public_code
from public.observations o
join public.observation_locations ol on ol.observation_id = o.id
join public.sessions s on s.id = o.session_id
left join public.users u on u.id = s.observer_id
where o.deleted_at is null;

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
  o.grid_cell_id as "gridCellID",
  o.public_code as "catalogNumber"
from public.observations o
join public.sessions s on s.id = o.session_id
left join public.ref_taxa t on t.species = o.species
where s.validation_status is distinct from 'flagged'
  and s.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Grants. Supabase grants every new object in public to anon and
-- authenticated by default, and this project's rule is that anon holds no
-- grant on anything it creates. 20260929000100 relied on RLS alone for its
-- reference data; make the grants explicit, for it and for this migration.
-- ---------------------------------------------------------------------------

revoke all on public.ref_countries, public.ref_admin1, public.ref_timezones, public.ref_taxa
  from anon, authenticated;
grant select on public.ref_countries, public.ref_admin1, public.ref_timezones, public.ref_taxa
  to authenticated;

revoke all on sequence public.ref_countries_id_seq, public.ref_admin1_id_seq, public.ref_timezones_id_seq,
  public.observation_code_cat_seq, public.observation_code_dog_seq, public.observation_code_other_seq
  from anon, authenticated;

revoke all on public.dwc_occurrence, public.observations_map from anon;
revoke all on public.dwc_occurrence from authenticated;
grant select on public.dwc_occurrence to authenticated;

revoke all on function
  public.resolve_geography(extensions.geometry),
  public.local_wall_time(timestamptz, text),
  public.set_observation_local_time(),
  public.attribute_observation_geography(),
  public.attribute_session_geography(),
  public.assign_observation_code()
  from public, anon, authenticated;
