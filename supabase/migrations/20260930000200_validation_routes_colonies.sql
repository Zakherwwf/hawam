-- App integrity pass:
-- 1. Anti-cheat runs in the database, on every submitted session. The
--    validate_session Edge Function was never called, read columns that do not
--    exist (duration_s, distance_m), and a check the client must remember to
--    call is a check a cheater can skip. Now a deferred trigger validates each
--    session at the end of the submitting transaction, when its track points
--    and observations are in place. CLAUDE.md 2.2: flagged sessions do not
--    reach the leaderboards (effort_leaderboard already excludes them).
-- 2. routes_app: routes with their line as GeoJSON, which the app can read
--    without PostGIS (PostgREST returns raw geometry as WKB).
-- 3. Colonies carry what the app records (species, counts, facilities), visits
--    get their own table, and colonies_app serves both to every volunteer.

-- ---------------------------------------------------------------------------
-- 1. Session validation
-- ---------------------------------------------------------------------------

alter table public.sessions
  add column if not exists validation_reasons text[] not null default '{}';

comment on column public.sessions.validation_reasons is
  'Why the session was flagged: mock_location, vehicle_speed, teleport, '
  'average_speed, implausible_density. Empty when valid.';

create or replace function public.validate_session_record(p_session uuid)
returns public.validation_status
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  s public.sessions;
  reasons text[] := '{}';
  mock_points integer;
  fast_segments integer;
  teleports integer;
  animals integer;
  verdict public.validation_status;
begin
  select * into s from public.sessions where id = p_session;
  if not found then
    return null;
  end if;

  select count(*) into mock_points
  from public.track_points where session_id = p_session and is_mock;
  if mock_points > 0 or s.mock_location_detected then
    reasons := array_append(reasons, 'mock_location');
  end if;

  -- Segments between consecutive accepted fixes
  with pts as (
    select recorded_at, location,
           lag(recorded_at) over w as prev_at,
           lag(location) over w as prev_loc
    from public.track_points
    where session_id = p_session and rejected_reason is null
    window w as (order by recorded_at)
  ), seg as (
    select extensions.ST_DistanceSphere(prev_loc, location) as metres,
           extract(epoch from (recorded_at - prev_at)) as secs
    from pts where prev_loc is not null
  )
  select
    count(*) filter (where metres > 10 and secs > 0 and metres / secs > 4.17),
    count(*) filter (where metres > 500 and (secs <= 0 or metres / secs > 50))
  into fast_segments, teleports
  from seg;

  if fast_segments > 3 then
    reasons := array_append(reasons, 'vehicle_speed');
  end if;
  if teleports > 0 then
    reasons := array_append(reasons, 'teleport');
  end if;

  if s.protocol = 'transect' and coalesce(s.duration_min, 0) > 1
     and coalesce(s.distance_km, 0) / (s.duration_min / 60.0) > 8 then
    reasons := array_append(reasons, 'average_speed');
  end if;

  select coalesce(sum(group_size), 0) into animals
  from public.observations where session_id = p_session and deleted_at is null;
  if animals > 50 and s.protocol = 'transect' and coalesce(s.distance_km, 0) < 0.1 then
    reasons := array_append(reasons, 'implausible_density');
  end if;

  verdict := case when cardinality(reasons) = 0 then 'valid' else 'flagged' end;
  update public.sessions
  set validation_status = verdict, validation_reasons = reasons
  where id = p_session;
  return verdict;
end;
$$;

revoke all on function public.validate_session_record(uuid) from public, anon, authenticated;

create or replace function public.validate_session_at_commit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.validate_session_record(new.id);
  return null;
end;
$$;

revoke all on function public.validate_session_at_commit() from public, anon, authenticated;

drop trigger if exists sessions_validate_at_commit on public.sessions;
create constraint trigger sessions_validate_at_commit
  after insert on public.sessions
  deferrable initially deferred
  for each row execute function public.validate_session_at_commit();

-- Observers cannot grade themselves. Not security definer: current_user must
-- be the caller's role (the same pattern as assign_observation_code).
create or replace function public.protect_validation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.validation_status := old.validation_status;
    new.validation_reasons := old.validation_reasons;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_validation() from public, anon, authenticated;

drop trigger if exists sessions_protect_validation on public.sessions;
create trigger sessions_protect_validation
  before update of validation_status, validation_reasons on public.sessions
  for each row execute function public.protect_validation();

-- Sessions already submitted are graded once
select public.validate_session_record(id)
from public.sessions
where validation_status = 'pending' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Routes for the app
-- ---------------------------------------------------------------------------

create or replace view public.routes_app
with (security_invoker = on) as
select
  r.id,
  r.name,
  r.governorate,
  r.delegation,
  r.habitat_notes,
  coalesce(r.length_km, extensions.ST_Length(r.geometry::extensions.geography) / 1000.0) as length_km,
  extensions.ST_AsGeoJSON(r.geometry)::json as geometry,
  r.created_at
from public.routes r
where r.is_active;

comment on view public.routes_app is
  'Active routes with the line as GeoJSON ([lon, lat] pairs) for the mobile app.';

revoke all on public.routes_app from anon, authenticated;
grant select on public.routes_app to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Colonies and visits
-- ---------------------------------------------------------------------------

alter table public.colonies
  add column if not exists species text check (species is null or species in ('cat', 'dog', 'mixed')),
  add column if not exists estimated_population integer check (estimated_population is null or estimated_population between 0 and 5000),
  add column if not exists sterilised_count integer check (sterilised_count is null or sterilised_count >= 0),
  add column if not exists has_water boolean not null default false,
  add column if not exists has_shelter boolean not null default false,
  add column if not exists caretaker_name text check (caretaker_name is null or char_length(caretaker_name) <= 120),
  add column if not exists feeding_schedule text check (feeding_schedule is null or char_length(feeding_schedule) <= 160),
  add column if not exists area text check (area is null or char_length(area) <= 120);

alter table public.colonies drop constraint if exists colonies_sterilised_le_population;
alter table public.colonies add constraint colonies_sterilised_le_population
  check (sterilised_count is null or estimated_population is null or sterilised_count <= estimated_population);

create table if not exists public.colony_visits (
  id uuid primary key,
  colony_id uuid not null references public.colonies (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null default auth.uid(),
  visited_at timestamptz not null default now(),
  tags text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists colony_visits_colony_idx on public.colony_visits (colony_id, visited_at desc);

alter table public.colony_visits enable row level security;

drop policy if exists colony_visits_select on public.colony_visits;
create policy colony_visits_select on public.colony_visits
  for select to authenticated using (true);

drop policy if exists colony_visits_insert on public.colony_visits;
create policy colony_visits_insert on public.colony_visits
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists colony_visits_delete on public.colony_visits;
create policy colony_visits_delete on public.colony_visits
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

revoke all on public.colony_visits from anon, authenticated;
grant select, insert, delete on public.colony_visits to authenticated;

create or replace view public.colonies_app
with (security_invoker = on) as
select
  c.id,
  c.name,
  c.type,
  coalesce(c.species, case c.type when 'dog_pack_area' then 'dog' else 'cat' end) as species,
  extensions.ST_Y(c.location) as latitude,
  extensions.ST_X(c.location) as longitude,
  c.estimated_population,
  c.sterilised_count,
  c.has_water,
  c.has_shelter,
  c.caretaker_name,
  c.feeding_schedule,
  c.area,
  c.notes,
  c.created_by,
  c.created_at,
  v.visit_count,
  greatest(c.last_verified_at, v.last_visit, c.created_at) as last_visit_at
from public.colonies c
left join lateral (
  select count(*)::integer as visit_count, max(visited_at) as last_visit
  from public.colony_visits cv where cv.colony_id = c.id
) v on true
where c.deleted_at is null;

comment on view public.colonies_app is
  'Colonies with coordinates and visit totals for the mobile app.';

revoke all on public.colonies_app from anon, authenticated;
grant select on public.colonies_app to authenticated;

-- Nothing added here is readable by anon
revoke all on public.colonies from anon;
