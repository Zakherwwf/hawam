-- Role helpers.
--
-- These run after public.users exists: a `language sql` body is parsed when the
-- function is created, so defining them alongside the vocabularies would fail
-- on a fresh database.

-- ---------------------------------------------------------------------------
-- Role helpers
--
-- These read public.users, which is itself protected by RLS. They are
-- SECURITY DEFINER so that reading a caller's own role does not recurse into
-- the policy that is currently being evaluated.
-- ---------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid();
$$;

comment on function public.current_app_role() is
  'The calling user''s application role, or null when unauthenticated.';

-- The single place that decides who may see a precise animal location.
-- Free-roaming animals in Tunisia are sometimes culled or poisoned; exposing
-- exact coordinates to the public puts them at risk. Do not widen this.
create or replace function public.can_read_precise_locations()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() in ('researcher', 'admin'), false);
$$;

comment on function public.can_read_precise_locations() is
  'True only for researcher and admin. Gate for every precise-coordinate read.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

revoke execute on function public.current_app_role() from public;
revoke execute on function public.can_read_precise_locations() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.can_read_precise_locations() to authenticated;
grant execute on function public.is_admin() to authenticated;
