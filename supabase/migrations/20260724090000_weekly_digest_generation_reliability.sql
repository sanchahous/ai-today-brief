begin;

-- The composer runs with the server-only service role. Keep interactive queue
-- authorization for owner/editor sessions, while allowing that trusted backend
-- to assemble the same durable jobs without leaving a half-created edition.
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
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if p_job_type not in (
    'article',
    'pdf',
    'cover',
    'story_image',
    'social_asset',
    'video_manifest',
    'artifact_promotion'
  ) then
    raise exception 'Unsupported weekly digest generation job type';
  end if;
  if char_length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 250 then
    raise exception 'Idempotency key must contain 8 to 250 characters';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Generation input must be a JSON object';
  end if;

  select digest.*
    into v_digest
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
    select 1
    from public.weekly_digest_artifacts artifact
    where artifact.id = p_artifact_id
      and artifact.weekly_digest_id = p_weekly_digest_id
      and artifact.revision_id = p_revision_id
      and artifact.is_current
  ) then
    raise exception 'Current artifact does not belong to the requested revision';
  end if;

  insert into public.weekly_digest_generation_jobs (
    weekly_digest_id,
    revision_id,
    artifact_id,
    job_type,
    idempotency_key,
    status,
    input,
    created_by
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    p_artifact_id,
    p_job_type,
    btrim(p_idempotency_key),
    'queued',
    p_input,
    auth.uid()
  )
  on conflict (idempotency_key) do update
  set status = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then 'queued'
        else public.weekly_digest_generation_jobs.status
      end,
      attempts = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then 0
        else public.weekly_digest_generation_jobs.attempts
      end,
      input = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then excluded.input
        else public.weekly_digest_generation_jobs.input
      end,
      artifact_id = coalesce(
        public.weekly_digest_generation_jobs.artifact_id,
        excluded.artifact_id
      ),
      output = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then '{}'::jsonb
        else public.weekly_digest_generation_jobs.output
      end,
      last_error = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.last_error
      end,
      locked_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.locked_at
      end,
      started_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.started_at
      end,
      finished_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.finished_at
      end
  where public.weekly_digest_generation_jobs.weekly_digest_id = excluded.weekly_digest_id
    and public.weekly_digest_generation_jobs.revision_id = excluded.revision_id
    and public.weekly_digest_generation_jobs.job_type = excluded.job_type
  returning * into v_job;

  if v_job.id is null then
    raise exception 'Idempotency key is already used by a different generation job';
  end if;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_job.weekly_digest_id,
    v_job.revision_id,
    auth.uid(),
    'generation_queued',
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

-- The worker marks deterministic validation/rendering failures terminal. This
-- avoids five identical cron attempts and five alert messages, while transient
-- errors retain the existing bounded retry behaviour.
create or replace function public.finish_weekly_digest_generation_job(
  p_job_id uuid,
  p_succeeded boolean,
  p_output jsonb default '{}'::jsonb,
  p_error text default null,
  p_artifact_id uuid default null
)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
  v_artifact_id uuid;
  v_retryable boolean := true;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'Generation output must be a JSON object';
  end if;
  if p_output ? 'retryable' then
    v_retryable := (p_output ->> 'retryable')::boolean;
  end if;

  select job.*
    into v_job
  from public.weekly_digest_generation_jobs job
  where job.id = p_job_id
    and job.status = 'running'
  for update;
  if v_job.id is null then
    raise exception 'Running weekly digest generation job was not found';
  end if;

  v_artifact_id := coalesce(p_artifact_id, v_job.artifact_id);
  if v_artifact_id is not null and not exists (
    select 1
    from public.weekly_digest_artifacts artifact
    where artifact.id = v_artifact_id
      and artifact.weekly_digest_id = v_job.weekly_digest_id
      and artifact.revision_id = v_job.revision_id
  ) then
    raise exception 'Artifact does not belong to the generation job revision';
  end if;

  update public.weekly_digest_generation_jobs
  set artifact_id = v_artifact_id,
      status = case when p_succeeded then 'succeeded' else 'failed' end,
      attempts = case when p_succeeded or v_retryable then v_job.attempts else 5 end,
      output = p_output,
      last_error = case
        when p_succeeded then null
        else left(coalesce(nullif(btrim(p_error), ''), 'Generation worker failed.'), 2000)
      end,
      locked_at = null,
      finished_at = now()
  where id = v_job.id
  returning * into v_job;

  if v_artifact_id is not null then
    update public.weekly_digest_artifacts
    set generation_status = case when p_succeeded then 'ready' else 'failed' end
    where id = v_artifact_id
      and is_current;
  end if;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, event_type, payload
  ) values (
    v_job.weekly_digest_id,
    v_job.revision_id,
    case when p_succeeded then 'generation_succeeded' else 'generation_failed' end,
    jsonb_build_object(
      'job_id', v_job.id,
      'job_type', v_job.job_type,
      'attempt', v_job.attempts,
      'artifact_id', v_job.artifact_id,
      'output', v_job.output,
      'error', v_job.last_error,
      'retryable', v_retryable
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

commit;
