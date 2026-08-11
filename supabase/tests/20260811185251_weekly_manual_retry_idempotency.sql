-- Covers production migration version 20260811185251.
begin;

do $test$
declare
  v_retry_def text;
begin
  if to_regclass(
    'public.weekly_digest_generation_jobs_active_retry_source_unique'
  ) is null then
    raise exception 'Active manual retries must be unique per source job';
  end if;

  select pg_get_functiondef(
    'public.retry_weekly_digest_generation_job(uuid)'::regprocedure
  ) into v_retry_def;

  if position('v_existing' in v_retry_def) = 0
     or position('for update' in lower(v_retry_def)) = 0
     or position('unique_violation' in lower(v_retry_def)) = 0
     or position('succeeded' in lower(v_retry_def)) = 0 then
    raise exception 'Manual retry RPC must reuse live/succeeded children and serialize callers';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.retry_weekly_digest_generation_job(uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.retry_weekly_digest_generation_job(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Owner/editor UI and service workers must retain retry access';
  end if;

  if has_function_privilege(
    'anon',
    'public.retry_weekly_digest_generation_job(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous callers must not create manual retries';
  end if;
end;
$test$;

rollback;
