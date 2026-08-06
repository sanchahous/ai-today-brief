begin;

-- video_script becomes its own generation job (PR6, editorial quality
-- overhaul): it used to be written synchronously inside editorial_master's
-- single mega-call, which is the documented root cause of the "silent
-- slideshow" (durationSeconds invented to satisfy a 360-480s total while
-- narration text stayed far too short -- see
-- wiki/pipeline/video-boundary.md). It was always a valid *artifact* type
-- (see weekly_digest_artifacts_artifact_type_check, unchanged here) but
-- never a *job* type until now.

alter table public.weekly_digest_generation_jobs
  drop constraint if exists weekly_digest_generation_jobs_job_type_check,
  add constraint weekly_digest_generation_jobs_job_type_check check (job_type in (
    'research_pack',
    'editorial_master',
    'social_copy',
    'article',
    'pdf',
    'cover',
    'story_image',
    'social_asset',
    'video_script',
    'video_manifest',
    'artifact_promotion'
  ));

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
    'video_script',
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

-- video_script claims once the bilingual article is approved (same gate
-- story_image's primary branch and social_copy already use); video_manifest
-- keeps its existing gate on video_script being approved.
create or replace function public.claim_weekly_digest_generation_jobs(
  p_job_types text[] default null,
  p_limit integer default 5,
  p_stale_after interval default interval '15 minutes'
)
returns setof public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
  v_claimed public.weekly_digest_generation_jobs;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_job_types is not null and (
    cardinality(p_job_types) = 0
    or exists (
      select 1 from unnest(p_job_types) as requested(job_type)
      where requested.job_type not in (
        'research_pack', 'editorial_master', 'social_copy', 'article', 'pdf',
        'cover', 'story_image', 'social_asset', 'video_script', 'video_manifest',
        'artifact_promotion'
      )
    )
  ) then
    raise exception 'Unsupported weekly digest generation job type filter';
  end if;
  if p_stale_after <= interval '0 seconds' or p_stale_after > interval '24 hours' then
    raise exception 'Stale timeout must be greater than zero and at most 24 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest on digest.id = job.weekly_digest_id
    where job.attempts < 5
      and digest.active_revision_id = job.revision_id
      and digest.status not in ('publishing', 'published', 'cancelled')
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (
        job.status in ('queued', 'failed')
        or (job.status = 'running' and job.locked_at < now() - p_stale_after)
      )
      and case job.job_type
        when 'editorial_master' then (
          select count(*) = 3
          from public.weekly_digest_artifacts artifact
          join public.weekly_digest_revision_items item
            on item.id = artifact.revision_item_id
          where artifact.revision_id = job.revision_id
            and item.rank <= 3
            and artifact.artifact_type = 'research_pack'
            and artifact.is_current
            and artifact.generation_status = 'ready'
            and artifact.review_status = 'approved'
        )
        when 'story_image' then (
          (
            select count(*) = 2
            from public.weekly_digest_artifacts artifact
            where artifact.revision_id = job.revision_id
              and artifact.is_current
              and artifact.review_status = 'approved'
              and artifact.artifact_type = 'article'
              and artifact.slot_key in ('article:en', 'article:uk')
          )
          or (
            nullif(btrim(coalesce(job.input ->> 'revision_item_id', '')), '') is not null
            and exists (
              select 1
              from public.weekly_digest_artifacts artifact
              where artifact.revision_id = job.revision_id
                and artifact.revision_item_id = nullif(btrim(job.input ->> 'revision_item_id'), '')::uuid
                and artifact.artifact_type = 'story_image'
                and artifact.is_current
                and artifact.generation_status = 'ready'
            )
          )
        )
        when 'cover' then not exists (
          select 1
          from public.weekly_digest_revision_items item
          where item.revision_id = job.revision_id
            and not exists (
              select 1 from public.weekly_digest_artifacts artifact
              where artifact.revision_item_id = item.id
                and artifact.artifact_type = 'story_image'
                and artifact.is_current
                and artifact.generation_status = 'ready'
            )
        )
        when 'pdf' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'cover'
            and artifact.is_current
            and artifact.generation_status = 'ready'
        ) and exists (
          select 1 from public.weekly_digest_artifacts article
          where article.revision_id = job.revision_id
            and article.artifact_type = 'article'
            and article.locale = coalesce(nullif(job.input ->> 'locale', ''), 'en')
            and article.is_current
            and article.generation_status = 'ready'
        )
        when 'social_copy' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'cover'
            and artifact.is_current
            and artifact.generation_status = 'ready'
        ) and (
          select count(*) = 2 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'article'
            and artifact.is_current
            and artifact.review_status = 'approved'
        )
        when 'video_script' then (
          select count(*) = 2 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'article'
            and artifact.is_current
            and artifact.review_status = 'approved'
        )
        when 'video_manifest' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'video_script'
            and artifact.is_current
            and artifact.review_status = 'approved'
        ) and (
          select count(*) = 3
          from public.weekly_digest_artifacts artifact
          join public.weekly_digest_revision_items item
            on item.id = artifact.revision_item_id
          where artifact.revision_id = job.revision_id
            and item.rank <= 3
            and artifact.artifact_type = 'story_image'
            and artifact.is_current
            and artifact.generation_status = 'ready'
            and artifact.review_status = 'approved'
        ) and exists (
          select 1 from public.weekly_digest_artifacts cover
          where cover.revision_id = job.revision_id
            and cover.artifact_type = 'cover'
            and cover.is_current
            and cover.generation_status = 'ready'
        )
        else true
      end
    order by
      case job.status when 'queued' then 0 when 'failed' then 1 else 2 end,
      case job.job_type
        when 'research_pack' then 0
        when 'editorial_master' then 1
        when 'story_image' then 2
        when 'cover' then 3
        when 'social_copy' then 4
        when 'video_script' then 5
        when 'video_manifest' then 6
        when 'pdf' then 7
        when 'social_asset' then 8
        else 9
      end,
      job.created_at,
      job.id
    for update of job skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    update public.weekly_digest_generation_jobs
    set status = 'running', attempts = attempts + 1, locked_at = now(),
        started_at = coalesce(started_at, now()), finished_at = null,
        last_error = null
    where id = v_job.id
    returning * into v_claimed;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_claimed.weekly_digest_id, v_claimed.revision_id, 'generation_started',
      jsonb_build_object(
        'job_id', v_claimed.id,
        'job_type', v_claimed.job_type,
        'attempt', v_claimed.attempts
      )
    );
    return next v_claimed;
  end loop;
end;
$function$;

commit;
