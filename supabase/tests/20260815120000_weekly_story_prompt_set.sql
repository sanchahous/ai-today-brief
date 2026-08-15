-- Covers production migration version 20260815120000.
begin;

do $test$
declare
  v_check text;
  v_hash_def text;
begin
  select pg_get_constraintdef(oid)
    into v_check
  from pg_constraint
  where conrelid = 'public.weekly_digest_artifacts'::regclass
    and conname = 'weekly_digest_artifacts_artifact_type_check';

  if v_check is null
     or position('''story_prompt_set''' in v_check) = 0
     or position('''story_image''' in v_check) = 0 then
    raise exception 'Artifact CHECK must accept story_prompt_set alongside existing types';
  end if;

  select pg_get_functiondef(
    'public.weekly_digest_artifact_input_hash(uuid,text,text,uuid)'::regprocedure
  ) into v_hash_def;

  if position('''story_image'', ''story_prompt_set''' in v_hash_def) = 0
     and position('''story_prompt_set'', ''story_image''' in v_hash_def) = 0 then
    raise exception 'story_prompt_set input hash must share the story_image item payload';
  end if;

  if position('and dependency.artifact_type = ''story_prompt_set''' in v_hash_def) > 0 then
    raise exception 'story_prompt_set is text and must not be a pixel dependency of cover/pdf/social';
  end if;
end;
$test$;

rollback;
