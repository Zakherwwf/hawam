-- Fix: uploads failed with "permission denied for function
-- validate_session_record".
--
-- The session check is a deferred trigger, so it fires at commit, after
-- submit_survey_bundle (security definer) has returned. By then it runs as the
-- volunteer's own role, which rightly cannot call validate_session_record.
-- The trigger function now runs with its owner's rights, like the check it
-- calls. It takes no input except the row just inserted and is not callable
-- directly, so this grants volunteers nothing new.

create or replace function public.validate_session_at_commit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.validate_session_record(new.id);
  return null;
end;
$$;

revoke all on function public.validate_session_at_commit() from public, anon, authenticated;
