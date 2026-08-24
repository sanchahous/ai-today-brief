-- Covers production migration version 20260824130000.
begin;

do $test$
declare
  v_create text;
  v_queue text;
  v_save text;
  v_save_args text;
  v_wait text;
  v_claim text;
  v_guard text;
  v_revision_guard text;
  v_artifact_guard text;
begin
  if has_column_privilege('anon', 'public.weekly_digest_revisions', 'visual_refresh_source_revision_id', 'SELECT')
     or has_column_privilege('authenticated', 'public.weekly_digest_revisions', 'visual_refresh_source_revision_id', 'SELECT') then
    raise exception 'visual refresh source provenance must stay private';
  end if;

  select pg_get_functiondef('public.create_weekly_visual_refresh_draft(uuid)'::regprocedure)
    into v_create;
  if position('visual_refresh_source_revision_id' in v_create) = 0
     or position('set active_revision_id = v_revision_id' in v_create) = 0
     or position('published_revision_id_unchanged' in v_create) = 0 then
    raise exception 'visual refresh draft must create a marked private active revision';
  end if;
  if position('set status =' in lower(v_create)) > 0
     or position('published_revision_id =' in lower(v_create)) > 0
     or position('published_at =' in lower(v_create)) > 0 then
    raise exception 'visual refresh draft must not reopen or repoint the published digest';
  end if;
  if v_create !~ $visual_copy$
    (and[[:space:]]+)?artifact\.artifact_type in \(
      [[:space:]]*'research_pack',
      [[:space:]]*'content_quality_report',
      [[:space:]]*'article',
      [[:space:]]*'pdf',
      [[:space:]]*'cover',
      [[:space:]]*'story_image',
      [[:space:]]*'video_script',
      [[:space:]]*'video_manifest',
      [[:space:]]*'video_preview',
      [[:space:]]*'video_final',
      [[:space:]]*'captions',
      [[:space:]]*'thumbnail',
      [[:space:]]*'heygen_preview',
      [[:space:]]*'graphics_preview',
      [[:space:]]*'social_asset'
    [[:space:]]*\)
  $visual_copy$ then
    raise exception 'visual refresh draft must carry every approved unchanged non-prompt artifact';
  end if;
  if position('queue_weekly_visual_refresh_prompt_job' in v_create) = 0
     or position('''cover''' in v_create) = 0
     or position('''story_image''' in v_create) = 0
     or position('save_weekly_digest_artifact' in v_create) > 0 then
    raise exception 'visual refresh draft must queue only its cover/story prompt lane';
  end if;

  select pg_get_functiondef(
    'public.weekly_generation_waiting_reason(public.weekly_digest_generation_jobs)'::regprocedure
  ) into v_wait;
  if position('p_job.job_type = ''research_pack''' in v_wait) = 0
     or position('p_job.job_type = ''editorial_master''' in v_wait) = 0
     or position('p_job.job_type = ''social_copy''' in v_wait) = 0
     or position('p_job.job_type = ''video_script''' in v_wait) = 0
     or position('p_job.job_type = ''story_image''' in v_wait) = 0
     or position('p_job.job_type = ''cover''' in v_wait) = 0
     or position('p_job.job_type = ''pdf''' in v_wait) = 0
     or position('p_job.job_type = ''social_asset''' in v_wait) = 0
     or position('p_job.job_type = ''video_manifest''' in v_wait) = 0 then
    raise exception 'visual refresh must not remove an existing generation dependency gate';
  end if;

  select pg_get_functiondef(
    'public.queue_weekly_visual_refresh_prompt_job(uuid,uuid,text,uuid,text)'::regprocedure
  ) into v_queue;
  if position('p_job_type not in (''cover'', ''story_image'')' in v_queue) = 0
     or position('''prompt_only'', true' in v_queue) = 0
     or position('''visual_refresh'', true' in v_queue) = 0
     or position('source_url' in v_queue) > 0 then
    raise exception 'visual refresh queue must own a prompt-only input with no source import';
  end if;

  select pg_get_function_arguments(
    'public.save_weekly_visual_refresh_prompt_artifact(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure
  ) into v_save_args;
  select pg_get_functiondef(
    'public.save_weekly_visual_refresh_prompt_artifact(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure
  ) into v_save;
  if position('storage' in lower(v_save_args)) > 0
     or position('external' in lower(v_save_args)) > 0
     or position('provider' in lower(v_save_args)) > 0
     or position('width' in lower(v_save_args)) > 0
     or position('height' in lower(v_save_args)) > 0
     or position('mime' in lower(v_save_args)) > 0
     or position('byte' in lower(v_save_args)) > 0
     or position('duration' in lower(v_save_args)) > 0
     or position('storage_bucket' in lower(v_save)) > 0
     or position('storage_path' in lower(v_save)) > 0
     or position('mime_type' in lower(v_save)) > 0
     or position('byte_size' in lower(v_save)) > 0
     or position('width' in lower(v_save)) > 0
     or position('height' in lower(v_save)) > 0
     or position('''story_prompt_set''' in v_save) = 0 then
    raise exception 'visual refresh persistence must not accept pixel or storage parameters';
  end if;

  select pg_get_functiondef(
    'public.claim_weekly_digest_generation_jobs_v2(text,text[],integer,uuid,uuid,text,text,integer)'::regprocedure
  ) into v_claim;
  if position('job.input ->> ''prompt_only'' = ''true''' in v_claim) = 0
     or position('job.input ->> ''visual_refresh'' = ''true''' in v_claim) = 0
     or position('revision.visual_refresh_source_revision_id = digest.published_revision_id' in v_claim) = 0
     or position('job.input ->> ''visual_refresh_revision_hash'' = revision.content_hash' in v_claim) = 0
     or position('job.execution_backend = p_backend' in v_claim) = 0
     or position('job.attempts < job.max_attempts' in v_claim) = 0
     or position('digest.active_revision_id = job.revision_id' in v_claim) = 0
     or position('public.weekly_generation_job_ready(job)' in v_claim) = 0
     or position('(p_job_types is null or job.job_type = any(p_job_types))' in v_claim) = 0
     or position('(p_job_id is null or job.id = p_job_id)' in v_claim) = 0
     or position('job.dispatch_token is not distinct from p_dispatch_token' in v_claim) = 0
     or position('job.status in (''queued'', ''retry_scheduled'')' in v_claim) = 0 then
    raise exception 'published worker claim must stay fenced to marked prompt-only refresh jobs';
  end if;

  select pg_get_functiondef('public.guard_weekly_digest_lifecycle()'::regprocedure)
    into v_guard;
  if position('app.weekly_visual_refresh' in v_guard) = 0
     or position('visual_refresh_source_revision_id = old.published_revision_id' in v_guard) = 0
     or position('new.published_revision_id is distinct from old.published_revision_id' in v_guard) = 0
     or position('new.published_at is distinct from old.published_at' in v_guard) = 0
     or position('app.weekly_digest_revision_write' in v_guard) = 0
     or position('app.weekly_digest_release_action' in v_guard) = 0
     or position('15:45 Europe/Kyiv preflight gate has closed' in v_guard) = 0 then
    raise exception 'published lifecycle exception must be capability- and provenance-scoped';
  end if;

  select pg_get_functiondef('public.guard_weekly_digest_revision_write()'::regprocedure)
    into v_revision_guard;
  if position('app.weekly_digest_revision_write' in v_revision_guard) = 0
     or position('new.visual_refresh_source_revision_id = v_digest.published_revision_id' in v_revision_guard) = 0
     or position('v_digest.status in (''publishing'', ''published'', ''cancelled'')' in v_revision_guard) = 0
     or position('15:45 Europe/Kyiv preflight gate has closed' in v_revision_guard) = 0 then
    raise exception 'visual refresh must retain the normal revision-write lifecycle fence';
  end if;

  select pg_get_functiondef('public.guard_weekly_digest_artifact_write()'::regprocedure)
    into v_artifact_guard;
  if position('app.weekly_digest_artifact_write' in v_artifact_guard) = 0
     or position('digest.active_revision_id = new.revision_id' in v_artifact_guard) = 0
     or position('v_digest.status in (''publishing'', ''published'', ''cancelled'')' in v_artifact_guard) = 0
     or position('artifact identity and dependency fields are immutable' in lower(v_artifact_guard)) = 0
     or position('artifact review state may be changed only by artifact workflow rpcs' in lower(v_artifact_guard)) = 0 then
    raise exception 'visual refresh must retain the normal artifact-write lifecycle fence';
  end if;
end;
$test$;

rollback;
