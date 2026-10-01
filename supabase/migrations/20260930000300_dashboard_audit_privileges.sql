-- Research portal support and a privilege tidy-up.
--
-- 1. log_export: export_audit is append-only and had no insert path, so the
--    portal could not record exports. Researchers call this; the row carries
--    their id and role from the session, never from the payload.
-- 2. Signed-in users held write grants on read-only views (user_stats,
--    leaderboard, observations_map) and TRUNCATE / TRIGGER / REFERENCES on
--    tables, from Supabase's default privileges. None were reachable through
--    the API or usable against these views, but least privilege says remove
--    them.

create or replace function public.log_export(
  p_type text,
  p_rows integer,
  p_precise boolean,
  p_filters jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_researcher() then
    raise exception 'Only researchers can export data' using errcode = '42501';
  end if;
  if p_type is null or char_length(p_type) > 60 then
    raise exception 'Invalid export type' using errcode = '22023';
  end if;
  insert into public.export_audit (actor_id, actor_role, export_type, includes_precise_coordinates, row_count, filters)
  values (auth.uid(), public.current_app_role(), p_type, coalesce(p_precise, false), p_rows, coalesce(p_filters, '{}'::jsonb));
end;
$$;

revoke all on function public.log_export(text, integer, boolean, jsonb) from public, anon;
grant execute on function public.log_export(text, integer, boolean, jsonb) to authenticated;

revoke insert, update, delete, truncate, trigger, references
  on public.user_stats, public.leaderboard, public.observations_map
  from authenticated;

revoke truncate, trigger, references on all tables in schema public from authenticated;
