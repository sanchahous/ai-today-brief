begin;

-- A stable idempotency key identifies one logical job. Repeating the enqueue
-- must never reopen a terminal job or reset its attempt counter: attempts are
-- also stored in an immutable ledger with a unique (job_id, attempt_number).
create or replace function public.queue_weekly_digest_generation_job(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_job_type text,
  p_idempotency_key text,
  p_input jsonb default '{}'::jsonb,
  p_artifact_id uuid default null
)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_job public.weekly_digest_generation_jobs;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if p_job_type not in (
    'research_pack', 'editorial_master', 'social_copy', 'article', 'pdf',
    'cover', 'story_image', 'social_asset', 'video_script',
    'video_manifest', 'artifact_promotion'
  ) then
    raise exception 'Unsupported weekly digest generation job type';
  end if;
  if char_length(v_key) not between 8 and 250 then
    raise exception 'Idempotency key must contain 8 to 250 characters';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Generation input must be a JSON object';
  end if;

  select digest.* into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.active_revision_id is distinct from p_revision_id then
    raise exception 'Generation jobs may target only the active revision';
  end if;
  if v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'Weekly digest is not editable';
  end if;
  if p_artifact_id is not null and not exists (
    select 1 from public.weekly_digest_artifacts artifact
    where artifact.id = p_artifact_id
      and artifact.weekly_digest_id = p_weekly_digest_id
      and artifact.revision_id = p_revision_id
      and artifact.is_current
  ) then
    raise exception 'Current artifact does not belong to the requested revision';
  end if;

  select job.* into v_job
  from public.weekly_digest_generation_jobs job
  where job.idempotency_key = v_key
  for update;
  if v_job.id is not null then
    if v_job.weekly_digest_id is distinct from p_weekly_digest_id
       or v_job.revision_id is distinct from p_revision_id
       or v_job.job_type is distinct from p_job_type then
      raise exception 'Idempotency key is already used by a different generation job';
    end if;
    return v_job;
  end if;

  insert into public.weekly_digest_generation_jobs (
    weekly_digest_id, revision_id, artifact_id, job_type,
    idempotency_key, status, input, created_by
  ) values (
    p_weekly_digest_id, p_revision_id, p_artifact_id, p_job_type,
    v_key, 'queued', p_input, auth.uid()
  ) returning * into v_job;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_job.weekly_digest_id, v_job.revision_id, auth.uid(), 'generation_queued',
    jsonb_build_object(
      'job_id', v_job.id,
      'job_type', v_job.job_type,
      'status', v_job.status,
      'idempotency_key', v_job.idempotency_key
    )
  );
  return v_job;
end;
$function$;

revoke all on function public.queue_weekly_digest_generation_job(
  uuid, uuid, text, text, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.queue_weekly_digest_generation_job(
  uuid, uuid, text, text, jsonb, uuid
) to authenticated, service_role;

-- Recover rows whose counter was reset after their ledger reached the limit.
-- Keep all attempt records and checkpoints for an explicit linked retry.
with exhausted as (
  select attempt.job_id, max(attempt.attempt_number) as ledger_attempts,
         max(attempt.finished_at) as last_finished_at
  from public.weekly_digest_generation_attempts attempt
  group by attempt.job_id
)
update public.weekly_digest_generation_jobs job
set status = 'failed',
    attempts = exhausted.ledger_attempts,
    dispatch_token = null,
    next_attempt_at = null,
    locked_at = null,
    finished_at = coalesce(exhausted.last_finished_at, now()),
    status_reason = 'Retry limit reached; use a linked manual retry',
    last_error = coalesce(job.last_error, 'Attempt ledger exhausted; stale dispatches stopped')
from exhausted
where job.id = exhausted.job_id
  and job.execution_backend = 'github_actions'
  and job.status in ('queued', 'dispatching', 'retry_scheduled')
  and job.attempts < exhausted.ledger_attempts
  and exhausted.ledger_attempts >= job.max_attempts;

commit;
