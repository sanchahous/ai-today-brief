begin;

-- finish_weekly_digest_generation_job previously did `output = p_output`, an
-- unconditional overwrite. editorial_master saves an in-progress checkpoint
-- (checkpointHash/english/ukrainian, see generation-worker.ts
-- saveMasterCheckpoint) directly to this same output column mid-attempt, then
-- generateEditorialMaster's caller calls finishGenerationJob(false, {
-- retryable }, ...) on a quality-gate failure. The overwrite wiped that
-- checkpoint on every failed attempt, so the next retry always regenerated
-- the full English + Ukrainian LLM write instead of reusing it — the
-- opposite of what the checkpoint was built for. Merge instead: keep prior
-- output keys, let p_output's keys win on conflict.
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
      output = coalesce(v_job.output, '{}'::jsonb) || p_output,
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

commit;
