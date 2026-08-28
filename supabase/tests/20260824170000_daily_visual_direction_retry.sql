-- Covers production migration version 20260824170000.
begin;

do $test$
declare
  v_retry_def text;
  v_begin_def text;
  v_finish_def text;
  v_activate_def text;
begin
  if has_function_privilege('anon', 'public.request_daily_visual_direction_retry(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.request_daily_visual_direction_retry(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.request_daily_visual_direction_retry(uuid)', 'EXECUTE') then
    raise exception 'only an authenticated owner session may request a daily visual direction retry';
  end if;

  select pg_get_functiondef('public.request_daily_visual_direction_retry(uuid)'::regprocedure)
    into v_retry_def;
  if position('has_social_role(array[''owner''])' in v_retry_def) = 0
     or position('has_social_aal2()' in v_retry_def) = 0
     or position('retry_count <> 0' in v_retry_def) = 0
     or position('candidate_kind <> ''branded_fallback''' in v_retry_def) = 0
     or position('candidate_kind <> ''direction''' in v_retry_def) = 0 then
    raise exception 'direction retry lost its owner, one-shot, or no-existing-AI-candidate fence';
  end if;
  if position('v_retry_max_micro_usd constant bigint := 84000' in v_retry_def) = 0
     or position('v_day_max_micro_usd constant bigint := 158000' in v_retry_def) = 0
     or position('reservation.status in (''reserved'', ''held_for_reconcile'')' in v_retry_def) = 0 then
    raise exception 'direction retry lost its bounded effective-reservation budget check';
  end if;
  -- The original failed/held direction slot is evidence and capacity. A retry
  -- may read it for the bound, but it must never silently release or rewrite it.
  if position('update public.daily_visual_budget_reservations' in v_retry_def) > 0
     or position('delete from public.daily_visual_budget_reservations' in v_retry_def) > 0 then
    raise exception 'direction retry must preserve the original budget reservation';
  end if;
  if position('retry_source_direction = v_set.direction' in v_retry_def) = 0 then
    raise exception 'direction retry must retain the fallback direction audit before it writes a fresh one';
  end if;

  select pg_get_functiondef('public.begin_daily_visual_finalization(date,text,jsonb,uuid)'::regprocedure)
    into v_begin_def;
  if position('retry_mode text' in v_begin_def) = 0
     or position('v_job.retry_mode' in v_begin_def) = 0 then
    raise exception 'the service worker no longer receives the bounded retry mode in its lease claim';
  end if;

  select pg_get_functiondef('public.finish_daily_visual_job(uuid,uuid,text,text)'::regprocedure)
    into v_finish_def;
  select pg_get_functiondef('public.activate_daily_visual_candidate(uuid,uuid,text,integer,integer,text,text,text,text,uuid,text,uuid)'::regprocedure)
    into v_activate_def;
  if position('retry_mode = null' in v_finish_def) = 0
     or position('retry_mode = null' in v_activate_def) = 0 then
    raise exception 'a consumed bounded retry must clear transient retry_mode on terminal completion';
  end if;
end;
$test$;

rollback;
