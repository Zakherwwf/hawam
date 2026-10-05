-- Personal contribution figures for the app's home screen.
--
-- Aggregated in the database so a volunteer with a long history does not have
-- to download every row to count them -- PostgREST caps a response at 1000
-- rows anyway, which would silently understate a prolific surveyor.
--
-- SECURITY INVOKER (the default): row-level security still applies, so this
-- can only ever count the caller's own records. The explicit auth.uid()
-- filters say the same thing twice on purpose.

create or replace function public.my_contribution()
returns table (
  session_count integer,
  observation_count integer,
  animal_count integer,
  distance_km double precision
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.sessions s
      where s.observer_id = auth.uid())::integer,
    (select count(*) from public.observations o
       join public.sessions s on s.id = o.session_id
      where s.observer_id = auth.uid())::integer,
    -- group_size, not row count: one record can be a group of six dogs.
    (select coalesce(sum(o.group_size), 0) from public.observations o
       join public.sessions s on s.id = o.session_id
      where s.observer_id = auth.uid())::integer,
    (select coalesce(sum(s.distance_km), 0) from public.sessions s
      where s.observer_id = auth.uid());
$$;

comment on function public.my_contribution() is
  'The calling volunteer''s own totals. Counts only; no coordinates.';

revoke execute on function public.my_contribution() from public, anon;
grant execute on function public.my_contribution() to authenticated;
