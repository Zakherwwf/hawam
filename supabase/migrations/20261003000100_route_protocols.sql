-- Route protocols, route history and dashboard read models.
--
-- 1. A fixed route is a protocol, not only a line. Researchers set the walking
--    direction, the side of the street to watch, the strip width, the time
--    window, the revisit interval and written instructions, so every
--    volunteer walking the route follows the same rules.
-- 2. Routes are never hard-deleted once walked. Deleting a route archives it
--    (deleted_at); its geometry and rules stay for the sessions that used it.
-- 3. Every change to a route's geometry or rules bumps its version and keeps
--    the previous one in route_revisions. Each session records the version it
--    was walked under, so analyses can split by protocol version.
-- 4. track_points_app exposes raw fixes with lat/lon for the walk profile
--    (speed and accuracy charts, rejected points), under the same RLS.

-- ---------------------------------------------------------------------------
-- 1. Protocol columns on routes
-- ---------------------------------------------------------------------------

alter table public.routes
  add column if not exists direction_rule text not null default 'as_drawn'
    check (direction_rule in ('as_drawn', 'either')),
  add column if not exists side_rule text not null default 'both'
    check (side_rule in ('both', 'left', 'right')),
  add column if not exists strip_width_m double precision
    check (strip_width_m is null or strip_width_m between 1 and 500),
  add column if not exists target_duration_min integer
    check (target_duration_min is null or target_duration_min between 5 and 600),
  add column if not exists window_start time,
  add column if not exists window_end time,
  add column if not exists revisit_days integer
    check (revisit_days is null or revisit_days between 0 and 365),
  add column if not exists require_complete boolean not null default true,
  add column if not exists instructions text
    check (instructions is null or char_length(instructions) <= 2000),
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.users (id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users (id) on delete set null;

alter table public.routes drop constraint if exists routes_window_complete;
alter table public.routes add constraint routes_window_complete
  check ((window_start is null) = (window_end is null));

comment on column public.routes.direction_rule is
  'as_drawn: walk from the first vertex to the last. either: any direction.';
comment on column public.routes.side_rule is
  'Which side of the path observers record: both, left or right (facing the walking direction).';
comment on column public.routes.strip_width_m is
  'Truncation distance for distance sampling. Animals farther than this from the path are not recorded.';
comment on column public.routes.revisit_days is
  'Minimum days between two counted visits, for temporal independence of repeat surveys.';
comment on column public.routes.version is
  'Protocol version. Bumped whenever geometry or rules change; sessions keep the version they used.';
comment on column public.routes.deleted_at is
  'Archived. Hidden from the app and the route list; kept for the sessions that walked it.';

create index if not exists routes_live_idx on public.routes (created_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Revision history and version bump
-- ---------------------------------------------------------------------------

create table if not exists public.route_revisions (
  id bigint generated always as identity primary key,
  route_id uuid not null references public.routes (id) on delete cascade,
  version integer not null,
  geometry extensions.geometry (LineString, 4326) not null,
  rules jsonb not null,
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (route_id, version)
);

comment on table public.route_revisions is
  'Every earlier version of a route''s line and rules. Written by trigger, never by clients.';

alter table public.route_revisions enable row level security;

drop policy if exists route_revisions_select on public.route_revisions;
create policy route_revisions_select on public.route_revisions
  for select to authenticated using (public.is_researcher());

revoke all on public.route_revisions from anon, authenticated;
grant select on public.route_revisions to authenticated;

create or replace function public.route_rules_json(r public.routes)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'name', r.name,
    'direction_rule', r.direction_rule,
    'side_rule', r.side_rule,
    'strip_width_m', r.strip_width_m,
    'target_duration_min', r.target_duration_min,
    'window_start', r.window_start,
    'window_end', r.window_end,
    'revisit_days', r.revisit_days,
    'require_complete', r.require_complete,
    'instructions', r.instructions,
    'length_km', r.length_km
  );
$$;

create or replace function public.route_versioning()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' and (
       -- OrderingEquals, not ST_Equals: a reversed line covers the same points but
       -- is a different protocol (the walking direction changed)
       not extensions.ST_OrderingEquals(new.geometry, old.geometry)
       or public.route_rules_json(new) - 'name' is distinct from public.route_rules_json(old) - 'name'
     ) then
    insert into public.route_revisions (route_id, version, geometry, rules, changed_by)
    values (old.id, old.version, old.geometry, public.route_rules_json(old), auth.uid())
    on conflict (route_id, version) do nothing;
    new.version := old.version + 1;
  elsif tg_op = 'UPDATE' then
    new.version := old.version;
  end if;
  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := auth.uid();
    new.is_active := false;
  end if;
  return new;
end;
$$;

revoke all on function public.route_versioning() from public, anon, authenticated;

drop trigger if exists routes_versioning on public.routes;
create trigger routes_versioning
  before insert or update on public.routes
  for each row execute function public.route_versioning();

-- A walked route cannot be hard-deleted: archive it instead.
create or replace function public.routes_block_hard_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.sessions s where s.route_id = old.id) then
    raise exception 'route % has sessions; archive it (set deleted_at) instead', old.id
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists routes_no_hard_delete on public.routes;
create trigger routes_no_hard_delete
  before delete on public.routes
  for each row execute function public.routes_block_hard_delete();

-- ---------------------------------------------------------------------------
-- 3. Sessions remember the protocol version they were walked under
-- ---------------------------------------------------------------------------

alter table public.sessions add column if not exists route_version integer;

comment on column public.sessions.route_version is
  'routes.version at upload time. Lets analyses separate walks done under different rules.';

create or replace function public.session_route_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.route_id is not null and new.route_version is null then
    select r.version into new.route_version from public.routes r where r.id = new.route_id;
  end if;
  return new;
end;
$$;

revoke all on function public.session_route_version() from public, anon, authenticated;

drop trigger if exists sessions_route_version on public.sessions;
create trigger sessions_route_version
  before insert on public.sessions
  for each row execute function public.session_route_version();

update public.sessions s set route_version = r.version
from public.routes r
where s.route_id = r.id and s.route_version is null;

-- ---------------------------------------------------------------------------
-- 4. routes_app: rules for the app, archived routes hidden
--    (new columns appended so create or replace keeps the old ones)
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
  r.created_at,
  r.direction_rule,
  r.side_rule,
  r.strip_width_m,
  r.target_duration_min,
  r.window_start,
  r.window_end,
  r.revisit_days,
  r.require_complete,
  r.instructions,
  r.version
from public.routes r
where r.is_active and r.deleted_at is null;

comment on view public.routes_app is
  'Active routes with the line as GeoJSON ([lon, lat] pairs, first vertex = start) and the walking rules, for the mobile app.';

revoke all on public.routes_app from anon, authenticated;
grant select on public.routes_app to authenticated;

-- Researcher view of every route, archived ones included, with geometry.
create or replace view public.routes_admin
with (security_invoker = on) as
select
  r.id,
  r.name,
  r.governorate,
  r.delegation,
  r.habitat_notes,
  coalesce(r.length_km, extensions.ST_Length(r.geometry::extensions.geography) / 1000.0) as length_km,
  extensions.ST_AsGeoJSON(r.geometry)::json as geometry,
  r.is_active,
  r.created_at,
  r.created_by,
  r.direction_rule,
  r.side_rule,
  r.strip_width_m,
  r.target_duration_min,
  r.window_start,
  r.window_end,
  r.revisit_days,
  r.require_complete,
  r.instructions,
  r.version,
  r.updated_at,
  r.updated_by,
  r.deleted_at
from public.routes r
where public.is_researcher();

revoke all on public.routes_admin from anon, authenticated;
grant select on public.routes_admin to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Raw track points with coordinates, for the walk profile
-- ---------------------------------------------------------------------------

create or replace view public.track_points_app
with (security_invoker = on) as
select
  tp.session_id,
  tp.recorded_at,
  extensions.ST_Y(tp.location) as latitude,
  extensions.ST_X(tp.location) as longitude,
  tp.accuracy_m,
  tp.speed_mps,
  tp.is_mock,
  tp.rejected_reason
from public.track_points tp;

comment on view public.track_points_app is
  'Every raw GPS fix, accepted or rejected, as lat/lon. Same row access as track_points.';

revoke all on public.track_points_app from anon, authenticated;
grant select on public.track_points_app to authenticated;
