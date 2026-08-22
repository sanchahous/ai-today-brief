begin;

-- Bug: a manual "Create linked retry" of a failed editorial_master job copied
-- v_source.input verbatim, including resume_from_job_id. When the source job
-- itself failed because its resume checkpoint no longer matched the current
-- research packs / retry guidance ("Master resume source has no saved state
-- for the current research packs -- start a fresh master instead"), the
-- retry inherited the exact same resume_from_job_id and failed identically
-- at the `prepare` step before any provider call -- every subsequent manual
-- retry just recreated the same terminal failure. Live production repro
-- 2026-08-22 on weekly_digest_id 71af784b-3c89-47f8-bc38-e3eae4def2a7: job
-- c471563f (resume of 411aba45) failed with failure_code=unknown, then its
-- manual retry 299e2c6c copied the same resume_from_job_id and failed the
-- same way 3 minutes later. `resume_from_job_id` is only ever set by
-- resumeWeeklyMasterFromCheckpointAction (src/app/admin/(cms)/weekly/actions.ts)
-- for editorial_master; a job that reached `failed` with no saved segments of
-- its own (the only case "Create linked retry" is offered for, per
-- src/components/admin/weekly-generation-jobs-live.tsx) never validly resumes
-- from that pointer again, so a manual retry must drop it and let the worker
-- start a fresh master run instead.
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
      'manual-retry:' || gen_random_uuid()::text, 'queued',
      -- Drop a stale resume pointer instead of copying it forward: the only
      -- way this job carries one is a prior resume attempt that already
      -- proved the checkpoint unusable for the current plan, and copying it
      -- again reproduces the identical terminal failure (see comment above).
      v_source.input - 'resume_from_job_id',
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

commit;
