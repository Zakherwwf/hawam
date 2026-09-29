-- Public views and the single write path.

-- ---------------------------------------------------------------------------
-- observations_public
--
-- Generalized records with no observer identity. security_invoker = on so the
-- caller's own RLS still applies: a volunteer sees their own rows, a researcher
-- sees everything. Either way the coordinates are cell centroids.
-- ---------------------------------------------------------------------------

create view public.observations_public
with (security_invoker = on) as
select
  o.id,
  o.session_id,
  o.observed_at,
  o.grid_cell_id,
  extensions.ST_Y(o.location_public) as decimal_latitude,
  extensions.ST_X(o.location_public) as decimal_longitude,
  o.coordinate_uncertainty_m,
  o.data_generalizations,
  o.information_withheld,
  o.species,
  o.group_size,
  o.distance_from_path_m,
  o.sex,
  o.age_class,
  o.reproductive_status,
  o.body_condition_score,
  o.visible_health_issues,
  o.ear_tip_or_notch,
  o.collar_or_tag,
  o.behaviour,
  o.being_fed_by_people,
  o.habitat_type,
  o.food_sources_visible,
  o.coat_pattern,
  s.protocol,
  s.complete_session,
  s.distance_km as session_distance_km,
  s.duration_min as session_duration_min
from public.observations o
join public.sessions s on s.id = o.session_id;

comment on view public.observations_public is
  'Generalized observation records. Contains no precise coordinates and no '
  'observer identity. Safe to expose to any signed-in user.';

-- ---------------------------------------------------------------------------
-- map_density_public
--
-- The only animal map a regular user ever sees: counts per 1 km cell, and only
-- for cells that clear a disclosure threshold. A cell reported from a single
-- observer or a single sighting would point at one street, so it is withheld.
--
-- SECURITY DEFINER (security_invoker = off) on purpose: aggregation is what
-- makes the data safe, so it must run over the whole table rather than over
-- the caller's own visible rows.
-- ---------------------------------------------------------------------------

create view public.map_density_public
with (security_invoker = off) as
select
  o.grid_cell_id,
  o.species,
  count(*)::integer as observation_count,
  sum(o.group_size)::integer as individuals_counted,
  count(distinct s.observer_id)::integer as observer_count,
  min(o.observed_at) as first_observed_at,
  max(o.observed_at) as last_observed_at,
  extensions.ST_Y(min(o.location_public)::extensions.geometry) as decimal_latitude,
  extensions.ST_X(min(o.location_public)::extensions.geometry) as decimal_longitude
from public.observations o
join public.sessions s on s.id = o.session_id
group by o.grid_cell_id, o.species
having count(*) >= 5 and count(distinct s.observer_id) >= 2;

comment on view public.map_density_public is
  'Aggregated animal density per 1 km cell. Suppresses any cell with fewer '
  'than 5 observations or fewer than 2 distinct observers, so no cell can be '
  'traced to one person''s sightings. Never add a row-level map alongside this.';

revoke all on public.observations_public from anon;
revoke all on public.map_density_public from anon;
grant select on public.observations_public to authenticated;
grant select on public.map_density_public to authenticated;

-- ---------------------------------------------------------------------------
-- submit_survey_bundle: the only way precise coordinates enter the database.
--
-- Takes one session and everything recorded inside it. Idempotent on the
-- client-generated ids, so an offline device can retry a half-delivered sync
-- without creating duplicates.
-- ---------------------------------------------------------------------------

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

  -- The walked path goes straight into the restricted table.
  track_points := session_json -> 'track';
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

  for observation_json in
    select value from jsonb_array_elements(coalesce(payload -> 'observations', '[]'::jsonb))
  loop
    observation_uuid := (observation_json ->> 'id')::uuid;
    accuracy := nullif(observation_json #>> '{location,gps_accuracy_m}', '')::double precision;
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

comment on function public.submit_survey_bundle(jsonb) is
  'The only supported write path for survey data. Idempotent on client-'
  'generated ids so an interrupted offline sync can be retried safely. '
  'Returns counts, never coordinates.';

revoke execute on function public.submit_survey_bundle(jsonb) from public, anon;
grant execute on function public.submit_survey_bundle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_consent: recording is blocked until this has been called.
-- ---------------------------------------------------------------------------

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
  set consent_version = version,
      consent_accepted_at = now(),
      preferred_language = coalesce(accept_consent.language, u.preferred_language)
  where u.id = auth.uid();
end;
$$;

revoke execute on function public.accept_consent(integer, public.language) from public, anon;
grant execute on function public.accept_consent(integer, public.language) to authenticated;
