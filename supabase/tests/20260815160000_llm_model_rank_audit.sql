-- Covers production migration version 20260815160000.
begin;

do $test$
declare
  v_rls boolean;
  v_check text;
begin
  if to_regclass('public.llm_model_rank_audit') is null then
    raise exception 'llm_model_rank_audit table is missing';
  end if;

  select relrowsecurity into v_rls
  from pg_class
  where oid = 'public.llm_model_rank_audit'::regclass;
  if v_rls is not true then
    raise exception 'llm_model_rank_audit must have RLS enabled';
  end if;

  select string_agg(pg_get_constraintdef(oid), ' | ')
    into v_check
  from pg_constraint
  where conrelid = 'public.llm_model_rank_audit'::regclass
    and contype = 'c';

  if v_check is null
     or position('quality_drop' in v_check) = 0
     or position('no_candidate' in v_check) = 0
     or position('apply_disabled' in v_check) = 0 then
    raise exception
      'skip_reason CHECK must allow quality_drop, no_candidate and apply_disabled';
  end if;

  -- The kill-switch row: a real winner, recorded, but never applied.
  insert into public.llm_model_rank_audit
    (role, model_id, score, quality_index, axis, applied, skip_reason)
  values ('weekly.master_writer', 'vendor/model', 1.0, 50, 'intelligence', false, 'apply_disabled');

  -- ...and it must stay mutually exclusive with applied=true.
  begin
    insert into public.llm_model_rank_audit
      (role, model_id, score, quality_index, axis, applied, skip_reason)
    values ('weekly.master_writer', 'vendor/model', 1.0, 50, 'intelligence', true, 'apply_disabled');
    raise exception 'applied=true with a skip_reason must be rejected';
  exception
    when check_violation then null;
  end;
end;
$test$;

rollback;
