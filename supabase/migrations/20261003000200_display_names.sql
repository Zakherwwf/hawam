-- Display names for everyone, and a researcher-only people directory.
--
-- The app keeps the name a person types (or the Google name) in the auth
-- profile (raw_user_meta_data.full_name / name) but never copied it to
-- public.users.display_name, so the portal showed "Unnamed volunteer" for
-- everyone but the signed-in researcher.
--
-- 1. Backfill display_name from the auth profile, else the part of the
--    email before the @.
-- 2. Fill it on sign-up and whenever the auth profile changes, without
--    overwriting a name someone already set.
-- 3. user_directory(): email and last sign-in for researchers and admins
--    only, so they can recognise and contact colleagues. Volunteers get
--    nothing from it; emails never enter public tables.

create or replace function public.name_from_auth(meta jsonb, email text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(left(btrim(coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(btrim(meta ->> 'display_name'), ''),
    split_part(coalesce(email, ''), '@', 1)
  )), 80), '');
$$;

update public.users u
set display_name = public.name_from_auth(a.raw_user_meta_data, a.email)
from auth.users a
where a.id = u.id
  and (u.display_name is null or btrim(u.display_name) = '');

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, role, display_name)
  values (new.id, 'volunteer', public.name_from_auth(new.raw_user_meta_data, new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_display_name_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.users u
  set display_name = public.name_from_auth(new.raw_user_meta_data, new.email)
  where u.id = new.id
    and (u.display_name is null or btrim(u.display_name) = ''
         -- an email-derived placeholder gives way to a real name when one arrives
         or u.display_name = split_part(coalesce(old.email, ''), '@', 1));
  return new;
end;
$$;

revoke all on function public.sync_display_name_from_auth() from public, anon, authenticated;

drop trigger if exists on_auth_user_profile_changed on auth.users;
create trigger on_auth_user_profile_changed
  after update of raw_user_meta_data, email on auth.users
  for each row execute function public.sync_display_name_from_auth();

create or replace function public.user_directory()
returns table (id uuid, email text, last_sign_in_at timestamptz, provider text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.email::text, a.last_sign_in_at, a.raw_app_meta_data ->> 'provider'
  from auth.users a
  where public.is_researcher();
$$;

comment on function public.user_directory() is
  'Email, last sign-in and sign-in method per account. Returns rows only to researchers and admins.';

revoke all on function public.user_directory() from public, anon;
grant execute on function public.user_directory() to authenticated;
