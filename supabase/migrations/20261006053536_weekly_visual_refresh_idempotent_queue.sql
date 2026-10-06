begin;

-- Visual refresh story_image jobs use the same GitHub worker and attempt ledger.
-- A repeated request key must preserve a terminal job, just like the general
-- weekly generation queue.
create or replace function public.queue_weekly_visual_refresh_prompt_job(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_job_type text,
  p_revision_item_id uuid default null,
  p_idempotency_key text default null
)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision public.weekly_digest_revisions;
  v_job public.weekly_digest_generation_jobs;
  v_slot_key text;
  v_input jsonb;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
begin
  if not public.has_social_role(array['owner']) or not public.has_social_aal2() then
    raise exception 'An AAL2 owner session is required for a visual refresh' using errcode = '42501';
  end if;
  if p_job_type not in ('cover', 'story_image') then
    raise exception 'Visual refresh queues only cover and story prompt jobs';
  end if;
  if v_key is null or char_length(v_key) not between 8 and 250 then
    raise exception 'Idempotency key must contain 8 to 250 characters';
  end if;

  select digest.* into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
    and digest.active_revision_id = p_revision_id
  for update;
  if v_digest.id is null
     or v_digest.status <> 'published'
     or v_digest.published_revision_id is null then
    raise exception 'An active private visual-refresh revision of this published digest is required';
  end if;

  select revision.* into v_revision
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id
  for update;
  if v_revision.id is null
     or v_revision.visual_refresh_source_revision_id is distinct from v_digest.published_revision_id then
    raise exception 'An active private visual-refresh revision of this published digest is required';
  end if;

  if p_job_type = 'cover' then
    if p_revision_item_id is not null then
      raise exception 'Cover prompt jobs cannot target a story item';
    end if;
    v_slot_key := 'cover-prompt:neutral';
  else
    if p_revision_item_id is null or not exists (
      select 1 from public.weekly_digest_revision_items item
      where item.id = p_revision_item_id
        and item.revision_id = p_revision_id
    ) then
      raise exception 'Story prompt jobs require a story from the active visual-refresh revision';
    end if;
    v_slot_key := 'story-prompt-set:' || p_revision_item_id::text;
  end if;

  v_input := jsonb_build_object(
    'prompt_only', true,
    'visual_refresh', true,
    'visual_refresh_source_revision_id', v_digest.published_revision_id,
    'visual_refresh_revision_hash', v_revision.content_hash,
    'locale', 'neutral',
    'slot_key', v_slot_key,
    'revision_item_id', p_revision_item_id
  );

  select job.* into v_job
  from public.weekly_digest_generation_jobs job
  where job.idempotency_key = v_key
  for update;
  if v_job.id is not null then
    if v_job.weekly_digest_id is distinct from p_weekly_digest_id
       or v_job.revision_id is distinct from p_revision_id
       or v_job.job_type is distinct from p_job_type
       or v_job.input is distinct from v_input then
      raise exception 'Idempotency key is already used by a different generation job';
    end if;
    return v_job;
  end if;

  insert into public.weekly_digest_generation_jobs (
    weekly_digest_id, revision_id, job_type, idempotency_key,
    status, input, created_by, status_reason
  ) values (
    p_weekly_digest_id, p_revision_id, p_job_type, v_key,
    'queued', v_input, auth.uid(), 'Queued prompt-only visual refresh'
  ) returning * into v_job;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_job.weekly_digest_id, v_job.revision_id, auth.uid(), 'generation_queued',
    jsonb_build_object(
      'job_id', v_job.id,
      'job_type', v_job.job_type,
      'status', v_job.status,
      'idempotency_key', v_job.idempotency_key,
      'visual_refresh', true,
      'prompt_only', true,
      'visual_refresh_revision_hash', v_revision.content_hash
    )
  );
  return v_job;
end;
$function$;

revoke all on function public.queue_weekly_visual_refresh_prompt_job(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.queue_weekly_visual_refresh_prompt_job(
  uuid, uuid, text, uuid, text
) to authenticated, service_role;

commit;
