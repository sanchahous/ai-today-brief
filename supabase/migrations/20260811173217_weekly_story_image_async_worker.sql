begin;

-- Semantic illustration v4 performs multiple reasoning, render and vision
-- calls. Production measurements on 2026-08-11 exceeded Vercel's 300-second
-- function ceiling before the first image could be persisted, so story_image
-- now uses the existing fenced long-lived worker.
create or replace function public.weekly_generation_backend(p_job_type text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when p_job_type in ('editorial_master', 'social_copy', 'video_script', 'story_image')
      then 'github_actions'
    else 'vercel'
  end
$function$;

-- Add the job type to the dispatch lease. The application treats this column
-- as optional during rollout, so the old and new Vercel deployments both work
-- on either side of this transaction.
drop function if exists public.prepare_weekly_digest_github_dispatch(uuid);

create function public.prepare_weekly_digest_github_dispatch(p_job_id uuid default null)
returns table (job_id uuid, weekly_digest_id uuid, job_type text, dispatch_token uuid)
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

  select job.* into v_job
  from public.weekly_digest_generation_jobs job
  where job.execution_backend = 'github_actions'
    and job.status in ('queued', 'retry_scheduled')
    and job.attempts < job.max_attempts
    and coalesce(job.next_attempt_at, '-infinity'::timestamptz) <= now()
    and (p_job_id is null or job.id = p_job_id)
  order by job.created_at
  for update of job skip locked;

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

  v_dispatch_token := gen_random_uuid();

  update public.weekly_digest_generation_jobs job
  set status = 'dispatching',
      dispatch_token = v_dispatch_token,
      status_reason = 'Dispatching a dedicated GitHub Actions worker',
      next_attempt_at = null
  where job.id = v_job.id;

  job_id := v_job.id;
  weekly_digest_id := v_job.weekly_digest_id;
  job_type := v_job.job_type;
  dispatch_token := v_dispatch_token;

  insert into public.weekly_digest_generation_events (job_id, event_type, step, message, metadata)
  values (
    v_job.id, 'github_dispatch_requested', 'prepare', 'GitHub Actions worker requested',
    jsonb_build_object(
      'attempt', v_job.attempts + 1,
      'max_attempts', v_job.max_attempts,
      'job_type', v_job.job_type
    )
  );
  return next;
end;
$function$;

revoke all on function public.prepare_weekly_digest_github_dispatch(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_weekly_digest_github_dispatch(uuid)
  to service_role;

-- Preserve a currently running Vercel lease: it may still finish successfully,
-- and changing its attempt would let a stale worker write an artifact. Changing
-- only the logical job backend means the normal reaper will schedule its next
-- attempt on GitHub if Vercel kills it. Incident jobs that already exhausted
-- their attempts receive three fresh durable attempts without rewriting their
-- immutable attempt history.
with migrated as (
  update public.weekly_digest_generation_jobs job
  set execution_backend = 'github_actions',
      max_attempts = least(10, greatest(job.max_attempts, job.attempts + 3))::smallint,
      status = case when job.status = 'failed' then 'queued' else job.status end,
      next_attempt_at = case
        when job.status in ('failed', 'retry_scheduled') then now()
        else job.next_attempt_at
      end,
      finished_at = case when job.status = 'failed' then null else job.finished_at end,
      failure_code = case when job.status = 'failed' then null else job.failure_code end,
      last_error = case when job.status = 'failed' then null else job.last_error end,
      status_reason = case
        when job.status = 'running'
          then 'Current Vercel attempt is draining; any retry will use GitHub Actions'
        when job.status = 'waiting' then job.status_reason
        else 'Queued for a dedicated GitHub Actions story-image worker'
      end
  from public.weekly_digests digest
  where digest.id = job.weekly_digest_id
    and digest.active_revision_id = job.revision_id
    and digest.status not in ('publishing', 'published', 'cancelled')
    and job.job_type = 'story_image'
    and job.execution_backend = 'vercel'
    and (
      job.status in ('waiting', 'queued', 'running', 'retry_scheduled')
      or (
        job.status = 'failed'
        and job.failure_code = 'worker_heartbeat_stale'
        and job.created_at >= timestamptz '2026-08-11 00:00:00+00'
      )
    )
  returning job.id, job.status, job.attempts, job.max_attempts
)
insert into public.weekly_digest_generation_events (
  job_id, event_type, step, message, metadata
)
select
  migrated.id,
  'backend_migrated',
  'prepare',
  case
    when migrated.status = 'running'
      then 'Vercel attempt may finish; recovery attempts moved to GitHub Actions.'
    else 'Story image moved to a dedicated GitHub Actions worker.'
  end,
  jsonb_build_object(
    'backend', 'github_actions',
    'attempts', migrated.attempts,
    'max_attempts', migrated.max_attempts
  )
from migrated;

commit;
