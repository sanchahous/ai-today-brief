begin;

-- The v2 job constraint accepts the Content Studio stages, but the durable
-- queue RPC also maintains its own allowlist. Keep both gates aligned so the
-- orchestrator can enqueue the new stages without widening caller access.
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
    'research_pack',
    'editorial_master',
    'social_copy',
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

revoke all on function public.queue_weekly_digest_generation_job(
  uuid, uuid, text, text, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.queue_weekly_digest_generation_job(
  uuid, uuid, text, text, jsonb, uuid
) to authenticated, service_role;

commit;
