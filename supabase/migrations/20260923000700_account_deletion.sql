-- Account deletion must actually delete.
--
-- Deleting the auth user cascades through the personal data: profile ->
-- sessions -> observations -> observation_locations, session_tracks, photos.
-- Four references stood in the way, all of them pointing at a *person* from a
-- record that should outlive them, so each becomes ON DELETE SET NULL rather
-- than blocking the deletion or destroying shared scientific data:
--
--   routes.created_by            a route other people still walk
--   individuals.confirmed_by     a confirmed animal identity
--   individual_matches.reviewer_id  a reviewed photo match
--   export_audit.actor_id        an audit trail that must survive
--
-- The audit row keeps actor_role, so "a researcher exported precise
-- coordinates on this date" remains answerable after the account is gone.

alter table public.routes alter column created_by drop not null;
alter table public.routes drop constraint routes_created_by_fkey;
alter table public.routes add constraint routes_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.individuals drop constraint individuals_confirmed_by_fkey;
alter table public.individuals add constraint individuals_confirmed_by_fkey
  foreign key (confirmed_by) references public.users (id) on delete set null;

alter table public.individual_matches drop constraint individual_matches_reviewer_id_fkey;
alter table public.individual_matches add constraint individual_matches_reviewer_id_fkey
  foreign key (reviewer_id) references public.users (id) on delete set null;

alter table public.export_audit drop constraint export_audit_actor_id_fkey;
alter table public.export_audit add constraint export_audit_actor_id_fkey
  foreign key (actor_id) references public.users (id) on delete set null;

-- A reviewed match must still name a reviewer, but a deleted reviewer leaves
-- null behind; the verdict itself stays valid, so the check has to allow it.
alter table public.individual_matches drop constraint individual_matches_reviewed_has_reviewer;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'delete_my_account: authentication required' using errcode = '28000';
  end if;

  -- One statement, because every table that holds this person's data hangs off
  -- auth.users by a cascading foreign key. Deleting row by row here would risk
  -- leaving the precise locations behind, which is the one thing that must not
  -- survive a deletion request.
  delete from auth.users where id = caller;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the calling user and, by cascade, every record they submitted '
  'including their precise locations and tracks. Shared scientific records '
  '(routes, confirmed individuals, audit rows) survive with the person '
  'reference set to null.';

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
