begin;

-- The TABLE return fields (id, attempts, input) are PL/pgSQL variables too.
-- Prefer columns inside SQL statements so the fenced claim cannot fail before
-- it creates an attempt.
create or replace function public.claim_weekly_digest_generation_jobs_v2(
  p_backend text,
  p_job_types text[] default null,
  p_limit integer default 1,
  p_job_id uuid default null,
  p_dispatch_token uuid default null,
  p_external_run_id text default null,
  p_external_run_url text default null,
  p_deadline_seconds integer default null
)
returns table (
  id uuid,
  weekly_digest_id uuid,
  revision_id uuid,
  job_type text,
  attempts integer,
  input jsonb,
  execution_backend text,
  attempt_id uuid,
  lease_token uuid
)
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
declare
  v_job public.weekly_digest_generation_jobs;
  v_attempt public.weekly_digest_generation_attempts;
  v_deadline_seconds integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_backend not in ('vercel', 'github_actions') then
    raise exception 'Unsupported generation backend';
  end if;
  if p_job_types is not null and cardinality(p_job_types) = 0 then
    raise exception 'Job type filter cannot be empty';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'Claim limit must be between 1 and 20';
  end if;
  if p_dispatch_token is not null and p_backend <> 'github_actions' then
    raise exception 'Dispatch token is only valid for GitHub Actions';
  end if;

  v_deadline_seconds := case
    when p_deadline_seconds is null then case when p_backend = 'vercel' then 240 else 7200 end
    else p_deadline_seconds
  end;
  if v_deadline_seconds < 15 or v_deadline_seconds > 43200 then
    raise exception 'Deadline must be between 15 seconds and 12 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest on digest.id = job.weekly_digest_id
    where job.execution_backend = p_backend
      and job.attempts < job.max_attempts
      and digest.active_revision_id = job.revision_id
      and digest.status not in ('publishing', 'published', 'cancelled')
      and public.weekly_generation_job_ready(job)
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (p_job_id is null or job.id = p_job_id)
      and (
        (p_backend = 'github_actions' and job.status = 'dispatching'
          and job.dispatch_token is not distinct from p_dispatch_token)
        or (p_backend = 'vercel' and job.status in ('queued', 'retry_scheduled')
          and coalesce(job.next_attempt_at, '-infinity'::timestamptz) <= now())
      )
    order by job.created_at
    for update of job skip locked
    limit p_limit
  loop
    insert into public.weekly_digest_generation_attempts (
      job_id, attempt_number, backend, github_run_id, external_run_url, deadline_at
    ) values (
      v_job.id,
      v_job.attempts + 1,
      p_backend,
      nullif(btrim(coalesce(p_external_run_id, '')), ''),
      nullif(btrim(coalesce(p_external_run_url, '')), ''),
      now() + make_interval(secs => v_deadline_seconds)
    ) returning * into v_attempt;

    update public.weekly_digest_generation_jobs
    set status = 'running',
        attempts = attempts + 1,
        current_attempt_id = v_attempt.id,
        current_step = 'prepare',
        progress_current = 0,
        progress_total = 100,
        progress_unit = 'percent',
        heartbeat_at = now(),
        locked_at = now(),
        started_at = coalesce(started_at, now()),
        finished_at = null,
        next_attempt_at = null,
        failure_code = null,
        status_reason = case when p_backend = 'github_actions' then 'GitHub Actions worker started' else 'Vercel worker started' end,
        last_error = null
    where id = v_job.id
    returning * into v_job;

    insert into public.weekly_digest_generation_events (
      job_id, attempt_id, event_type, step, progress_current, progress_total, metadata
    ) values (
      v_job.id, v_attempt.id, 'attempt_started', 'prepare', 0, 100,
      jsonb_build_object(
        'attempt', v_job.attempts,
        'max_attempts', v_job.max_attempts,
        'backend', p_backend,
        'deadline_at', v_attempt.deadline_at,
        'external_run_url', v_attempt.external_run_url
      )
    );

    id := v_job.id;
    weekly_digest_id := v_job.weekly_digest_id;
    revision_id := v_job.revision_id;
    job_type := v_job.job_type;
    attempts := v_job.attempts;
    input := v_job.input;
    execution_backend := v_job.execution_backend;
    attempt_id := v_attempt.id;
    lease_token := v_attempt.lease_token;
    return next;
  end loop;
end;
$function$;

revoke all on function public.claim_weekly_digest_generation_jobs_v2(text, text[], integer, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_weekly_digest_generation_jobs_v2(text, text[], integer, uuid, uuid, text, text, integer)
  to service_role;

commit;
