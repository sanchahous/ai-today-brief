-- Render the source illustrations before dependent deliverables.  Jobs for one
-- revision are commonly enqueued in the same transaction, so created_at alone
-- does not provide a meaningful ordering between images, the cover, and PDFs.
-- This leaves each document/cover job with the fullest possible visual set.

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
      select 1
      from unnest(p_job_types) as requested(job_type)
      where requested.job_type not in (
        'article',
        'pdf',
        'cover',
        'story_image',
        'social_asset',
        'video_manifest',
        'artifact_promotion'
      )
    )
  ) then
    raise exception 'Unsupported weekly digest generation job type filter';
  end if;
  if p_stale_after <= interval '0 seconds'
     or p_stale_after > interval '24 hours' then
    raise exception 'Stale timeout must be greater than zero and at most 24 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest
      on digest.id = job.weekly_digest_id
    where job.attempts < 5
      and digest.active_revision_id = job.revision_id
      and digest.status not in ('publishing', 'published', 'cancelled')
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (
        job.status in ('queued', 'failed')
        or (
          job.status = 'running'
          and job.locked_at < now() - p_stale_after
        )
      )
    order by
      case job.status when 'queued' then 0 when 'failed' then 1 else 2 end,
      case job.job_type
        when 'story_image' then 0
        when 'cover' then 1
        when 'pdf' then 2
        when 'social_asset' then 3
        else 4
      end,
      job.created_at,
      job.id
    for update of job skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    update public.weekly_digest_generation_jobs
    set status = 'running',
        attempts = attempts + 1,
        locked_at = now(),
        started_at = coalesce(started_at, now()),
        finished_at = null,
        last_error = null
    where id = v_job.id
    returning * into v_claimed;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_claimed.weekly_digest_id,
      v_claimed.revision_id,
      'generation_started',
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

grant execute on function public.claim_weekly_digest_generation_jobs(
  text[], integer, interval
) to service_role;
