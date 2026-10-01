-- Re-identification: link sightings to individual animals.
--
-- Capture-recapture and SECR need to know that two sightings are the same
-- animal. Volunteers propose it in the field ("same as Ginger", or "a new
-- animal to follow"); researchers confirm or reject in the portal. The older
-- individual_matches table compares photo pairs and stays for a future
-- automatic matcher; human decisions are sighting-to-individual links.
--
-- The bundle RPC keeps its exact contract: the existing body becomes
-- submit_survey_bundle_core, and a wrapper with the old name runs it, then
-- records any "individual" block on each observation, but only for
-- observations in the caller's own session.

-- ---------------------------------------------------------------------------
-- Individuals: who registered them
-- ---------------------------------------------------------------------------

alter table public.individuals
  add column if not exists created_by uuid references public.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Links
-- ---------------------------------------------------------------------------

create table if not exists public.individual_links (
  id uuid primary key default extensions.gen_random_uuid(),
  observation_id uuid not null references public.observations (id) on delete cascade,
  individual_id uuid not null references public.individuals (id) on delete cascade,
  -- The sighting that registered the animal; confirmed by definition
  is_founder boolean not null default false,
  decision text not null default 'same' check (decision in ('same', 'unsure')),
  method public.match_method not null default 'human',
  status public.match_status not null default 'proposed',
  proposed_by uuid references public.users (id) on delete set null,
  reviewer_id uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (observation_id, individual_id)
);

comment on table public.individual_links is
  'A sighting proposed, confirmed or rejected as a given individual. Confirmed '
  'links (and founders) build capture histories.';

create index if not exists individual_links_individual_idx on public.individual_links (individual_id, status);
create index if not exists individual_links_status_idx on public.individual_links (status) where status = 'proposed';

alter table public.individual_links enable row level security;

drop policy if exists individual_links_select on public.individual_links;
create policy individual_links_select on public.individual_links
  for select to authenticated using (true);

drop policy if exists individual_links_review on public.individual_links;
create policy individual_links_review on public.individual_links
  for update to authenticated
  using (public.is_researcher())
  with check (public.is_researcher());

revoke all on public.individual_links from anon, authenticated;
grant select, update (status, reviewer_id, reviewed_at) on public.individual_links to authenticated;

-- A review stamps who and when; confirmed links set the sighting's
-- linked_individual_id, rejected ones clear it.
create or replace function public.apply_link_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if auth.uid() is not null then
      new.reviewer_id := auth.uid();
    end if;
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.sync_linked_individual()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'confirmed' then
    update public.observations set linked_individual_id = new.individual_id where id = new.observation_id;
  elsif new.status = 'rejected' then
    update public.observations set linked_individual_id = null
    where id = new.observation_id and linked_individual_id = new.individual_id;
  end if;
  update public.individuals i
  set sightings_count = (
        select count(*) from public.individual_links l
        where l.individual_id = i.id and l.status <> 'rejected'
      ),
      first_seen = (
        select min(o.observed_at) from public.individual_links l
        join public.observations o on o.id = l.observation_id
        where l.individual_id = i.id and l.status <> 'rejected'
      ),
      last_seen = (
        select max(o.observed_at) from public.individual_links l
        join public.observations o on o.id = l.observation_id
        where l.individual_id = i.id and l.status <> 'rejected'
      )
  where i.id = new.individual_id;
  return null;
end;
$$;

revoke all on function public.apply_link_review() from public, anon, authenticated;
revoke all on function public.sync_linked_individual() from public, anon, authenticated;

drop trigger if exists individual_links_review_stamp on public.individual_links;
create trigger individual_links_review_stamp
  before update on public.individual_links
  for each row execute function public.apply_link_review();

drop trigger if exists individual_links_sync on public.individual_links;
create trigger individual_links_sync
  after insert or update on public.individual_links
  for each row execute function public.sync_linked_individual();

-- ---------------------------------------------------------------------------
-- Bundle RPC: same name and contract, links recorded after the core insert
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_survey_bundle_core'
  ) then
    alter function public.submit_survey_bundle(jsonb) rename to submit_survey_bundle_core;
  end if;
end;
$$;

revoke all on function public.submit_survey_bundle_core(jsonb) from public, anon, authenticated;

create or replace function public.submit_survey_bundle(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller uuid := auth.uid();
  result jsonb;
  obs jsonb;
  ind jsonb;
  obs_id uuid;
  ind_id uuid;
  obs_species public.species;
  obs_at timestamptz;
  links integer := 0;
begin
  result := public.submit_survey_bundle_core(payload);

  for obs in select value from jsonb_array_elements(coalesce(payload -> 'observations', '[]'::jsonb))
  loop
    ind := obs -> 'individual';
    continue when ind is null or jsonb_typeof(ind) <> 'object';
    obs_id := nullif(obs ->> 'id', '')::uuid;
    ind_id := nullif(ind ->> 'id', '')::uuid;
    continue when obs_id is null or ind_id is null;

    -- Only the caller's own observations can be linked
    select o.species, o.observed_at into obs_species, obs_at
    from public.observations o
    join public.sessions s on s.id = o.session_id
    where o.id = obs_id and s.observer_id = caller;
    continue when not found;

    if coalesce((ind ->> 'new')::boolean, false) then
      insert into public.individuals (id, species, nickname, coat_pattern, first_seen, last_seen, created_by)
      values (
        ind_id,
        obs_species,
        left(nullif(trim(ind ->> 'nickname'), ''), 60),
        nullif(ind ->> 'coat_pattern', '')::public.coat_pattern,
        obs_at,
        obs_at,
        caller
      )
      on conflict (id) do nothing;
      insert into public.individual_links (observation_id, individual_id, is_founder, decision, status, proposed_by)
      values (obs_id, ind_id, true, 'same', 'confirmed', caller)
      on conflict (observation_id, individual_id) do nothing;
      links := links + 1;
    else
      -- A resighting proposal: same species only
      if exists (select 1 from public.individuals i where i.id = ind_id and i.species = obs_species) then
        insert into public.individual_links (observation_id, individual_id, decision, status, proposed_by)
        values (
          obs_id,
          ind_id,
          case when ind ->> 'decision' = 'unsure' then 'unsure' else 'same' end,
          'proposed',
          caller
        )
        on conflict (observation_id, individual_id) do nothing;
        links := links + 1;
      end if;
    end if;
  end loop;

  return result || jsonb_build_object('individual_links', links);
end;
$$;

revoke all on function public.submit_survey_bundle(jsonb) from public, anon;
grant execute on function public.submit_survey_bundle(jsonb) to authenticated;

comment on function public.submit_survey_bundle(jsonb) is
  'Atomic survey upload (see submit_survey_bundle_core), then optional per-'
  'observation individual links: {"individual": {"id", "new", "nickname", '
  '"coat_pattern"}} registers an animal; {"individual": {"id", "decision"}} '
  'proposes a resighting.';

-- ---------------------------------------------------------------------------
-- Known animals for the app and the portal
-- ---------------------------------------------------------------------------

create or replace view public.individuals_app
with (security_invoker = on) as
select
  i.id,
  i.species,
  i.nickname,
  i.coat_pattern,
  i.created_by,
  i.created_at,
  i.first_seen,
  i.last_seen,
  i.sightings_count,
  last_obs.latitude,
  last_obs.longitude,
  last_obs.observation_id as last_observation_id,
  photo.storage_path as photo_path,
  coalesce(sides.has_left, false) as has_left_flank,
  coalesce(sides.has_right, false) as has_right_flank,
  (select count(*) from public.individual_links l where l.individual_id = i.id and l.status = 'proposed')::integer as pending_links
from public.individuals i
left join lateral (
  select l.observation_id, extensions.ST_Y(ol.location_precise) as latitude, extensions.ST_X(ol.location_precise) as longitude
  from public.individual_links l
  join public.observations o on o.id = l.observation_id
  join public.observation_locations ol on ol.observation_id = o.id
  where l.individual_id = i.id and l.status <> 'rejected'
  order by o.observed_at desc
  limit 1
) last_obs on true
left join lateral (
  select p.storage_path
  from public.individual_links l
  join public.photos p on p.observation_id = l.observation_id
  where l.individual_id = i.id and l.status <> 'rejected' and p.deleted_at is null
  order by (p.angle in ('left_flank', 'right_flank')) desc, p.taken_at desc
  limit 1
) photo on true
left join lateral (
  select bool_or(p.angle = 'left_flank') as has_left, bool_or(p.angle = 'right_flank') as has_right
  from public.individual_links l
  join public.photos p on p.observation_id = l.observation_id
  where l.individual_id = i.id and l.status <> 'rejected'
) sides on true;

comment on view public.individuals_app is
  'Known animals with their latest position and photo, and which flanks are '
  'photographed, so the app can ask for the missing side.';

revoke all on public.individuals_app from anon, authenticated;
grant select on public.individuals_app to authenticated;

revoke all on public.individual_links from anon;
