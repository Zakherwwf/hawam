-- Gamification: contribution stats, experience points and a named leaderboard.
--
-- XP is computed here and nowhere else. The app reads the number rather than
-- recomputing it, so the rules cannot drift between client and server, and a
-- client cannot award itself points.
--
-- The weights reward the behaviour the science needs, not raw activity:
-- covering new ground and photographing both flanks are worth more than
-- logging the same dog on the same corner every morning.

create or replace function public.xp_weights()
returns table (
  per_observation integer,
  per_extra_animal integer,
  per_completed_session integer,
  per_kilometre integer,
  per_flank_photo integer,
  per_new_cell integer
)
language sql
immutable
as $$
  select 10, 2, 25, 5, 15, 30;
$$;

comment on function public.xp_weights() is
  'The single definition of what each contribution is worth. The app displays '
  'these so the scoring is legible rather than mysterious.';

grant execute on function public.xp_weights() to authenticated;

-- ---------------------------------------------------------------------------
-- Per-user contribution totals.
--
-- SECURITY DEFINER (security_invoker = off) so the aggregate is the same
-- number for everyone looking at it -- a leaderboard computed through each
-- viewer's own row visibility would rank people differently per viewer.
-- ---------------------------------------------------------------------------

create or replace view public.user_stats
with (security_invoker = off) as
with observation_totals as (
  select
    s.observer_id,
    count(*)::integer as observation_count,
    coalesce(sum(o.group_size), 0)::integer as animal_count,
    count(distinct o.grid_cell_id)::integer as cell_count,
    count(distinct o.species)::integer as species_count,
    count(*) filter (where o.species = 'cat')::integer as cat_count,
    count(*) filter (where o.species = 'dog')::integer as dog_count,
    count(*) filter (where o.ear_tip_or_notch = 'yes')::integer as ear_tipped_count,
    min(o.observed_at) as first_observed_at,
    max(o.observed_at) as last_observed_at
  from public.observations o
  join public.sessions s on s.id = o.session_id
  group by s.observer_id
),
session_totals as (
  select
    s.observer_id,
    count(*)::integer as session_count,
    count(*) filter (where s.end_time is not null)::integer as completed_session_count,
    count(*) filter (where s.protocol <> 'incidental')::integer as structured_session_count,
    coalesce(sum(s.distance_km), 0)::double precision as distance_km,
    coalesce(sum(s.duration_min), 0)::double precision as minutes_surveyed
  from public.sessions s
  group by s.observer_id
),
photo_totals as (
  select
    s.observer_id,
    count(*)::integer as photo_count,
    count(*) filter (where p.angle in ('left_flank', 'right_flank'))::integer as flank_photo_count
  from public.photos p
  join public.observations o on o.id = p.observation_id
  join public.sessions s on s.id = o.session_id
  group by s.observer_id
)
select
  u.id as user_id,
  u.display_name,
  u.role,
  u.created_at as joined_at,
  coalesce(o.observation_count, 0) as observation_count,
  coalesce(o.animal_count, 0) as animal_count,
  coalesce(o.cell_count, 0) as cell_count,
  coalesce(o.species_count, 0) as species_count,
  coalesce(o.cat_count, 0) as cat_count,
  coalesce(o.dog_count, 0) as dog_count,
  coalesce(o.ear_tipped_count, 0) as ear_tipped_count,
  coalesce(se.session_count, 0) as session_count,
  coalesce(se.completed_session_count, 0) as completed_session_count,
  coalesce(se.structured_session_count, 0) as structured_session_count,
  coalesce(se.distance_km, 0) as distance_km,
  coalesce(se.minutes_surveyed, 0) as minutes_surveyed,
  coalesce(p.photo_count, 0) as photo_count,
  coalesce(p.flank_photo_count, 0) as flank_photo_count,
  o.first_observed_at,
  o.last_observed_at,
  (
    coalesce(o.observation_count, 0) * (select per_observation from public.xp_weights())
    + greatest(coalesce(o.animal_count, 0) - coalesce(o.observation_count, 0), 0)
      * (select per_extra_animal from public.xp_weights())
    + coalesce(se.completed_session_count, 0) * (select per_completed_session from public.xp_weights())
    + floor(coalesce(se.distance_km, 0))::integer * (select per_kilometre from public.xp_weights())
    + coalesce(p.flank_photo_count, 0) * (select per_flank_photo from public.xp_weights())
    + coalesce(o.cell_count, 0) * (select per_new_cell from public.xp_weights())
  )::integer as xp
from public.users u
left join observation_totals o on o.observer_id = u.id
left join session_totals se on se.observer_id = u.id
left join photo_totals p on p.observer_id = u.id;

comment on view public.user_stats is
  'Contribution totals and XP per user. The same numbers for every viewer.';

-- ---------------------------------------------------------------------------
-- The leaderboard.
--
-- Anyone with no XP at all is left off: an empty board entry is discouraging
-- to its owner and noise to everyone else.
-- ---------------------------------------------------------------------------

create or replace view public.leaderboard
with (security_invoker = off) as
select
  rank() over (order by xp desc, observation_count desc, user_id) as position,
  user_id,
  coalesce(display_name, 'Anonymous') as display_name,
  role,
  xp,
  observation_count,
  animal_count,
  cell_count,
  distance_km,
  session_count,
  last_observed_at
from public.user_stats
where xp > 0;

comment on view public.leaderboard is
  'Named ranking by XP. Display names are chosen by users themselves.';

-- ---------------------------------------------------------------------------
-- The days a user recorded something, for streaks.
--
-- Dates are computed in Africa/Tunis, not UTC: a sighting at 01:00 local is
-- the same day to the person who recorded it, whatever the server thinks.
-- ---------------------------------------------------------------------------

create or replace view public.user_activity_days
with (security_invoker = off) as
select distinct
  s.observer_id as user_id,
  (o.observed_at at time zone 'Africa/Tunis')::date as activity_day
from public.observations o
join public.sessions s on s.id = o.session_id;

comment on view public.user_activity_days is
  'One row per user per day they recorded anything, in Tunisian local time.';

grant select on public.user_stats to authenticated;
grant select on public.leaderboard to authenticated;
grant select on public.user_activity_days to authenticated;
revoke all on public.user_stats from anon;
revoke all on public.leaderboard from anon;
revoke all on public.user_activity_days from anon;

-- ---------------------------------------------------------------------------
-- Display names.
--
-- A leaderboard needs something to call people. This is the only place a user
-- publishes anything about themselves, so it is opt-in and free-form; the
-- email address is never shown to anyone.
-- ---------------------------------------------------------------------------

create or replace function public.set_display_name(name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  trimmed text := nullif(btrim(name), '');
begin
  if auth.uid() is null then
    raise exception 'set_display_name: authentication required' using errcode = '28000';
  end if;
  if trimmed is not null and char_length(trimmed) > 40 then
    raise exception 'set_display_name: name must be 40 characters or fewer';
  end if;

  update public.users set display_name = trimmed where id = auth.uid();
end;
$$;

revoke execute on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;
