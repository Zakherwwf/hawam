-- Progress v3: one photo per observation, and an effort leaderboard.
--
-- 1. The app now asks for a single photo per observation (the three-angle
--    guided capture was the main reason people skipped photos). XP for photos
--    used to count left/right flank shots only, so a single photo earned
--    nothing. Now the first photo of each observation earns the photo weight,
--    whatever its angle; extra photos of the same animal earn nothing more.
-- 2. CLAUDE.md 2.3: leaderboards rank by kilometres surveyed and complete
--    checklists, never by animals, and flagged sessions do not count. The old
--    `leaderboard` view ranked by XP (which includes counts) and included
--    flagged sessions; `effort_leaderboard` replaces it for the app.
-- 3. user_stats gains complete checklists and zero-animal checklists, the
--    two numbers the progress screen celebrates.
--
-- New columns are appended so `create or replace view` keeps the old ones.

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
    coalesce(sum(s.duration_min), 0)::double precision as minutes_surveyed,
    count(*) filter (
      where s.protocol <> 'incidental' and s.complete_session and s.end_time is not null
    )::integer as complete_checklist_count,
    count(*) filter (
      where s.protocol <> 'incidental' and s.complete_session and s.end_time is not null
        and not exists (select 1 from public.observations o where o.session_id = s.id)
    )::integer as zero_checklist_count
  from public.sessions s
  group by s.observer_id
),
photo_totals as (
  select
    s.observer_id,
    count(*)::integer as photo_count,
    count(*) filter (where p.angle in ('left_flank', 'right_flank'))::integer as flank_photo_count,
    count(distinct p.observation_id)::integer as photographed_observation_count
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
    + coalesce(p.photographed_observation_count, 0) * (select per_flank_photo from public.xp_weights())
    + coalesce(o.cell_count, 0) * (select per_new_cell from public.xp_weights())
  )::integer as xp,
  coalesce(se.complete_checklist_count, 0) as complete_checklist_count,
  coalesce(se.zero_checklist_count, 0) as zero_checklist_count,
  coalesce(p.photographed_observation_count, 0) as photographed_observation_count
from public.users u
left join observation_totals o on o.observer_id = u.id
left join session_totals se on se.observer_id = u.id
left join photo_totals p on p.observer_id = u.id;

comment on view public.user_stats is
  'Contribution totals and XP per user. The same numbers for every viewer. '
  'Photo XP counts one photo per observation.';

-- Effort only, flagged sessions excluded. security_invoker off for the same
-- reason as user_stats: everyone must see the same ranking.
create or replace view public.effort_leaderboard
with (security_invoker = off) as
with effort as (
  select
    s.observer_id as user_id,
    coalesce(sum(s.distance_km), 0)::double precision as distance_km,
    count(*) filter (
      where s.protocol <> 'incidental' and s.complete_session and s.end_time is not null
    )::integer as complete_checklist_count,
    max(s.start_time) as last_survey_at
  from public.sessions s
  where s.validation_status is distinct from 'flagged'
    and s.deleted_at is null
  group by s.observer_id
)
select
  e.user_id,
  coalesce(u.display_name, 'Anonymous') as display_name,
  e.distance_km,
  e.complete_checklist_count,
  e.last_survey_at
from effort e
join public.users u on u.id = e.user_id
where e.distance_km > 0 or e.complete_checklist_count > 0;

comment on view public.effort_leaderboard is
  'Ranking inputs by effort only (km surveyed, complete checklists). Flagged '
  'sessions excluded. Never ranks by animals counted.';

revoke all on public.effort_leaderboard from anon, authenticated;
grant select on public.effort_leaderboard to authenticated;
revoke all on public.user_stats from anon;
