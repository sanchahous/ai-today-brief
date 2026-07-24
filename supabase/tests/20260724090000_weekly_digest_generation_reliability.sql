-- Run with `supabase test db` after the generation reliability migration.

begin;

do $test$
declare
  v_queue_definition text;
  v_finish_definition text;
begin
  if not has_function_privilege(
    'service_role',
    'public.queue_weekly_digest_generation_job(uuid,uuid,text,text,jsonb,uuid)',
    'EXECUTE'
  ) then
    raise exception 'The service role cannot bootstrap Weekly Digest jobs';
  end if;
  if has_function_privilege(
    'anon',
    'public.queue_weekly_digest_generation_job(uuid,uuid,text,text,jsonb,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous callers must not enqueue Weekly Digest jobs';
  end if;

  select pg_get_functiondef(
    'public.queue_weekly_digest_generation_job(uuid,uuid,text,text,jsonb,uuid)'::regprocedure
  ) into v_queue_definition;
  if position('service_role' in v_queue_definition) = 0
     or position('attempts = case' in v_queue_definition) = 0
     or position('then 0' in v_queue_definition) = 0 then
    raise exception 'Queue RPC does not authorize bootstrap or reset explicit retries';
  end if;

  select pg_get_functiondef(
    'public.finish_weekly_digest_generation_job(uuid,boolean,jsonb,text,uuid)'::regprocedure
  ) into v_finish_definition;
  if position('v_retryable' in v_finish_definition) = 0
     or position('retryable' in v_finish_definition) = 0
     or position('then 5' in v_finish_definition) = 0 then
    raise exception 'Finish RPC does not make deterministic generation failures terminal';
  end if;
end;
$test$;

rollback;
