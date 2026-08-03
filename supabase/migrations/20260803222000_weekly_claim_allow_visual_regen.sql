-- Allow on-demand Visuals regenerations to be claimed without waiting for
-- article/video_script owner approval. The previous gate left admin
-- "Regenerate" jobs stuck in `queued` forever when deps were only in_review
-- (or when regenerating an existing image on a paused edition).
--
-- story_image: claim when the three editorial deps are approved (pipeline),
--   OR when a current ready story_image already exists for the target item
--   (admin regen of an existing illustration).
-- pdf: claim when cover + locale article are ready; approval remains a
--   release/preflight concern, not a generation blocker for regenerating PDFs.

begin;

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
        'cover', 'story_image', 'social_asset', 'video_manifest',
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
            select count(*) = 3
            from public.weekly_digest_artifacts artifact
            where artifact.revision_id = job.revision_id
              and artifact.is_current
              and artifact.review_status = 'approved'
              and artifact.artifact_type in ('article', 'video_script')
              and artifact.slot_key in ('article:en', 'article:uk', 'video-script:en')
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
        when 'video_manifest' then 5
        when 'pdf' then 6
        when 'social_asset' then 7
        else 8
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

revoke all on function public.claim_weekly_digest_generation_jobs(
  text[], integer, interval
) from public, anon, authenticated;
grant execute on function public.claim_weekly_digest_generation_jobs(
  text[], integer, interval
) to service_role;

commit;
