begin;

-- A manual retry is a child of one terminal job. Keep at most one live child
-- even when the RPC is invoked concurrently or a composite result is expanded
-- in SQL (which may evaluate a volatile function once per output column).
create temporary table weekly_manual_retry_duplicates
on commit drop
as
with ranked as (
  select
    job.id as job_id,
    job.current_attempt_id as attempt_id,
    first_value(job.id) over (
      partition by job.retry_of_job_id
      order by
        case job.status
          when 'running' then 0
          when 'dispatching' then 1
          when 'retry_scheduled' then 2
          when 'queued' then 3
          when 'waiting' then 4
          else 5
        end,
        job.heartbeat_at desc nulls last,
        job.created_at desc,
        job.id desc
    ) as canonical_job_id,
    row_number() over (
      partition by job.retry_of_job_id
      order by
        case job.status
          when 'running' then 0
          when 'dispatching' then 1
          when 'retry_scheduled' then 2
          when 'queued' then 3
          when 'waiting' then 4
          else 5
        end,
        job.heartbeat_at desc nulls last,
        job.created_at desc,
        job.id desc
    ) as retry_rank
  from public.weekly_digest_generation_jobs job
  where job.retry_of_job_id is not null
    and job.status in ('waiting', 'queued', 'dispatching', 'running', 'retry_scheduled')
)
select job_id, attempt_id, canonical_job_id
from ranked
where retry_rank > 1;

update public.weekly_digest_generation_attempts attempt
set status = 'cancelled',
    finished_at = coalesce(attempt.finished_at, now()),
    heartbeat_at = now(),
    error_code = 'duplicate_manual_retry',
    error_message = 'Duplicate manual retry fenced by idempotency migration',
    outcome = coalesce(attempt.outcome, '{}'::jsonb) || jsonb_build_object(
      'failure_code', 'duplicate_manual_retry',
      'canonical_retry_job_id', duplicate.canonical_job_id
    )
from weekly_manual_retry_duplicates duplicate
where attempt.id = duplicate.attempt_id
  and attempt.status = 'running';

update public.weekly_digest_generation_jobs job
set status = 'cancelled',
    failure_code = 'duplicate_manual_retry',
    status_reason = 'Duplicate manual retry fenced; canonical retry ' || duplicate.canonical_job_id::text || ' retained',
    last_error = null,
    finished_at = coalesce(job.finished_at, now()),
    heartbeat_at = case when job.current_attempt_id is null then job.heartbeat_at else now() end,
    next_attempt_at = null,
    updated_at = now()
from weekly_manual_retry_duplicates duplicate
where job.id = duplicate.job_id;

insert into public.weekly_digest_generation_events (
  job_id, attempt_id, event_type, level, message, metadata
)
select
  duplicate.job_id,
  duplicate.attempt_id,
  'job_cancelled',
  'warning',
  'Duplicate manual retry fenced by idempotency migration',
  jsonb_build_object(
    'failure_code', 'duplicate_manual_retry',
    'canonical_retry_job_id', duplicate.canonical_job_id
  )
from weekly_manual_retry_duplicates duplicate;

create unique index if not exists weekly_digest_generation_jobs_active_retry_source_unique
  on public.weekly_digest_generation_jobs (retry_of_job_id)
  where retry_of_job_id is not null
    and status in ('waiting', 'queued', 'dispatching', 'running', 'retry_scheduled');

create or replace function public.retry_weekly_digest_generation_job(p_job_id uuid)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_source public.weekly_digest_generation_jobs;
  v_existing public.weekly_digest_generation_jobs;
  v_retry public.weekly_digest_generation_jobs;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;

  select * into v_source
  from public.weekly_digest_generation_jobs
  where id = p_job_id
    and status in ('failed', 'cancelled')
  for update;

  if v_source.id is null then
    raise exception 'Only a terminal generation job can be retried';
  end if;

  -- The source-row lock serializes all normal RPC callers. Reuse a live or
  -- already successful child so a repeated click/call remains idempotent.
  select * into v_existing
  from public.weekly_digest_generation_jobs child
  where child.retry_of_job_id = v_source.id
    and child.status in (
      'waiting', 'queued', 'dispatching', 'running', 'retry_scheduled', 'succeeded'
    )
  order by
    case when child.status = 'succeeded' then 0 else 1 end,
    child.created_at desc,
    child.id desc
  limit 1
  for update;

  if v_existing.id is not null then
    return v_existing;
  end if;

  begin
    insert into public.weekly_digest_generation_jobs (
      weekly_digest_id, revision_id, artifact_id, job_type, idempotency_key, status,
      input, execution_backend, max_attempts, retry_of_job_id, created_by, status_reason
    ) values (
      v_source.weekly_digest_id, v_source.revision_id, v_source.artifact_id, v_source.job_type,
      'manual-retry:' || gen_random_uuid()::text, 'queued', v_source.input,
      public.weekly_generation_backend(v_source.job_type), v_source.max_attempts, v_source.id,
      auth.uid(), 'Manual retry of terminal job ' || v_source.id::text
    ) returning * into v_retry;
  exception
    when unique_violation then
      -- Backstop direct concurrent writers that do not take the source lock.
      select * into v_retry
      from public.weekly_digest_generation_jobs child
      where child.retry_of_job_id = v_source.id
        and child.status in ('waiting', 'queued', 'dispatching', 'running', 'retry_scheduled')
      order by child.created_at desc, child.id desc
      limit 1;
      if v_retry.id is null then
        raise;
      end if;
  end;

  insert into public.weekly_digest_generation_events (job_id, event_type, message, metadata)
  values (
    v_retry.id, 'manual_retry_created', 'Created from a terminal job without erasing history',
    jsonb_build_object('retry_of_job_id', v_source.id)
  );
  return v_retry;
end;
$function$;

revoke all on function public.retry_weekly_digest_generation_job(uuid)
  from public, anon, authenticated;
grant execute on function public.retry_weekly_digest_generation_job(uuid)
  to authenticated, service_role;

commit;
