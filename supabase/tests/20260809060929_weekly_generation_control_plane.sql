-- Run with `supabase test db` after weekly_generation_control_plane.
-- Contract tests cover the durable concurrency primitives; application tests
-- cover error classification, progress and ETA presentation.

begin;

do $test$
declare
  v_claim_def text;
  v_legacy_claim_def text;
  v_finish_def text;
  v_reaper_def text;
  v_retry_def text;
  v_checkpoint_def text;
  v_status_check text;
begin
  if to_regclass('public.weekly_digest_generation_attempts') is null
     or to_regclass('public.weekly_digest_generation_events') is null then
    raise exception 'Durable Weekly Digest attempt/event ledger is missing';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.claim_weekly_digest_generation_jobs_v2(text,text[],integer,uuid,uuid,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role must be able to claim fenced generation attempts';
  end if;
  if has_function_privilege(
    'anon',
    'public.claim_weekly_digest_generation_jobs_v2(text,text[],integer,uuid,uuid,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous callers must not claim generation attempts';
  end if;

  select pg_get_functiondef(
    'public.claim_weekly_digest_generation_jobs_v2(text,text[],integer,uuid,uuid,text,text,integer)'::regprocedure
  ) into v_claim_def;
  if position('skip locked' in lower(v_claim_def)) = 0
     or position('lease_token' in v_claim_def) = 0
     or position('attempts < job.max_attempts' in v_claim_def) = 0
     or position('execution_backend = p_backend' in v_claim_def) = 0 then
    raise exception 'Claim RPC must lock competitively, fence leases, cap retries and route by backend';
  end if;

  select pg_get_functiondef(
    'public.claim_weekly_digest_generation_jobs(text[],integer,interval)'::regprocedure
  ) into v_legacy_claim_def;
  if position('execution_backend = ''vercel''' in lower(v_legacy_claim_def)) = 0 then
    raise exception 'Legacy claim RPC must not claim GitHub Actions jobs during additive rollout';
  end if;

  select pg_get_functiondef(
    'public.finish_weekly_digest_generation_attempt(uuid,uuid,boolean,jsonb,text,text,boolean,uuid)'::regprocedure
  ) into v_finish_def;
  if position('current_attempt_id = attempt.id' in v_finish_def) = 0
     or position('retry_scheduled' in v_finish_def) = 0
     or position('weekly_generation_retry_delay' in v_finish_def) = 0 then
    raise exception 'Finish RPC must fence stale workers and schedule bounded retry backoff';
  end if;

  select pg_get_functiondef(
    'public.reap_stale_weekly_digest_generation_attempts(interval)'::regprocedure
  ) into v_reaper_def;
  if position('worker_heartbeat_stale' in v_reaper_def) = 0
     or position('legacy_worker_timeout' in v_reaper_def) = 0
     or position('legacy_recovery_retry_created' in v_reaper_def) = 0
     or position('retry_of_job_id' in v_reaper_def) = 0
     or position('dispatching' in v_reaper_def) = 0 then
    raise exception 'Reaper must terminalize stale workers, create one linked legacy retry and recover a lost dispatch';
  end if;
  if not exists (
    select 1 from cron.job where jobname = 'weekly_digest_generation_reaper'
  ) then
    raise exception 'The stale generation reaper must be scheduled every minute';
  end if;

  select pg_get_functiondef(
    'public.retry_weekly_digest_generation_job(uuid)'::regprocedure
  ) into v_retry_def;
  if position('retry_of_job_id' in v_retry_def) = 0
     or position('manual-retry:' in v_retry_def) = 0 then
    raise exception 'Manual retries must preserve a linked history chain';
  end if;

  select pg_get_functiondef(
    'public.checkpoint_weekly_digest_generation_attempt(uuid,uuid,jsonb,text,integer,integer)'::regprocedure
  ) into v_checkpoint_def;
  if position('current_attempt_id = attempt.id' in v_checkpoint_def) = 0 then
    raise exception 'Checkpoint writes must be fenced by the current lease';
  end if;

  select pg_get_constraintdef(oid) into v_status_check
  from pg_constraint
  where conname = 'weekly_digest_generation_jobs_status_check';
  if position('waiting' in coalesce(v_status_check, '')) = 0
     or position('retry_scheduled' in coalesce(v_status_check, '')) = 0
     or position('dispatching' in coalesce(v_status_check, '')) = 0 then
    raise exception 'Job state machine is missing durable waiting/retry/dispatch states';
  end if;
end;
$test$;

rollback;
