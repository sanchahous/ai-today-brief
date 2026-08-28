-- Covers production migration version 20260824140000.
begin;

do $test$
declare
  v_manual text;
  v_service text;
  v_refresh text;
  v_immutable_trigger text;
  v_queue text;
  v_save text;
  v_hash text;
begin
  select pg_get_functiondef(
    'public.create_weekly_digest_revision_with_visual_direction(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text,text,text,text)'::regprocedure
  ) into v_manual;
  if position('insert into public.weekly_digest_revisions' in lower(v_manual)) = 0
     or position('display_title_en' in v_manual) = 0
     or position('visual_thesis_uk' in v_manual) = 0
     or position('8 and 96' in v_manual) = 0
     or position('16 and 360' in v_manual) = 0
     or position('visual_direction' in v_manual) = 0 then
    raise exception 'manual direction revision RPC must atomically create and validate all four fields';
  end if;

  select pg_get_functiondef(
    'public.create_service_weekly_digest_revision_with_visual_direction(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text,text,text,text,text)'::regprocedure
  ) into v_service;
  if position('service_role required' in v_service) = 0
     or position('insert into public.weekly_digest_revisions' in lower(v_service)) = 0
     or position('display_title_uk' in v_service) = 0
     or position('visual_thesis_en' in v_service) = 0 then
    raise exception 'master writer must persist direction with its immutable revision';
  end if;

  select pg_get_functiondef(
    'public.update_weekly_visual_refresh_direction(uuid,uuid,text,text,text,text)'::regprocedure
  ) into v_refresh;
  if position('has_social_aal2' in v_refresh) = 0
     or position('visual_refresh_source_revision_id is distinct from v_digest.published_revision_id' in v_refresh) = 0
     or position('app.weekly_visual_refresh_direction_write' in v_refresh) = 0
     or position('visual_refresh_direction_updated' in v_refresh) = 0
     or position('regeneration_token' in v_refresh) = 0
     or position('queue_weekly_visual_refresh_prompt_job' in v_refresh) = 0
     or position('''waiting'', ''queued'', ''dispatching'', ''running'', ''retry_scheduled'', ''failed''' in v_refresh) = 0
     or position('update public.weekly_digest_generation_attempts' in lower(v_refresh)) = 0
     or position('''superseded_visual_direction''' in v_refresh) = 0
     or position('update public.weekly_digest_artifacts' in lower(v_refresh)) = 0
     or position('set published_revision_id' in lower(v_refresh)) > 0
     or position('set published_at' in lower(v_refresh)) > 0 then
    raise exception 'refresh direction update must be AAL2/provenance-scoped and leave published pointers untouched';
  end if;

  select pg_get_functiondef('public.reject_weekly_digest_immutable_mutation()'::regprocedure)
    into v_immutable_trigger;
  if position('app.weekly_visual_refresh_direction_write' in v_immutable_trigger) = 0
     or position('display_title_en' in v_immutable_trigger) = 0
     or position('visual_thesis_uk' in v_immutable_trigger) = 0
     or position('content_hash' in v_immutable_trigger) = 0
     or position('tg_table_name = ''weekly_digest_revisions''' in v_immutable_trigger) = 0 then
    raise exception 'immutable revision trigger must allow only the narrow refresh-direction update';
  end if;

  select pg_get_functiondef(
    'public.queue_weekly_visual_refresh_prompt_job(uuid,uuid,text,uuid,text)'::regprocedure
  ) into v_queue;
  if position('visual_refresh_revision_hash' in v_queue) = 0
     or position('''prompt_only'', true' in v_queue) = 0
     or position('''visual_refresh'', true' in v_queue) = 0 then
    raise exception 'refresh queue must fence prompt jobs with the current direction hash';
  end if;

  select pg_get_functiondef(
    'public.save_weekly_visual_refresh_prompt_artifact_with_direction_hash(uuid,uuid,uuid,text,text,jsonb,jsonb)'::regprocedure
  ) into v_save;
  if position('visual direction changed while this prompt job was running' in lower(v_save)) = 0
     or position('save_weekly_visual_refresh_prompt_artifact' in v_save) = 0
     or position('for update' in lower(v_save)) = 0
     or position('select digest.* into v_digest' in lower(v_save)) = 0
     or position('storage_path' in lower(v_save)) > 0
     or position('external_url' in lower(v_save)) > 0 then
    raise exception 'refresh prompt persistence must reject stale workers without gaining image-storage powers';
  end if;

  select pg_get_functiondef(
    'public.weekly_digest_artifact_input_hash(uuid,text,text,uuid)'::regprocedure
  ) into v_hash;
  if position('visual_direction' in v_hash) = 0
     or position('p_artifact_type in (''cover'', ''pdf'', ''social_asset'', ''story_prompt_set'')' in v_hash) = 0 then
    raise exception 'cover, PDF, social and prompt-set hashes must depend on visual direction';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.create_weekly_digest_revision_with_visual_direction(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text,text,text,text)',
    'EXECUTE'
  )
     or not has_function_privilege(
       'service_role',
       'public.create_service_weekly_digest_revision_with_visual_direction(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text,text,text,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.update_weekly_visual_refresh_direction(uuid,uuid,text,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.save_weekly_visual_refresh_prompt_artifact_with_direction_hash(uuid,uuid,uuid,text,text,jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'weekly direction RPC grants are not least-privilege';
  end if;
end;
$test$;

rollback;
