-- Row-level security.
--
-- Two independent gates protect precise coordinates:
--   1. Table grants. anon has no privileges at all on the restricted tables,
--      and authenticated has SELECT only -- no direct writes.
--   2. RLS policies. SELECT on the restricted tables is allowed only when
--      public.can_read_precise_locations() is true.
--
-- Either gate alone would stop a leak. Both are here because this is the rule
-- the whole project rests on.

alter table public.users enable row level security;
alter table public.routes enable row level security;
alter table public.sessions enable row level security;
alter table public.session_tracks enable row level security;
alter table public.observations enable row level security;
alter table public.observation_locations enable row level security;
alter table public.photos enable row level security;
alter table public.individuals enable row level security;
alter table public.individual_matches enable row level security;
alter table public.export_audit enable row level security;

-- Force RLS even for the table owner, so a definer function written later
-- cannot bypass these policies by accident.
alter table public.observation_locations force row level security;
alter table public.session_tracks force row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- A user may edit their language and consent, but never their own role.
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

create policy users_admin_all on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- routes: readable by every signed-in surveyor, writable by researchers.
-- Route geometry shows where people survey, not where animals are.
-- ---------------------------------------------------------------------------

create policy routes_select_authenticated on public.routes
  for select to authenticated
  using (true);

create policy routes_write_researcher on public.routes
  for all to authenticated
  using (public.can_read_precise_locations())
  with check (public.can_read_precise_locations());

-- ---------------------------------------------------------------------------
-- sessions: own rows, plus everything for researchers.
-- Other users' sessions stay invisible -- never expose who surveyed where.
-- ---------------------------------------------------------------------------

create policy sessions_select_own on public.sessions
  for select to authenticated
  using (observer_id = auth.uid() or public.can_read_precise_locations());

create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check (observer_id = auth.uid());

create policy sessions_update_own on public.sessions
  for update to authenticated
  using (observer_id = auth.uid())
  with check (observer_id = auth.uid());

create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using (observer_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- session_tracks: RESTRICTED. A walked path reveals animal locations and the
-- observer's movements. Not even the observer reads it back.
-- ---------------------------------------------------------------------------

create policy session_tracks_select_researcher on public.session_tracks
  for select to authenticated
  using (public.can_read_precise_locations());

create policy session_tracks_delete_own on public.session_tracks
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.sessions s
      where s.id = session_tracks.session_id and s.observer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- observations: public-safe columns only. Own rows plus researcher access.
-- ---------------------------------------------------------------------------

create policy observations_select_own on public.observations
  for select to authenticated
  using (
    public.can_read_precise_locations()
    or exists (
      select 1 from public.sessions s
      where s.id = observations.session_id and s.observer_id = auth.uid()
    )
  );

create policy observations_insert_own on public.observations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = observations.session_id and s.observer_id = auth.uid()
    )
  );

create policy observations_update_own on public.observations
  for update to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = observations.session_id and s.observer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = observations.session_id and s.observer_id = auth.uid()
    )
  );

create policy observations_researcher_link on public.observations
  for update to authenticated
  using (public.can_read_precise_locations())
  with check (public.can_read_precise_locations());

create policy observations_delete_own on public.observations
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.sessions s
      where s.id = observations.session_id and s.observer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- observation_locations: THE restricted table.
--
-- There is exactly one SELECT policy and it requires the researcher role.
-- There is no INSERT or UPDATE policy at all: writes happen inside
-- public.submit_survey_bundle(), which is SECURITY DEFINER and owned by a role
-- exempt from these policies.
-- ---------------------------------------------------------------------------

create policy observation_locations_select_researcher on public.observation_locations
  for select to authenticated
  using (public.can_read_precise_locations());

-- Deleting one's own data must still work, for the account-deletion promise.
create policy observation_locations_delete_own on public.observation_locations
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.observations o
      join public.sessions s on s.id = o.session_id
      where o.id = observation_locations.observation_id
        and s.observer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------

create policy photos_select_own on public.photos
  for select to authenticated
  using (
    public.can_read_precise_locations()
    or exists (
      select 1
      from public.observations o
      join public.sessions s on s.id = o.session_id
      where o.id = photos.observation_id and s.observer_id = auth.uid()
    )
  );

create policy photos_write_own on public.photos
  for all to authenticated
  using (
    exists (
      select 1
      from public.observations o
      join public.sessions s on s.id = o.session_id
      where o.id = photos.observation_id and s.observer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.observations o
      join public.sessions s on s.id = o.session_id
      where o.id = photos.observation_id and s.observer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- individuals and matches: the researcher review queue
-- ---------------------------------------------------------------------------

create policy individuals_select_authenticated on public.individuals
  for select to authenticated
  using (true);

create policy individuals_write_researcher on public.individuals
  for all to authenticated
  using (public.can_read_precise_locations())
  with check (public.can_read_precise_locations());

create policy individual_matches_researcher on public.individual_matches
  for all to authenticated
  using (public.can_read_precise_locations())
  with check (public.can_read_precise_locations());

-- ---------------------------------------------------------------------------
-- export_audit: append-only. Researchers see their own trail; admins see all.
-- Nobody may update or delete a row -- no policy grants it.
-- ---------------------------------------------------------------------------

create policy export_audit_select on public.export_audit
  for select to authenticated
  using (actor_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Table grants: the second, independent gate.
-- ---------------------------------------------------------------------------

-- Nothing in this schema is readable without signing in.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Restricted tables: SELECT only, and only for callers RLS then approves.
-- All writes go through submit_survey_bundle(), so revoke them outright.
revoke insert, update, delete, truncate on public.observation_locations from authenticated;
revoke insert, update, delete, truncate on public.session_tracks from authenticated;
grant select on public.observation_locations to authenticated;
grant select on public.session_tracks to authenticated;
-- Account deletion still has to work.
grant delete on public.observation_locations to authenticated;
grant delete on public.session_tracks to authenticated;

-- export_audit is append-only: no UPDATE or DELETE for anyone but the service role.
revoke update, delete, truncate on public.export_audit from authenticated;

-- A user cannot promote themselves; role changes go through an admin.
revoke insert, delete on public.users from authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: the restricted tables are deliberately NOT published.
--
-- Realtime replays row payloads to subscribers. Adding observation_locations or
-- session_tracks to a publication would stream precise coordinates to every
-- listener. Do not add them.
-- ---------------------------------------------------------------------------
