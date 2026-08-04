-- Run with `supabase test db` after the revision-stability migration.

begin;

do $test$
declare
  v_hash_def text;
  v_manual_def text;
  v_claim_def text;
  v_approve_def text;
  v_revert_def text;
  v_event_check text;
begin
  select pg_get_functiondef(
    'public.weekly_digest_artifact_input_hash(uuid,text,text,uuid)'::regprocedure
  ) into v_hash_def;
  if position('weekly-artifact-input-v2' in v_hash_def) = 0
     or position('''brief_item_id'', item.brief_item_id' in v_hash_def) = 0
     or position('to_jsonb(item)' in v_hash_def) > 0 then
    raise exception 'Artifact input hash must identify stories by brief_item_id, not volatile row ids';
  end if;

  select pg_get_functiondef(
    'public.create_weekly_digest_revision(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  ) into v_manual_def;
  if position('v_current_revision.content_hash = v_content_hash' in v_manual_def) = 0
     or position('Superseded by a newer immutable editorial revision.' in v_manual_def) = 0 then
    raise exception 'Manual revision save must no-op identical content and cancel orphaned jobs';
  end if;

  select pg_get_functiondef(
    'public.claim_weekly_digest_generation_jobs(text[],integer,interval)'::regprocedure
  ) into v_claim_def;
  if position('when ''story_image'' then' in v_claim_def) = 0
     or position('slot_key in (''article:en'', ''article:uk'')' in v_claim_def) = 0 then
    raise exception 'story_image claim must unlock from approved bilingual articles, not video_script';
  end if;

  select pg_get_functiondef(
    'public.approve_weekly_digest(uuid,text)'::regprocedure
  ) into v_approve_def;
  if position('video-final:%' in v_approve_def) = 0
     or position('captions:%' in v_approve_def) = 0
     or position('thumbnail:%' in v_approve_def) = 0 then
    raise exception 'Owner override must cover trial video/captions/thumbnail blockers';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.revert_weekly_digest_revision(uuid,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Editors need execute on revert_weekly_digest_revision';
  end if;
  if has_function_privilege(
    'anon',
    'public.revert_weekly_digest_revision(uuid,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Anon must not execute revert_weekly_digest_revision';
  end if;

  select pg_get_functiondef(
    'public.revert_weekly_digest_revision(uuid,uuid,text)'::regprocedure
  ) into v_revert_def;
  if position('revision_restored' in v_revert_def) = 0
     or position('has_social_role' in v_revert_def) = 0 then
    raise exception 'Revert must be role-gated and audit revision_restored';
  end if;

  select pg_get_constraintdef(oid)
    into v_event_check
  from pg_constraint
  where conname = 'weekly_digest_release_events_event_type_check';
  if position('revision_restored' in coalesce(v_event_check, '')) = 0 then
    raise exception 'Release events check constraint must allow revision_restored';
  end if;
end;
$test$;

rollback;
