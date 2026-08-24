begin;

-- A visual refresh is intentionally a private working revision of an already
-- published edition.  It never replaces the published pointer or starts a
-- release; it only provides a safe place to regenerate prompt sets against
-- the current editorial prompt policy.
alter table public.weekly_digest_revisions
  add column if not exists visual_refresh_source_revision_id uuid
    references public.weekly_digest_revisions(id) on delete restrict,
  add constraint weekly_digest_revisions_visual_refresh_source_check
    check (
      visual_refresh_source_revision_id is null
      or visual_refresh_source_revision_id <> id
    );

create index if not exists weekly_digest_revisions_visual_refresh_source_idx
  on public.weekly_digest_revisions (weekly_digest_id, visual_refresh_source_revision_id)
  where visual_refresh_source_revision_id is not null;

comment on column public.weekly_digest_revisions.visual_refresh_source_revision_id is
  'Internal provenance pointer for a private prompt-only visual refresh draft. It must equal the currently published revision of the same digest.';

-- The display-title migration deliberately moved public access to an explicit
-- column grant. This new internal pointer must remain invisible to public
-- callers for the same reason as visual_thesis.
do $$
begin
  if has_column_privilege('anon', 'public.weekly_digest_revisions', 'visual_refresh_source_revision_id', 'SELECT')
     or has_column_privilege('authenticated', 'public.weekly_digest_revisions', 'visual_refresh_source_revision_id', 'SELECT') then
    raise exception 'weekly visual-refresh provenance must remain private';
  end if;
end;
$$;

-- Keep the published lifecycle immutable for every normal path. The only
-- exception is this one private active-pointer move, and only while the
-- dedicated visual-refresh RPC has set its transaction-local capability.
create or replace function public.guard_weekly_digest_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_role text := public.social_admin_role();
  v_visual_refresh_move boolean := false;
begin
  if v_is_service then
    return new;
  end if;
  v_visual_refresh_move :=
    tg_op = 'UPDATE'
    and old.status = 'published'
    and new.status = 'published'
    and current_setting('app.weekly_visual_refresh', true) = 'allowed';
  if v_role not in ('owner', 'editor') then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'in_review') then
      raise exception 'New weekly digests must begin as draft or in review';
    end if;
    if new.published_at is not null
       or new.published_revision_id is not null
       or new.approved_by is not null
       or new.approved_at is not null then
      raise exception 'Approval and publication fields cannot be set directly';
    end if;
    return new;
  end if;

  if new.status in ('publishing', 'published', 'failed')
     and not (new.status = 'published' and v_visual_refresh_move) then
    raise exception 'Only the release worker may set status %', new.status
      using errcode = '42501';
  end if;
  if new.published_revision_id is distinct from old.published_revision_id
     or new.published_at is distinct from old.published_at
     or (
       new.publishing_started_at is distinct from old.publishing_started_at
       and not (
         new.status = 'paused'
         and v_role = 'owner'
         and public.has_social_aal2()
       )
     ) then
    raise exception 'Only the release worker may change publication fields'
      using errcode = '42501';
  end if;
  if v_visual_refresh_move
     and new.active_revision_id is distinct from old.active_revision_id
     and not exists (
       select 1
       from public.weekly_digest_revisions revision
       where revision.id = new.active_revision_id
         and revision.weekly_digest_id = new.id
         and revision.visual_refresh_source_revision_id = old.published_revision_id
     ) then
    raise exception 'Published digests may activate only their own visual-refresh draft'
      using errcode = '42501';
  end if;
  if new.active_revision_id is distinct from old.active_revision_id
     and current_setting('app.weekly_digest_revision_write', true)
       is distinct from 'allowed' then
    raise exception 'Active revision may be changed only by the revision RPC'
      using errcode = '42501';
  end if;
  if new.title_en is distinct from old.title_en
     or new.title_uk is distinct from old.title_uk
     or new.intro_en is distinct from old.intro_en
     or new.intro_uk is distinct from old.intro_uk
     or new.week_start is distinct from old.week_start
     or new.week_end is distinct from old.week_end
     or new.period_model is distinct from old.period_model
     or new.slug is distinct from old.slug then
    raise exception 'Edition content and calendar fields change only through immutable revisions'
      using errcode = '42501';
  end if;
  if new.preflight_override is not null
     and (
       new.preflight_override is distinct from old.preflight_override
       or new.preflight_override_by is distinct from old.preflight_override_by
       or new.preflight_override_at is distinct from old.preflight_override_at
     )
     and current_setting('app.weekly_digest_override', true) is distinct from 'allowed' then
    raise exception 'Preflight overrides may be created only by the approval RPC'
      using errcode = '42501';
  end if;
  if (
    new.status in ('approved', 'scheduled', 'paused', 'cancelled')
    or (
      new.release_at is distinct from old.release_at
      and new.status <> 'in_review'
    )
    or (
      new.preflight_at is distinct from old.preflight_at
      and new.status <> 'in_review'
    )
    or new.approved_by is not null
    or new.approved_at is not null
    or new.scheduled_at is not null
  ) and current_setting('app.weekly_digest_release_action', true)
        is distinct from 'allowed' then
    raise exception 'Release transitions may be performed only by lifecycle RPCs'
      using errcode = '42501';
  end if;

  if (
    new.status in ('approved', 'scheduled', 'paused', 'cancelled')
    or (
      new.release_at is distinct from old.release_at
      and new.status <> 'in_review'
    )
    or (
      new.preflight_at is distinct from old.preflight_at
      and new.status <> 'in_review'
    )
    or new.approved_by is not null
    or new.approved_at is not null
    or new.scheduled_at is not null
  ) and (v_role <> 'owner' or not public.has_social_aal2()) then
    raise exception 'Only an AAL2 owner may approve, schedule, pause, or cancel a release'
      using errcode = '42501';
  end if;

  if old.status = 'scheduled'
     and now() >= coalesce(old.preflight_at, old.release_at)
     and new.status <> 'paused'
     and (
       new.active_revision_id is distinct from old.active_revision_id
       or new.title_en is distinct from old.title_en
       or new.title_uk is distinct from old.title_uk
       or new.intro_en is distinct from old.intro_en
       or new.intro_uk is distinct from old.intro_uk
       or new.status is distinct from old.status
       or new.release_at is distinct from old.release_at
       or new.preflight_at is distinct from old.preflight_at
     ) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

create or replace function public.guard_weekly_digest_revision_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision_id uuid;
  v_is_visual_refresh boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if current_setting('app.weekly_digest_revision_write', true)
       is distinct from 'allowed' then
    raise exception 'Revision rows may be inserted only by the revision RPC'
      using errcode = '42501';
  end if;

  if tg_table_name = 'weekly_digest_revisions' then
    select digest.*
      into v_digest
    from public.weekly_digests digest
    where digest.id = new.weekly_digest_id;
    v_is_visual_refresh := current_setting('app.weekly_visual_refresh', true) = 'allowed'
      and v_digest.status = 'published'
      and new.visual_refresh_source_revision_id = v_digest.published_revision_id;
  else
    v_revision_id := new.revision_id;
    select digest.*
      into v_digest
    from public.weekly_digest_revisions revision
    join public.weekly_digests digest
      on digest.id = revision.weekly_digest_id
    where revision.id = v_revision_id;
    v_is_visual_refresh := current_setting('app.weekly_visual_refresh', true) = 'allowed'
      and v_digest.status = 'published'
      and exists (
        select 1
        from public.weekly_digest_revisions revision
        where revision.id = v_revision_id
          and revision.visual_refresh_source_revision_id = v_digest.published_revision_id
      );
  end if;

  if v_digest.id is null
     or (
       v_digest.status in ('publishing', 'published', 'cancelled')
       and not v_is_visual_refresh
     ) then
    raise exception 'An editable weekly digest is required';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;
  return new;
end;
$function$;

create or replace function public.guard_weekly_digest_artifact_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_is_visual_refresh boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if tg_op = 'INSERT'
     and current_setting('app.weekly_digest_artifact_write', true)
       is distinct from 'allowed' then
    raise exception 'Artifact versions may be inserted only by the artifact RPC'
      using errcode = '42501';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = new.weekly_digest_id
    and digest.active_revision_id = new.revision_id;
  v_is_visual_refresh := current_setting('app.weekly_visual_refresh', true) = 'allowed'
    and v_digest.status = 'published'
    and exists (
      select 1
      from public.weekly_digest_revisions revision
      where revision.id = new.revision_id
        and revision.visual_refresh_source_revision_id = v_digest.published_revision_id
    );
  if v_digest.id is null
     or (
       v_digest.status in ('publishing', 'published', 'cancelled')
       and not v_is_visual_refresh
     ) then
    raise exception 'Artifacts may target only the editable active revision';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and (
    new.weekly_digest_id is distinct from old.weekly_digest_id
    or new.revision_id is distinct from old.revision_id
    or new.revision_item_id is distinct from old.revision_item_id
    or new.artifact_type is distinct from old.artifact_type
    or new.locale is distinct from old.locale
    or new.slot_key is distinct from old.slot_key
    or new.version is distinct from old.version
    or new.input_hash is distinct from old.input_hash
    or new.content is distinct from old.content
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.external_url is distinct from old.external_url
    or new.provider is distinct from old.provider
    or new.provider_id is distinct from old.provider_id
    or new.mime_type is distinct from old.mime_type
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.byte_size is distinct from old.byte_size
    or new.duration_seconds is distinct from old.duration_seconds
    or new.metadata is distinct from old.metadata
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Artifact identity and dependency fields are immutable';
  end if;
  if tg_op = 'UPDATE'
     and new.review_status is distinct from old.review_status
     and current_setting('app.weekly_digest_artifact_write', true)
           is distinct from 'allowed'
     and current_setting('app.weekly_digest_artifact_review', true)
           is distinct from 'allowed' then
    raise exception 'Artifact review state may be changed only by artifact workflow RPCs'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE'
     and new.published_at is distinct from old.published_at then
    raise exception 'Only the release worker may publish an artifact'
      using errcode = '42501';
  end if;
  if new.review_status = 'approved'
     and public.social_admin_role() <> 'owner' then
    raise exception 'Only an owner may approve an artifact'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- Prompt jobs in a visual refresh deliberately bypass all normal visual
-- dependency gates. They do not render or replace pixels: they only produce
-- the copy-ready prompt set that an owner can inspect.
create or replace function public.weekly_generation_waiting_reason(
  p_job public.weekly_digest_generation_jobs
)
returns text
language plpgsql
stable
set search_path = public
as $function$
declare
  v_count integer;
begin
  if p_job.job_type in ('cover', 'story_image')
     and p_job.input ->> 'prompt_only' = 'true'
     and p_job.input ->> 'visual_refresh' = 'true' then
    return null;
  end if;
  if p_job.job_type = 'research_pack' then return null; end if;
  if p_job.job_type = 'editorial_master' then
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    join public.weekly_digest_revision_items item on item.id = artifact.revision_item_id
    where artifact.revision_id = p_job.revision_id
      and item.rank <= 3
      and artifact.artifact_type = 'research_pack'
      and artifact.is_current
      and artifact.generation_status = 'ready'
      and artifact.review_status = 'approved';
    return case when v_count = 3 then null else format('Waiting for approved research packs: %s/3', v_count) end;
  end if;
  if p_job.job_type = 'social_copy' then
    if not exists (
      select 1 from public.weekly_digest_artifacts artifact
      where artifact.revision_id = p_job.revision_id
        and artifact.artifact_type = 'cover'
        and artifact.is_current
        and artifact.generation_status = 'ready'
    ) then return 'Waiting for the current cover artifact'; end if;
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = p_job.revision_id
      and artifact.artifact_type = 'article'
      and artifact.is_current
      and artifact.review_status = 'approved';
    return case when v_count = 2 then null else format('Waiting for approved bilingual articles: %s/2', v_count) end;
  end if;
  if p_job.job_type = 'video_script' then
    return case when exists (
      select 1 from public.weekly_digest_artifacts artifact
      where artifact.revision_id = p_job.revision_id
        and artifact.artifact_type = 'article'
        and artifact.locale = 'en'
        and artifact.is_current
        and artifact.review_status = 'approved'
    ) then null else 'Waiting for the approved English article' end;
  end if;
  if p_job.job_type = 'story_image' then
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = p_job.revision_id
      and artifact.is_current
      and artifact.review_status = 'approved'
      and artifact.artifact_type = 'article'
      and artifact.slot_key in ('article:en', 'article:uk');
    return case
      when v_count = 2 then null
      else format('Waiting for approved bilingual articles: %s/2', v_count)
    end;
  end if;
  if p_job.job_type = 'cover' then
    return case when not exists (
      select 1 from public.weekly_digest_revision_items item
      where item.revision_id = p_job.revision_id
        and not exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_item_id = item.id
            and artifact.artifact_type = 'story_image'
            and artifact.is_current
            and artifact.generation_status = 'ready'
        )
    ) then null else 'Waiting for all story images' end;
  end if;
  if p_job.job_type = 'pdf' then
    return case when exists (
      select 1 from public.weekly_digest_artifacts cover
      where cover.revision_id = p_job.revision_id
        and cover.artifact_type = 'cover'
        and cover.is_current
        and cover.generation_status = 'ready'
    ) and exists (
      select 1 from public.weekly_digest_artifacts article
      where article.revision_id = p_job.revision_id
        and article.artifact_type = 'article'
        and article.locale = coalesce(nullif(p_job.input ->> 'locale', ''), 'en')
        and article.is_current
        and article.generation_status = 'ready'
    ) then null else 'Waiting for ready cover and matching article' end;
  end if;
  if p_job.job_type = 'social_asset' then
    return case when exists (
      select 1 from public.weekly_digest_artifacts cover
      where cover.revision_id = p_job.revision_id
        and cover.artifact_type = 'cover'
        and cover.is_current
        and cover.generation_status = 'ready'
    ) then null else 'Waiting for the current cover artifact' end;
  end if;
  if p_job.job_type = 'video_manifest' then
    if not exists (
      select 1 from public.weekly_digest_artifacts artifact
      where artifact.revision_id = p_job.revision_id
        and artifact.artifact_type = 'video_script'
        and artifact.is_current
        and artifact.review_status = 'approved'
    ) then return 'Waiting for an approved video script'; end if;
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    join public.weekly_digest_revision_items item on item.id = artifact.revision_item_id
    where artifact.revision_id = p_job.revision_id
      and item.rank <= 3
      and artifact.artifact_type = 'story_image'
      and artifact.is_current
      and artifact.generation_status = 'ready'
      and artifact.review_status = 'approved';
    if v_count <> 3 then
      return format('Waiting for approved Top 3 story images: %s/3', v_count);
    end if;
    return case when exists (
      select 1 from public.weekly_digest_artifacts cover
      where cover.revision_id = p_job.revision_id
        and cover.artifact_type = 'cover'
        and cover.is_current
        and cover.generation_status = 'ready'
    ) then null else 'Waiting for the current cover artifact' end;
  end if;
  return null;
end;
$function$;

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

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
    and digest.active_revision_id = p_revision_id
  for update;
  if v_digest.id is null
     or v_digest.status <> 'published'
     or v_digest.published_revision_id is null
     or not exists (
       select 1
       from public.weekly_digest_revisions revision
       where revision.id = p_revision_id
         and revision.weekly_digest_id = p_weekly_digest_id
         and revision.visual_refresh_source_revision_id = v_digest.published_revision_id
     ) then
    raise exception 'An active private visual-refresh revision of this published digest is required';
  end if;

  if p_job_type = 'cover' then
    if p_revision_item_id is not null then
      raise exception 'Cover prompt jobs cannot target a story item';
    end if;
    v_slot_key := 'cover-prompt:neutral';
  else
    if p_revision_item_id is null or not exists (
      select 1
      from public.weekly_digest_revision_items item
      where item.id = p_revision_item_id
        and item.revision_id = p_revision_id
    ) then
      raise exception 'Story prompt jobs require a story from the active visual-refresh revision';
    end if;
    v_slot_key := 'story-prompt-set:' || p_revision_item_id::text;
  end if;

  -- The function owns the input shape. Callers cannot smuggle source URLs,
  -- a render mode, an asset path, or arbitrary generation instructions into
  -- a published digest lane.
  v_input := jsonb_build_object(
    'prompt_only', true,
    'visual_refresh', true,
    'visual_refresh_source_revision_id', v_digest.published_revision_id,
    'locale', 'neutral',
    'slot_key', v_slot_key,
    'revision_item_id', p_revision_item_id
  );

  insert into public.weekly_digest_generation_jobs (
    weekly_digest_id,
    revision_id,
    job_type,
    idempotency_key,
    status,
    input,
    created_by,
    status_reason
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    p_job_type,
    v_key,
    'queued',
    v_input,
    auth.uid(),
    'Queued prompt-only visual refresh'
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
      end,
      status_reason = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then 'Queued prompt-only visual refresh'
        else public.weekly_digest_generation_jobs.status_reason
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
      'idempotency_key', v_job.idempotency_key,
      'visual_refresh', true,
      'prompt_only', true
    )
  );
  return v_job;
end;
$function$;

create or replace function public.create_weekly_visual_refresh_draft(
  p_weekly_digest_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_source public.weekly_digest_revisions;
  v_active public.weekly_digest_revisions;
  v_revision_id uuid;
  v_revision_number integer;
  v_content_hash text;
  v_carried_count integer := 0;
  v_item public.weekly_digest_revision_items;
begin
  if not public.has_social_role(array['owner']) or not public.has_social_aal2() then
    raise exception 'An AAL2 owner session is required for a visual refresh' using errcode = '42501';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.status <> 'published' or v_digest.published_revision_id is null then
    raise exception 'Visual refresh drafts can be created only from a published weekly digest';
  end if;

  if v_digest.active_revision_id is distinct from v_digest.published_revision_id then
    select revision.*
      into v_active
    from public.weekly_digest_revisions revision
    where revision.id = v_digest.active_revision_id
      and revision.weekly_digest_id = p_weekly_digest_id;
    if v_active.id is not null
       and v_active.visual_refresh_source_revision_id = v_digest.published_revision_id then
      return v_active.id;
    end if;
    raise exception 'A different private working revision is already active; visual refresh will not overwrite it';
  end if;

  select revision.*
    into v_source
  from public.weekly_digest_revisions revision
  where revision.id = v_digest.published_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id;
  if v_source.id is null then
    raise exception 'Published weekly revision was not found';
  end if;

  perform set_config('app.weekly_visual_refresh', 'allowed', true);
  perform set_config('app.weekly_digest_revision_write', 'allowed', true);
  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);

  select coalesce(max(revision.revision_number), 0) + 1
    into v_revision_number
  from public.weekly_digest_revisions revision
  where revision.weekly_digest_id = p_weekly_digest_id;

  v_content_hash := md5(jsonb_build_object(
    'schema', 'weekly-visual-refresh-v1',
    'source_revision_id', v_source.id,
    'source_content_hash', v_source.content_hash,
    'display_title_en', v_source.display_title_en,
    'display_title_uk', v_source.display_title_uk,
    'visual_thesis_en', v_source.visual_thesis_en,
    'visual_thesis_uk', v_source.visual_thesis_uk
  )::text);

  insert into public.weekly_digest_revisions (
    weekly_digest_id,
    revision_number,
    selection_run_id,
    title_en,
    title_uk,
    display_title_en,
    display_title_uk,
    visual_thesis_en,
    visual_thesis_uk,
    intro_en,
    intro_uk,
    editor_note_en,
    editor_note_uk,
    key_takeaways_en,
    key_takeaways_uk,
    content_hash,
    created_by,
    visual_refresh_source_revision_id
  ) values (
    p_weekly_digest_id,
    v_revision_number,
    v_source.selection_run_id,
    v_source.title_en,
    v_source.title_uk,
    v_source.display_title_en,
    v_source.display_title_uk,
    v_source.visual_thesis_en,
    v_source.visual_thesis_uk,
    v_source.intro_en,
    v_source.intro_uk,
    v_source.editor_note_en,
    v_source.editor_note_uk,
    v_source.key_takeaways_en,
    v_source.key_takeaways_uk,
    v_content_hash,
    auth.uid(),
    v_source.id
  )
  returning id into v_revision_id;

  insert into public.weekly_digest_revision_items (
    revision_id,
    brief_item_id,
    rank,
    title_en,
    title_uk,
    summary_en,
    summary_uk,
    body_en,
    body_uk,
    why_en,
    why_uk,
    practical_en,
    practical_uk,
    takeaway_en,
    takeaway_uk,
    event_date,
    sources,
    source_snapshot
  )
  select
    v_revision_id,
    item.brief_item_id,
    item.rank,
    item.title_en,
    item.title_uk,
    item.summary_en,
    item.summary_uk,
    item.body_en,
    item.body_uk,
    item.why_en,
    item.why_uk,
    item.practical_en,
    item.practical_uk,
    item.takeaway_en,
    item.takeaway_uk,
    item.event_date,
    item.sources,
    item.source_snapshot
  from public.weekly_digest_revision_items item
  where item.revision_id = v_source.id
  order by item.rank;

  -- Public reads stay on published_revision_id. Only the private admin
  -- workspace follows active_revision_id, which is now the safe draft.
  update public.weekly_digests
  set active_revision_id = v_revision_id
  where id = p_weekly_digest_id;

  -- Preserve every ready+approved unchanged artifact by provenance reference,
  -- including the currently approved images and PDF. This creates no Storage
  -- object and no new pixels. Prompt sets alone are intentionally omitted: the
  -- new cover/story prompt jobs below replace those textual instructions.
  insert into public.weekly_digest_artifacts (
    weekly_digest_id,
    revision_id,
    revision_item_id,
    artifact_type,
    locale,
    slot_key,
    version,
    is_current,
    generation_status,
    review_status,
    input_hash,
    content,
    storage_bucket,
    storage_path,
    external_url,
    provider,
    provider_id,
    mime_type,
    width,
    height,
    byte_size,
    duration_seconds,
    metadata,
    created_by
  )
  select
    p_weekly_digest_id,
    v_revision_id,
    new_item.id,
    artifact.artifact_type,
    artifact.locale,
    case
      when artifact.artifact_type = 'story_image' then format('story-image:%s', new_item.id)
      else artifact.slot_key
    end,
    artifact.version,
    true,
    artifact.generation_status,
    artifact.review_status,
    public.weekly_digest_artifact_input_hash(
      v_revision_id,
      artifact.artifact_type,
      artifact.locale,
      new_item.id
    ),
    artifact.content,
    artifact.storage_bucket,
    artifact.storage_path,
    artifact.external_url,
    artifact.provider,
    artifact.provider_id,
    artifact.mime_type,
    artifact.width,
    artifact.height,
    artifact.byte_size,
    artifact.duration_seconds,
    artifact.metadata || jsonb_build_object(
      'carried_from_artifact_id', artifact.id,
      'visual_refresh_source_revision_id', v_source.id
    ),
    auth.uid()
  from public.weekly_digest_artifacts artifact
  left join public.weekly_digest_revision_items old_item
    on old_item.id = artifact.revision_item_id
  left join public.weekly_digest_revision_items new_item
    on new_item.revision_id = v_revision_id
   and new_item.brief_item_id = old_item.brief_item_id
  where artifact.revision_id = v_source.id
    and artifact.is_current
    and artifact.generation_status = 'ready'
    and artifact.review_status = 'approved'
    and artifact.artifact_type in (
      'research_pack',
      'content_quality_report',
      'article',
      'pdf',
      'cover',
      'story_image',
      'video_script',
      'video_manifest',
      'video_preview',
      'video_final',
      'captions',
      'thumbnail',
      'heygen_preview',
      'graphics_preview',
      'social_asset'
    )
    and (artifact.revision_item_id is null or new_item.id is not null);
  get diagnostics v_carried_count = row_count;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    note,
    artifact_snapshot
  )
  select
    artifact.id,
    auth.uid(),
    'carried_forward',
    'Approved unchanged artifact copied into a private visual-refresh draft.',
    jsonb_build_object(
      'slot_key', artifact.slot_key,
      'artifact_type', artifact.artifact_type,
      'input_hash', artifact.input_hash,
      'carried_from_artifact_id', artifact.metadata ->> 'carried_from_artifact_id',
      'visual_refresh_source_revision_id', v_source.id
    )
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = v_revision_id
    and artifact.metadata ? 'carried_from_artifact_id';

  insert into public.weekly_digest_release_events (
    weekly_digest_id,
    revision_id,
    actor_id,
    event_type,
    payload
  ) values (
    p_weekly_digest_id,
    v_revision_id,
    auth.uid(),
    'visual_refresh_draft_created',
    jsonb_build_object(
      'source_revision_id', v_source.id,
      'source_revision_number', v_source.revision_number,
      'revision_number', v_revision_number,
      'carried_artifact_count', v_carried_count,
      'prompt_only', true,
      'published_revision_id_unchanged', v_digest.published_revision_id
    )
  );

  perform public.queue_weekly_visual_refresh_prompt_job(
    p_weekly_digest_id,
    v_revision_id,
    'cover',
    null,
    'weekly:visual-refresh:' || v_revision_id::text || ':cover'
  );
  for v_item in
    select item.*
    from public.weekly_digest_revision_items item
    where item.revision_id = v_revision_id
    order by item.rank
  loop
    perform public.queue_weekly_visual_refresh_prompt_job(
      p_weekly_digest_id,
      v_revision_id,
      'story_image',
      v_item.id,
      'weekly:visual-refresh:' || v_revision_id::text || ':story:' || v_item.id::text
    );
  end loop;

  return v_revision_id;
end;
$function$;

-- A worker may persist only a textual prompt set for this lane. The narrow
-- function has no storage/path/provider/pixel parameters, and never invokes
-- save_weekly_digest_artifact (which would reopen a published digest).
create or replace function public.save_weekly_visual_refresh_prompt_artifact(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_revision_item_id uuid default null,
  p_slot_key text default null,
  p_content jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_source_revision_id uuid;
  v_artifact_id uuid;
  v_version integer;
  v_input_hash text;
  v_expected_slot text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_content, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Prompt content and metadata must be objects';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  join public.weekly_digest_revisions revision
    on revision.id = p_revision_id
  where digest.id = p_weekly_digest_id
    and digest.active_revision_id = p_revision_id
  for update of digest, revision;
  select revision.visual_refresh_source_revision_id
    into v_source_revision_id
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id;
  if v_digest.id is null
     or v_digest.status <> 'published'
     or v_digest.published_revision_id is null
     or v_source_revision_id is distinct from v_digest.published_revision_id then
    raise exception 'Active private visual-refresh revision of a published digest is required';
  end if;

  if p_revision_item_id is null then
    v_expected_slot := 'cover-prompt:neutral';
  else
    if not exists (
      select 1
      from public.weekly_digest_revision_items item
      where item.id = p_revision_item_id
        and item.revision_id = p_revision_id
    ) then
      raise exception 'Prompt set item does not belong to the active visual-refresh revision';
    end if;
    v_expected_slot := 'story-prompt-set:' || p_revision_item_id::text;
  end if;
  if btrim(coalesce(p_slot_key, '')) <> v_expected_slot then
    raise exception 'Visual-refresh prompt slot does not match its revision item';
  end if;

  select coalesce(max(artifact.version), 0) + 1
    into v_version
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = p_revision_id
    and artifact.slot_key = v_expected_slot;

  update public.weekly_digest_artifacts
  set is_current = false,
      review_status = case when review_status = 'approved' then 'stale' else review_status end
  where revision_id = p_revision_id
    and slot_key = v_expected_slot
    and is_current;

  v_input_hash := public.weekly_digest_artifact_input_hash(
    p_revision_id,
    'story_prompt_set',
    'neutral',
    p_revision_item_id
  );

  insert into public.weekly_digest_artifacts (
    weekly_digest_id,
    revision_id,
    revision_item_id,
    artifact_type,
    locale,
    slot_key,
    version,
    generation_status,
    review_status,
    input_hash,
    content,
    metadata,
    created_by
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    p_revision_item_id,
    'story_prompt_set',
    'neutral',
    v_expected_slot,
    v_version,
    'ready',
    'in_review',
    v_input_hash,
    p_content,
    p_metadata || jsonb_build_object(
      'source_kind', 'visual_refresh_prompt_only',
      'visual_refresh', true,
      'visual_refresh_source_revision_id', v_source_revision_id
    ),
    auth.uid()
  )
  returning id into v_artifact_id;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    note,
    artifact_snapshot
  ) values (
    v_artifact_id,
    auth.uid(),
    case when v_version = 1 then 'generated' else 'edited' end,
    'Prompt-only visual refresh; no image bytes were generated or replaced.',
    jsonb_build_object(
      'slot_key', v_expected_slot,
      'artifact_type', 'story_prompt_set',
      'version', v_version,
      'input_hash', v_input_hash,
      'visual_refresh', true,
      'prompt_only', true
    )
  );

  insert into public.weekly_digest_release_events (
    weekly_digest_id,
    revision_id,
    actor_id,
    event_type,
    payload
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    auth.uid(),
    'artifact_saved',
    jsonb_build_object(
      'artifact_id', v_artifact_id,
      'artifact_type', 'story_prompt_set',
      'slot_key', v_expected_slot,
      'visual_refresh', true,
      'prompt_only', true
    )
  );
  return v_artifact_id;
end;
$function$;

-- Keep the published fence in the worker claim. A published digest is
-- claimable only for a current private refresh revision and only for the two
-- prompt-only job types whose input was constructed above.
create or replace function public.claim_weekly_digest_generation_jobs_v2(
  p_backend text,
  p_job_types text[] default null,
  p_limit integer default 1,
  p_job_id uuid default null,
  p_dispatch_token uuid default null,
  p_external_run_id text default null,
  p_external_run_url text default null,
  p_deadline_seconds integer default null
)
returns table (
  id uuid,
  weekly_digest_id uuid,
  revision_id uuid,
  job_type text,
  attempts integer,
  input jsonb,
  execution_backend text,
  attempt_id uuid,
  lease_token uuid
)
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
declare
  v_job public.weekly_digest_generation_jobs;
  v_attempt public.weekly_digest_generation_attempts;
  v_deadline_seconds integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_backend not in ('vercel', 'github_actions') then
    raise exception 'Unsupported generation backend';
  end if;
  if p_job_types is not null and cardinality(p_job_types) = 0 then
    raise exception 'Job type filter cannot be empty';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'Claim limit must be between 1 and 20';
  end if;
  if p_dispatch_token is not null and p_backend <> 'github_actions' then
    raise exception 'Dispatch token is only valid for GitHub Actions';
  end if;

  v_deadline_seconds := case
    when p_deadline_seconds is null then case when p_backend = 'vercel' then 240 else 7200 end
    else p_deadline_seconds
  end;
  if v_deadline_seconds < 15 or v_deadline_seconds > 43200 then
    raise exception 'Deadline must be between 15 seconds and 12 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest on digest.id = job.weekly_digest_id
    where job.execution_backend = p_backend
      and job.attempts < job.max_attempts
      and digest.active_revision_id = job.revision_id
      and (
        digest.status not in ('publishing', 'published', 'cancelled')
        or (
          digest.status = 'published'
          and job.job_type in ('cover', 'story_image')
          and job.input ->> 'prompt_only' = 'true'
          and job.input ->> 'visual_refresh' = 'true'
          and exists (
            select 1
            from public.weekly_digest_revisions revision
           where revision.id = job.revision_id
             and revision.weekly_digest_id = digest.id
             and revision.visual_refresh_source_revision_id = digest.published_revision_id
             and job.input ->> 'visual_refresh_revision_hash' = revision.content_hash
           )
        )
      )
      and public.weekly_generation_job_ready(job)
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (p_job_id is null or job.id = p_job_id)
      and (
        (p_backend = 'github_actions' and job.status = 'dispatching'
          and job.dispatch_token is not distinct from p_dispatch_token)
        or (p_backend = 'vercel' and job.status in ('queued', 'retry_scheduled')
          and coalesce(job.next_attempt_at, '-infinity'::timestamptz) <= now())
      )
    order by job.created_at
    for update of job skip locked
    limit p_limit
  loop
    insert into public.weekly_digest_generation_attempts (
      job_id, attempt_number, backend, github_run_id, external_run_url, deadline_at
    ) values (
      v_job.id,
      v_job.attempts + 1,
      p_backend,
      nullif(btrim(coalesce(p_external_run_id, '')), ''),
      nullif(btrim(coalesce(p_external_run_url, '')), ''),
      now() + make_interval(secs => v_deadline_seconds)
    ) returning * into v_attempt;

    update public.weekly_digest_generation_jobs
    set status = 'running',
        attempts = attempts + 1,
        current_attempt_id = v_attempt.id,
        current_step = 'prepare',
        progress_current = 0,
        progress_total = 100,
        progress_unit = 'percent',
        heartbeat_at = now(),
        locked_at = now(),
        started_at = coalesce(started_at, now()),
        finished_at = null,
        next_attempt_at = null,
        failure_code = null,
        status_reason = case when p_backend = 'github_actions' then 'GitHub Actions worker started' else 'Vercel worker started' end,
        last_error = null
    where id = v_job.id
    returning * into v_job;

    insert into public.weekly_digest_generation_events (
      job_id, attempt_id, event_type, step, progress_current, progress_total, metadata
    ) values (
      v_job.id, v_attempt.id, 'attempt_started', 'prepare', 0, 100,
      jsonb_build_object(
        'attempt', v_job.attempts,
        'max_attempts', v_job.max_attempts,
        'backend', p_backend,
        'deadline_at', v_attempt.deadline_at,
        'external_run_url', v_attempt.external_run_url
      )
    );

    id := v_job.id;
    weekly_digest_id := v_job.weekly_digest_id;
    revision_id := v_job.revision_id;
    job_type := v_job.job_type;
    attempts := v_job.attempts;
    input := v_job.input;
    execution_backend := v_job.execution_backend;
    attempt_id := v_attempt.id;
    lease_token := v_attempt.lease_token;
    return next;
  end loop;
end;
$function$;

alter table public.weekly_digest_release_events
  drop constraint weekly_digest_release_events_event_type_check;
alter table public.weekly_digest_release_events
  add constraint weekly_digest_release_events_event_type_check
  check (event_type = any (array[
    'revision_created', 'revision_restored', 'artifact_saved', 'artifact_reviewed',
    'generation_queued', 'generation_started', 'generation_succeeded', 'generation_failed',
    'preflight_passed', 'preflight_failed', 'approved', 'scheduled', 'publishing_started',
    'publishing_retried', 'published', 'failed', 'paused', 'resumed', 'override',
    'draft_revision_created', 'visual_refresh_draft_created'
  ]::text[]));

revoke all on function public.create_weekly_visual_refresh_draft(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_weekly_visual_refresh_draft(uuid)
  to authenticated;

revoke all on function public.queue_weekly_visual_refresh_prompt_job(uuid, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.queue_weekly_visual_refresh_prompt_job(uuid, uuid, text, uuid, text)
  to authenticated;

revoke all on function public.save_weekly_visual_refresh_prompt_artifact(uuid, uuid, uuid, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_weekly_visual_refresh_prompt_artifact(uuid, uuid, uuid, text, jsonb, jsonb)
  to service_role;

revoke all on function public.claim_weekly_digest_generation_jobs_v2(text, text[], integer, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_weekly_digest_generation_jobs_v2(text, text[], integer, uuid, uuid, text, text, integer)
  to service_role;

commit;
