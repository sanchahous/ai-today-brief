-- Covers production migration version 20260822130000.
begin;

do $test$
declare
  v_retry_def text;
begin
  select pg_get_functiondef(
    'public.retry_weekly_digest_generation_job(uuid)'::regprocedure
  ) into v_retry_def;

  if position('resume_from_job_id' in v_retry_def) = 0
     or position('v_source.input - ''resume_from_job_id''' in v_retry_def) = 0 then
    raise exception 'Manual retry must drop a stale resume_from_job_id instead of copying it forward';
  end if;
end;
$test$;

rollback;
