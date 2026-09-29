-- The sync contract.
--
-- `sync_push` takes a batch of outbox entries and upserts them. `sync_pull`
-- returns what has changed since a timestamp. Between them they replace
-- `submit_survey_bundle()`, which only ever understood one shape of payload;
-- the outbox needs to push a partial edit, a late photo, or a track recovered
-- after a crash, in whatever order the device managed to record them.
--
-- Three properties the device depends on:
--
--   * **Idempotent.** Every entry is keyed by a client-generated UUID, so a
--     retry after a lost response changes nothing. The device may resend
--     freely, which is what lets it delete nothing until the server confirms.
--   * **Ordered within a batch.** Entries are applied session → track points →
--     observations → animals → photos → matches, because each depends on the
--     one before. The device sends them in that order too; this is the
--     guarantee, not the hope.
--   * **Per-entry results.** One bad record must not reject the batch. Each
--     entry comes back with its own status, so a permanently broken record can
--     be marked blocked while everything around it goes through.

create type public.sync_entity as enum (
  'session', 'track_points', 'observation', 'observation_animal', 'photo', 'individual_match'
);

-- ---------------------------------------------------------------------------
-- sync_push
-- ---------------------------------------------------------------------------

create or replace function public.sync_push(entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller uuid := auth.uid();
  entry jsonb;
  payload jsonb;
  entity public.sync_entity;
  entry_id uuid;
  results jsonb := '[]'::jsonb;
  outcome text;
  detail text;
  session_owner uuid;
  observation_owner uuid;
  precise extensions.geometry;
  animal extensions.geometry;
  accuracy double precision;
  generalized record;
  point jsonb;
  applied integer := 0;
  failed integer := 0;
begin
  if caller is null then
    raise exception 'sync_push: authentication required' using errcode = '28000';
  end if;

  if not exists (select 1 from public.users u where u.id = caller and u.consent_version is not null) then
    raise exception 'sync_push: consent must be accepted before submitting data'
      using errcode = '42501';
  end if;

  for entry in select value from jsonb_array_elements(coalesce(entries, '[]'::jsonb))
  loop
    entity := (entry ->> 'entity')::public.sync_entity;
    entry_id := (entry ->> 'id')::uuid;
    payload := entry -> 'payload';
    outcome := 'applied';
    detail := null;

    begin
      case entity

        -- ---- session ----------------------------------------------------
        when 'session' then
          insert into public.sessions (
            id, observer_id, protocol, route_id, start_time, end_time, distance_km,
            complete_session, number_of_observers, weather, time_of_day, app_version,
            device_gps_accuracy_avg, device_model, moving_time_s, h3_cells_res9,
            mock_location_detected, notes
          )
          values (
            entry_id, caller,
            (payload ->> 'protocol')::public.protocol,
            nullif(payload ->> 'route_id', '')::uuid,
            (payload ->> 'start_time')::timestamptz,
            nullif(payload ->> 'end_time', '')::timestamptz,
            nullif(payload ->> 'distance_km', '')::double precision,
            coalesce((payload ->> 'complete_session')::boolean, false),
            coalesce((payload ->> 'number_of_observers')::integer, 1),
            nullif(payload ->> 'weather', '')::public.weather,
            nullif(payload ->> 'time_of_day', '')::public.time_of_day,
            payload ->> 'app_version',
            nullif(payload ->> 'device_gps_accuracy_avg', '')::double precision,
            payload ->> 'device_model',
            nullif(payload ->> 'moving_time_s', '')::integer,
            coalesce(
              (select array_agg(value::text)
                 from jsonb_array_elements_text(coalesce(payload -> 'h3_cells_res9', '[]'::jsonb)) as value),
              '{}'
            ),
            coalesce((payload ->> 'mock_location_detected')::boolean, false),
            payload ->> 'notes'
          )
          on conflict (id) do update
            set end_time = excluded.end_time,
                distance_km = excluded.distance_km,
                complete_session = excluded.complete_session,
                moving_time_s = excluded.moving_time_s,
                h3_cells_res9 = excluded.h3_cells_res9,
                device_gps_accuracy_avg = excluded.device_gps_accuracy_avg,
                mock_location_detected = excluded.mock_location_detected,
                notes = excluded.notes,
                synced_at = now()
            -- A session belongs to whoever started it, permanently.
            where public.sessions.observer_id = caller;

          if not exists (
            select 1 from public.sessions s where s.id = entry_id and s.observer_id = caller
          ) then
            raise exception 'session % belongs to another observer', entry_id
              using errcode = '42501';
          end if;

        -- ---- track points (a batch per entry) ----------------------------
        when 'track_points' then
          select observer_id into session_owner
            from public.sessions where id = (payload ->> 'session_id')::uuid;
          if session_owner is distinct from caller then
            raise exception 'track points for a session that is not yours'
              using errcode = '42501';
          end if;

          for point in select value from jsonb_array_elements(coalesce(payload -> 'points', '[]'::jsonb))
          loop
            insert into public.track_points (
              id, session_id, recorded_at, location, accuracy_m, altitude_m,
              speed_mps, heading_deg, provider, is_mock, rejected_reason
            )
            values (
              (point ->> 'id')::uuid,
              (payload ->> 'session_id')::uuid,
              (point ->> 'recorded_at')::timestamptz,
              extensions.ST_SetSRID(
                extensions.ST_MakePoint(
                  (point ->> 'longitude')::double precision,
                  (point ->> 'latitude')::double precision
                ), 4326),
              nullif(point ->> 'accuracy_m', '')::double precision,
              nullif(point ->> 'altitude_m', '')::double precision,
              nullif(point ->> 'speed_mps', '')::double precision,
              nullif(point ->> 'heading_deg', '')::double precision,
              point ->> 'provider',
              coalesce((point ->> 'is_mock')::boolean, false),
              nullif(point ->> 'rejected_reason', '')
            )
            on conflict (id) do nothing;
          end loop;

        -- ---- observation -------------------------------------------------
        when 'observation' then
          select observer_id into session_owner
            from public.sessions where id = (payload ->> 'session_id')::uuid;
          if session_owner is distinct from caller then
            raise exception 'observation for a session that is not yours'
              using errcode = '42501';
          end if;

          accuracy := nullif(payload #>> '{observer_location,gps_accuracy_m}', '')::double precision;
          precise := extensions.ST_SetSRID(
            extensions.ST_MakePoint(
              (payload #>> '{observer_location,longitude}')::double precision,
              (payload #>> '{observer_location,latitude}')::double precision
            ), 4326);

          -- The animal's own position when the client computed one, otherwise
          -- the observer's. Both are stored either way.
          animal := case
            when payload #>> '{animal_location,latitude}' is not null then
              extensions.ST_SetSRID(
                extensions.ST_MakePoint(
                  (payload #>> '{animal_location,longitude}')::double precision,
                  (payload #>> '{animal_location,latitude}')::double precision
                ), 4326)
            else precise
          end;

          -- Published columns are still derived from a real point, never
          -- asserted by the client.
          select * into generalized from public.generalize_point(animal, accuracy);

          insert into public.observations (
            id, session_id, observed_at, grid_cell_id, location_public,
            coordinate_uncertainty_m, gps_accuracy_m, data_generalizations,
            information_withheld, species, group_size, distance_from_path_m,
            sex, age_class, reproductive_status, body_condition_score,
            visible_health_issues, ear_tip_or_notch, collar_or_tag, behaviour,
            being_fed_by_people, habitat_type, food_sources_visible, coat_pattern,
            h3_res9, h3_res7, governorate_code, delegation_code, is_welfare_alert,
            colony_id, notes
          )
          values (
            entry_id,
            (payload ->> 'session_id')::uuid,
            (payload ->> 'observed_at')::timestamptz,
            generalized.grid_cell_id, generalized.location_public,
            generalized.coordinate_uncertainty_m, accuracy,
            generalized.data_generalizations, generalized.information_withheld,
            (payload ->> 'species')::public.species,
            coalesce((payload ->> 'group_size')::integer, 1),
            nullif(payload ->> 'distance_estimate_m', '')::double precision,
            coalesce(nullif(payload ->> 'sex', '')::public.sex, 'unknown'),
            coalesce(nullif(payload ->> 'age_class', '')::public.age_class, 'unknown'),
            coalesce(nullif(payload ->> 'reproductive_status', '')::public.reproductive_status, 'unknown'),
            nullif(payload ->> 'body_condition_score', '')::smallint,
            coalesce(
              (select array_agg(value::text::public.health_issue)
                 from jsonb_array_elements_text(coalesce(payload -> 'visible_health_issues', '[]'::jsonb)) as value),
              '{}'
            ),
            coalesce(nullif(payload ->> 'ear_tip_or_notch', '')::public.tristate, 'unknown'),
            coalesce(nullif(payload ->> 'collar_or_tag', '')::public.tristate, 'unknown'),
            nullif(payload ->> 'behaviour', '')::public.behaviour,
            coalesce(nullif(payload ->> 'being_fed_by_people', '')::public.tristate, 'unknown'),
            nullif(payload ->> 'habitat_type', '')::public.habitat_type,
            coalesce(
              (select array_agg(value::text::public.food_source)
                 from jsonb_array_elements_text(coalesce(payload -> 'food_sources_visible', '[]'::jsonb)) as value),
              '{}'
            ),
            nullif(payload ->> 'coat_pattern', '')::public.coat_pattern,
            payload ->> 'h3_res9',
            payload ->> 'h3_res7',
            payload ->> 'governorate_code',
            payload ->> 'delegation_code',
            coalesce((payload ->> 'is_welfare_alert')::boolean, false),
            nullif(payload ->> 'colony_id', '')::uuid,
            payload ->> 'notes'
          )
          on conflict (id) do nothing;

          insert into public.observation_locations (
            observation_id, location_precise, animal_location, location_method,
            bearing_deg, distance_estimate_m
          )
          values (
            entry_id, precise, animal,
            coalesce(nullif(payload ->> 'location_method', '')::public.location_method, 'same_as_observer'),
            nullif(payload ->> 'bearing_deg', '')::double precision,
            nullif(payload ->> 'distance_estimate_m', '')::double precision
          )
          on conflict (observation_id) do nothing;

        -- ---- per-animal detail inside a group ----------------------------
        when 'observation_animal' then
          select s.observer_id into observation_owner
            from public.observations o
            join public.sessions s on s.id = o.session_id
           where o.id = (payload ->> 'observation_id')::uuid;
          if observation_owner is distinct from caller then
            raise exception 'animal detail for an observation that is not yours'
              using errcode = '42501';
          end if;

          insert into public.observation_animals (
            id, observation_id, ordinal, sex, age_class, reproductive_status,
            body_condition_score, visible_health_issues, ear_tip_or_notch,
            collar_or_tag, behaviour, being_fed_by_people, coat_pattern,
            primary_colour, individual_id
          )
          values (
            entry_id,
            (payload ->> 'observation_id')::uuid,
            (payload ->> 'ordinal')::integer,
            coalesce(nullif(payload ->> 'sex', '')::public.sex, 'unknown'),
            coalesce(nullif(payload ->> 'age_class', '')::public.age_class, 'unknown'),
            coalesce(nullif(payload ->> 'reproductive_status', '')::public.reproductive_status, 'unknown'),
            nullif(payload ->> 'body_condition_score', '')::smallint,
            coalesce(
              (select array_agg(value::text::public.health_issue)
                 from jsonb_array_elements_text(coalesce(payload -> 'visible_health_issues', '[]'::jsonb)) as value),
              '{}'
            ),
            coalesce(nullif(payload ->> 'ear_tip_or_notch', '')::public.tristate, 'unknown'),
            coalesce(nullif(payload ->> 'collar_or_tag', '')::public.tristate, 'unknown'),
            nullif(payload ->> 'behaviour', '')::public.behaviour,
            coalesce(nullif(payload ->> 'being_fed_by_people', '')::public.tristate, 'unknown'),
            nullif(payload ->> 'coat_pattern', '')::public.coat_pattern,
            payload ->> 'primary_colour',
            nullif(payload ->> 'individual_id', '')::uuid
          )
          on conflict (id) do update
            set sex = excluded.sex,
                age_class = excluded.age_class,
                body_condition_score = excluded.body_condition_score,
                individual_id = excluded.individual_id;

        -- ---- photo metadata (the file itself goes to Storage) -------------
        when 'photo' then
          select s.observer_id into observation_owner
            from public.observations o
            join public.sessions s on s.id = o.session_id
           where o.id = (payload ->> 'observation_id')::uuid;
          if observation_owner is distinct from caller then
            raise exception 'photo for an observation that is not yours'
              using errcode = '42501';
          end if;

          insert into public.photos (
            id, observation_id, storage_path, thumbnail_path, angle, taken_at,
            width_px, height_px, quality_warning, blur_score, brightness_score
          )
          values (
            entry_id,
            (payload ->> 'observation_id')::uuid,
            payload ->> 'storage_path',
            payload ->> 'thumbnail_path',
            (payload ->> 'angle')::public.photo_angle,
            (payload ->> 'taken_at')::timestamptz,
            nullif(payload ->> 'width_px', '')::integer,
            nullif(payload ->> 'height_px', '')::integer,
            nullif(payload ->> 'quality_warning', ''),
            nullif(payload ->> 'blur_score', '')::double precision,
            nullif(payload ->> 'brightness_score', '')::double precision
          )
          on conflict (id) do update
            set thumbnail_path = excluded.thumbnail_path,
                blur_score = excluded.blur_score,
                brightness_score = excluded.brightness_score;

        -- ---- proposed individual match -----------------------------------
        when 'individual_match' then
          insert into public.individual_matches (
            id, photo_a, photo_b, method, score, status, individual_id
          )
          values (
            entry_id,
            (payload ->> 'photo_a')::uuid,
            (payload ->> 'photo_b')::uuid,
            'human',
            nullif(payload ->> 'score', '')::double precision,
            'proposed',
            nullif(payload ->> 'individual_id', '')::uuid
          )
          on conflict (id) do nothing;
      end case;

      applied := applied + 1;
    exception when others then
      -- One bad record must not reject the batch: everything around it still
      -- goes through, and the device learns which entry to stop retrying.
      outcome := 'failed';
      detail := sqlerrm;
      failed := failed + 1;
    end;

    results := results || jsonb_build_object(
      'id', entry_id, 'entity', entity, 'status', outcome, 'error', detail
    );
  end loop;

  -- Distances to the walked track, once the points for this batch are in.
  -- Built as a CTE rather than a lateral: an UPDATE's FROM clause cannot
  -- reference the table being updated.
  with touched as (
    select (value ->> 'id')::uuid as session_id
      from jsonb_array_elements(coalesce(entries, '[]'::jsonb))
     where value ->> 'entity' = 'session'
  ),
  tracks as (
    select tp.session_id,
           extensions.ST_MakeLine(tp.location order by tp.recorded_at) as track
      from public.track_points tp
     where tp.rejected_reason is null
       and tp.session_id in (select session_id from touched)
     group by tp.session_id
    having count(*) >= 2
  )
  update public.observations o
     set distance_computed_m = round(
           extensions.ST_Distance(
             ol.animal_location::extensions.geography,
             t.track::extensions.geography
           )::numeric, 2)
    from public.observation_locations ol, tracks t
   where ol.observation_id = o.id
     and t.session_id = o.session_id;

  return jsonb_build_object('applied', applied, 'failed', failed, 'results', results);
end;
$$;

comment on function public.sync_push(jsonb) is
  'Idempotent upsert of outbox entries in dependency order. Returns a result '
  'per entry so one bad record cannot reject the batch.';

revoke execute on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_pull: reference data the device needs, changed since a timestamp
-- ---------------------------------------------------------------------------

create or replace function public.sync_pull(since timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller uuid := auth.uid();
  cutoff timestamptz := coalesce(since, '-infinity'::timestamptz);
begin
  if caller is null then
    raise exception 'sync_pull: authentication required' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'server_time', now(),
    'routes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'length_km', r.length_km,
        'governorate', r.governorate, 'delegation', r.delegation,
        'is_active', r.is_active,
        'geometry', extensions.ST_AsGeoJSON(r.geometry)::jsonb
      ))
      from public.routes r
      where r.is_active and r.created_at > cutoff
    ), '[]'::jsonb),
    'colonies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'type', c.type, 'name', c.name,
        'latitude', extensions.ST_Y(c.location),
        'longitude', extensions.ST_X(c.location),
        'last_verified_at', c.last_verified_at,
        'deleted_at', c.deleted_at
      ))
      from public.colonies c
      where c.updated_at > cutoff
    ), '[]'::jsonb),
    'individuals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'species', i.species, 'nickname', i.nickname,
        'coat_pattern', i.coat_pattern, 'identifiability', i.identifiability,
        'sightings_count', i.sightings_count, 'status', i.status,
        'last_seen', i.last_seen
      ))
      from public.individuals i
      where i.updated_at > cutoff
    ), '[]'::jsonb),
    -- The caller's own profile and standing. Gamification is
    -- server-authoritative, so this is the value the app displays.
    'profile', (
      select jsonb_build_object(
        'id', u.id, 'display_name', u.display_name, 'role', u.role,
        'preferred_language', u.preferred_language, 'consent_version', u.consent_version
      )
      from public.users u where u.id = caller
    ),
    'stats', (
      select to_jsonb(s) from public.user_stats s where s.user_id = caller
    )
  );
end;
$$;

comment on function public.sync_pull(timestamptz) is
  'Reference data changed since `since`, plus the caller''s own profile and '
  'server-computed standing.';

revoke execute on function public.sync_pull(timestamptz) from public, anon;
grant execute on function public.sync_pull(timestamptz) to authenticated;

-- `submit_survey_bundle()` still works and is still tested, but new code
-- should use sync_push: the outbox needs to send partial edits and late
-- photos, which a whole-bundle call cannot express.
comment on function public.submit_survey_bundle(jsonb) is
  'DEPRECATED in favour of sync_push(). Retained because the pre-outbox app '
  'releases call it. Idempotent on client-generated ids.';
