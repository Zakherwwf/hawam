-- Access rules for the v2 tables.
--
-- Same shape as the rest of the schema: reading is community-wide for
-- signed-in users, writing belongs to the record's owner, curation belongs to
-- researchers, and anon gets nothing.
--
-- The exception is track_points, which carry the one protection v2 keeps: a
-- surveyor's raw fixes inside their own privacy zone are hidden from everyone
-- else. The zone protects where the person lives, not the animal data.

alter table public.track_points enable row level security;
alter table public.observation_animals enable row level security;
alter table public.colonies enable row level security;
alter table public.privacy_zones enable row level security;

-- ---------------------------------------------------------------------------
-- privacy_zones: entirely private. Publishing the circles would publish the
-- very thing they hide.
-- ---------------------------------------------------------------------------

create policy privacy_zones_own on public.privacy_zones
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/**
 * True when a point falls inside any of that user's privacy zones.
 *
 * SECURITY DEFINER because it reads privacy_zones, which the caller cannot
 * see -- that is the point: another user must be able to have their points
 * filtered without being able to read the filter.
 */
create or replace function public.is_in_privacy_zone(
  owner uuid,
  point extensions.geometry
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.privacy_zones z
    where z.user_id = owner
      and extensions.ST_DWithin(z.centre, point::extensions.geography, z.radius_m)
  );
$$;

comment on function public.is_in_privacy_zone(uuid, extensions.geometry) is
  'Whether a fix sits inside one of that surveyor''s own privacy zones.';

revoke execute on function public.is_in_privacy_zone(uuid, extensions.geometry) from public, anon;
grant execute on function public.is_in_privacy_zone(uuid, extensions.geometry) to authenticated;

-- ---------------------------------------------------------------------------
-- track_points
-- ---------------------------------------------------------------------------

create policy track_points_select on public.track_points
  for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = track_points.session_id
        and (
          -- Your own track, always, zones included: hiding a surveyor's
          -- fixes from the surveyor would serve nobody.
          s.observer_id = auth.uid()
          or not public.is_in_privacy_zone(s.observer_id, track_points.location)
        )
    )
  );

create policy track_points_write_own on public.track_points
  for all to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = track_points.session_id and s.observer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = track_points.session_id and s.observer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- observation_animals: follows its observation
-- ---------------------------------------------------------------------------

create policy observation_animals_select on public.observation_animals
  for select to authenticated
  using (true);

create policy observation_animals_write_own on public.observation_animals
  for all to authenticated
  using (
    exists (
      select 1
      from public.observations o
      join public.sessions s on s.id = o.session_id
      where o.id = observation_animals.observation_id and s.observer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.observations o
      join public.sessions s on s.id = o.session_id
      where o.id = observation_animals.observation_id and s.observer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- colonies: anyone may add one, the author or a researcher may edit it.
-- A feeding point is local knowledge; researchers curate, they do not gate.
-- ---------------------------------------------------------------------------

create policy colonies_select on public.colonies
  for select to authenticated
  using (deleted_at is null or public.is_researcher());

create policy colonies_insert on public.colonies
  for insert to authenticated
  with check (created_by = auth.uid());

create policy colonies_update on public.colonies
  for update to authenticated
  using (created_by = auth.uid() or public.is_researcher())
  with check (created_by = auth.uid() or public.is_researcher());

create policy colonies_delete on public.colonies
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants. Writes still go through the sync RPC, but these tables are read
-- directly, and deletes have to work for account deletion.
-- ---------------------------------------------------------------------------

grant select on public.track_points to authenticated;
grant select, insert, update, delete on public.observation_animals to authenticated;
grant select, insert, update, delete on public.colonies to authenticated;
grant select, insert, update, delete on public.privacy_zones to authenticated;
grant delete on public.track_points to authenticated;

revoke all on public.track_points from anon;
revoke all on public.observation_animals from anon;
revoke all on public.colonies from anon;
revoke all on public.privacy_zones from anon;

-- Raw fixes are written only by the sync RPC, which is SECURITY DEFINER.
revoke insert, update on public.track_points from authenticated;

-- ---------------------------------------------------------------------------
-- The map view now carries the animal position rather than the observer's.
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: the column list changes, and CREATE OR
-- REPLACE VIEW cannot rename or reorder columns.
drop view if exists public.observations_map;

create view public.observations_map
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
  -- The animal, which is what a map of animals should show.
  extensions.ST_Y(ol.animal_location) as latitude,
  extensions.ST_X(ol.animal_location) as longitude,
  -- The observer, for anyone reconstructing the detection geometry.
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
  s.protocol
from public.observations o
join public.observation_locations ol on ol.observation_id = o.id
join public.sessions s on s.id = o.session_id
left join public.users u on u.id = s.observer_id
where o.deleted_at is null;

grant select on public.observations_map to authenticated;
revoke all on public.observations_map from anon;
