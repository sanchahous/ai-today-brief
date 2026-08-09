begin;

-- The original control-plane migration qualified the target column in UPDATE
-- RETURNING with an alias. PostgreSQL does not expose that alias there, so
-- the dispatcher failed before it could create a GitHub Actions workflow run.
create or replace function public.prepare_weekly_digest_github_dispatch(p_job_id uuid default null)
returns table (job_id uuid, weekly_digest_id uuid, dispatch_token uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
  v_dispatch_token uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  select * into v_job
  from public.weekly_digest_generation_jobs
  where execution_backend = 'github_actions'
    and status in ('queued', 'retry_scheduled')
    and attempts < max_attempts
    and coalesce(next_attempt_at, '-infinity'::timestamptz) <= now()
    and (p_job_id is null or id = p_job_id)
  order by created_at
  for update skip locked;

  if v_job.id is null then return; end if;

  if not public.weekly_generation_job_ready(v_job) then
    update public.weekly_digest_generation_jobs job
    set status = 'waiting',
        status_reason = public.weekly_generation_waiting_reason(v_job),
        next_attempt_at = null
    where job.id = v_job.id
      and job.status in ('queued', 'retry_scheduled');
    insert into public.weekly_digest_generation_events (job_id, event_type, step, message, metadata)
    values (
      v_job.id, 'dependency_waiting', 'prepare',
      public.weekly_generation_waiting_reason(v_job), jsonb_build_object('state', 'waiting')
    );
    return;
  end if;

  update public.weekly_digest_generation_jobs
  set status = 'dispatching',
      dispatch_token = gen_random_uuid(),
      status_reason = 'Dispatching a dedicated GitHub Actions worker',
      next_attempt_at = null
  where id = v_job.id
  returning dispatch_token into v_dispatch_token;

  job_id := v_job.id;
  weekly_digest_id := v_job.weekly_digest_id;
  dispatch_token := v_dispatch_token;

  insert into public.weekly_digest_generation_events (job_id, event_type, step, message, metadata)
  values (
    v_job.id, 'github_dispatch_requested', 'prepare', 'GitHub Actions worker requested',
    jsonb_build_object('attempt', v_job.attempts + 1, 'max_attempts', v_job.max_attempts)
  );
  return next;
end;
$function$;

revoke all on function public.prepare_weekly_digest_github_dispatch(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_weekly_digest_github_dispatch(uuid)
  to service_role;

commit;
