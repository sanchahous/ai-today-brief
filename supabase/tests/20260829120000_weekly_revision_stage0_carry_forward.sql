-- Run with `supabase test db` after the Stage 0 carry-forward migration.

begin;

do $test$
declare
  v_service text;
  v_service_vd text;
  v_save text;
  v_preflight text;
  v_helper text;
begin
  select pg_get_functiondef(
    'public.create_service_weekly_digest_revision(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)'::regprocedure
  ) into v_service;
  if position('carry_forward_weekly_digest_revision_artifacts' in v_service) = 0
     or position('''carried_artifact_count'', 0' in v_service) > 0 then
    raise exception 'service revision RPC must carry artifacts instead of hardcoding zero';
  end if;

  select pg_get_functiondef(
    'public.create_service_weekly_digest_revision_with_visual_direction(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text,text,text,text,text)'::regprocedure
  ) into v_service_vd;
  if position('carry_forward_weekly_digest_revision_artifacts' in v_service_vd) = 0
     or position('''carried_artifact_count'', 0' in v_service_vd) > 0 then
    raise exception 'visual-direction service revision RPC must carry artifacts instead of hardcoding zero';
  end if;

  select pg_get_functiondef(
    'public.save_weekly_digest_artifact(uuid,uuid,text,text,text,uuid,text,text,jsonb,text,text,text,text,text,text,integer,integer,bigint,integer,jsonb)'::regprocedure
  ) into v_save;
  if position('auto_revoked' in v_save) > 0
     or position('''story_image'', ''cover'', ''social_asset''' in v_save) > 0 then
    raise exception 'saving a visual must not auto-revoke social copy approval';
  end if;
  if position('Dependency %s was replaced.' in v_save) = 0 then
    raise exception 'saving a visual must still stale-mark pixel dependents';
  end if;
  if position('weekly_digest_social_asset_relink' in v_save) = 0 then
    raise exception 'saving a visual must remap social asset artifactIds';
  end if;

  select pg_get_functiondef(
    'public.weekly_digest_preflight(uuid)'::regprocedure
  ) into v_preflight;
  if position('social_assets_stale' in v_preflight) = 0
     or position('copy is approved but its attached image' in v_preflight) = 0 then
    raise exception 'preflight must gate stale social assets separately from copy approval';
  end if;

  select pg_get_functiondef(
    'public.carry_forward_weekly_digest_revision_artifacts(uuid,uuid,uuid)'::regprocedure
  ) into v_helper;
  if position('weekly_digest_artifact_input_hash' in v_helper) = 0
     or position('carried_from_artifact_id' in v_helper) = 0
     or position('app.weekly_digest_invalidated_slots' in v_helper) = 0 then
    raise exception 'carry-forward helper must copy by matching input_hash and publish invalidated slots';
  end if;

  if position('app.weekly_digest_invalidated_slots' in pg_get_functiondef(
       'public.rebind_weekly_digest_preflight_override()'::regprocedure
     )) = 0 then
    raise exception 'override rebind trigger is missing';
  end if;

  if position('weekly_digest_social_asset_relink' in pg_get_functiondef(
       'public.guard_social_content_approval()'::regprocedure
     )) = 0 then
    raise exception 'social approval guard must skip copy revoke on asset relink';
  end if;

  if has_function_privilege(
    'anon',
    'public.list_applied_schema_migrations()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.list_applied_schema_migrations()',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.list_applied_schema_migrations()',
    'EXECUTE'
  ) then
    raise exception 'list_applied_schema_migrations must be service_role-only';
  end if;
end;
$test$;

rollback;
