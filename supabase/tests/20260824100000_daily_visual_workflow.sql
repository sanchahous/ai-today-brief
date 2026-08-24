-- Covers production migration version 20260824100000.
begin;

do $test$
begin
  if has_table_privilege('anon', 'public.daily_visual_sets', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_visual_candidates', 'SELECT')
     or has_table_privilege('anon', 'public.daily_visual_candidate_qa', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_visual_selection_events', 'SELECT')
     or has_table_privilege('anon', 'public.daily_visual_budget_reservations', 'SELECT') then
    raise exception 'daily visual prompts, candidates, QA, history, and budget must stay private';
  end if;

  if not has_table_privilege('service_role', 'public.daily_visual_sets', 'SELECT')
     or not has_table_privilege('service_role', 'public.daily_visual_candidates', 'INSERT')
     or not has_table_privilege('service_role', 'public.daily_visual_candidate_qa', 'INSERT') then
    raise exception 'service worker lost required daily visual access';
  end if;

  if not has_table_privilege('service_role', 'public.daily_visual_budget_months', 'SELECT')
     or has_table_privilege('service_role', 'public.daily_visual_budget_months', 'INSERT')
     or has_table_privilege('service_role', 'public.daily_visual_budget_reservations', 'UPDATE') then
    raise exception 'daily visual budget ledger must be read-only outside its fixed-cap RPCs';
  end if;

  if not has_table_privilege('anon', 'public.daily_visual_publications', 'SELECT')
     or not has_table_privilege('authenticated', 'public.daily_visual_publications', 'SELECT') then
    raise exception 'public daily projection must remain readable through its published-only RLS policy';
  end if;

  if has_function_privilege('anon', 'public.begin_daily_visual_finalization(date,text,jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.reserve_daily_visual_budget(date,uuid,text,smallint,bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.reconcile_held_daily_visual_budget(uuid,text,bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.write_daily_visual_worker_set_state(uuid,uuid,uuid,text,jsonb,text,text,text,text,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.finish_daily_visual_job(uuid,uuid,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.activate_daily_visual_candidate(uuid,uuid,text,integer,integer,text,text,text,text,uuid,text,uuid)', 'EXECUTE') then
    raise exception 'daily visual finalization and activation RPCs must not be callable with public keys';
  end if;

  if not has_function_privilege('service_role', 'public.begin_daily_visual_finalization(date,text,jsonb,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.reserve_daily_visual_budget(date,uuid,text,smallint,bigint)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.reconcile_held_daily_visual_budget(uuid,text,bigint)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.write_daily_visual_worker_set_state(uuid,uuid,uuid,text,jsonb,text,text,text,text,text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.finish_daily_visual_job(uuid,uuid,text,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.activate_daily_visual_candidate(uuid,uuid,text,integer,integer,text,text,text,text,uuid,text,uuid)', 'EXECUTE') then
    raise exception 'daily visual service worker lost required RPC access';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'daily-visual-private' and public = false
  ) then
    raise exception 'daily visual source bucket must be private';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_visual_publications'
      and policyname = 'daily visual publications: published read'
  ) then
    raise exception 'daily visual publication must retain a published-only RLS policy';
  end if;
end;
$test$;

do $lease_fence$
declare
  v_direction_set uuid;
  v_direction_job uuid;
  v_direction_claim uuid := gen_random_uuid();
  v_auto_set uuid;
  v_auto_job uuid;
  v_auto_claim uuid := gen_random_uuid();
  v_auto_candidate uuid;
  v_manual_set uuid;
  v_manual_job uuid;
  v_manual_candidate uuid;
  v_budget_set uuid;
  v_reservation uuid;
  v_frozen_result record;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  insert into public.daily_visual_sets (
    editorial_date, source_hash, source_snapshot, status
  ) values (
    date '2099-01-01', repeat('a', 64), '{}'::jsonb, 'rendering'
  ) returning id into v_direction_set;
  insert into public.daily_visual_jobs (
    daily_visual_set_id, source_hash, status, claim_token, lease_expires_at
  ) values (
    v_direction_set, repeat('a', 64), 'running', v_direction_claim, clock_timestamp() + interval '5 minutes'
  ) returning id into v_direction_job;

  if public.write_daily_visual_worker_set_state(
    v_direction_set,
    v_direction_job,
    gen_random_uuid(),
    'direction',
    '{}'::jsonb,
    'Display title',
    'Заголовок',
    'Visual thesis',
    'Візуальна теза'
  ) then
    raise exception 'stale claim token must not write daily visual direction';
  end if;
  if (select direction is not null from public.daily_visual_sets where id = v_direction_set) then
    raise exception 'stale claim token changed daily visual direction';
  end if;
  if not public.write_daily_visual_worker_set_state(
    v_direction_set,
    v_direction_job,
    v_direction_claim,
    'direction',
    '{}'::jsonb,
    'Display title',
    'Заголовок',
    'Visual thesis',
    'Візуальна теза'
  ) then
    raise exception 'live claim token could not write daily visual direction';
  end if;

  if public.finish_daily_visual_job(v_direction_job, gen_random_uuid(), 'failed', 'stale worker') then
    raise exception 'stale claim token must not finish daily visual job';
  end if;
  update public.daily_visual_jobs
  set lease_expires_at = clock_timestamp() - interval '1 second'
  where id = v_direction_job;
  if public.finish_daily_visual_job(v_direction_job, v_direction_claim, 'failed', 'expired worker') then
    raise exception 'expired claim token must not finish daily visual job';
  end if;
  update public.daily_visual_jobs
  set lease_expires_at = clock_timestamp() + interval '5 minutes'
  where id = v_direction_job;
  if public.finish_daily_visual_job(v_direction_job, v_direction_claim, 'failed', 'live worker failure') is not true then
    raise exception 'live claim token could not finish daily visual job';
  end if;
  if (select status from public.daily_visual_jobs where id = v_direction_job) <> 'failed' then
    raise exception 'finish did not persist the fenced job state';
  end if;

  insert into public.daily_visual_sets (
    editorial_date, source_hash, source_snapshot, display_title_en, display_title_uk, status
  ) values (
    date '2099-01-02', repeat('b', 64), '{}'::jsonb, 'Display title', 'Заголовок', 'rendering'
  ) returning id into v_auto_set;
  insert into public.daily_visual_jobs (
    daily_visual_set_id, source_hash, status, claim_token, lease_expires_at
  ) values (
    v_auto_set, repeat('b', 64), 'running', v_auto_claim, clock_timestamp() + interval '5 minutes'
  ) returning id into v_auto_job;
  insert into public.daily_visual_candidates (
    daily_visual_set_id, candidate_kind, storage_bucket, storage_path, sha256, mime_type, width, height, byte_size
  ) values (
    v_auto_set, 'ai_primary', 'daily-visual-private', 'lease-test/auto.webp', repeat('c', 64), 'image/webp', 1600, 900, 100
  ) returning id into v_auto_candidate;
  insert into public.daily_visual_candidate_qa (candidate_id, stage, outcome, report)
  values (v_auto_candidate, 'story_semantic', 'passed', '{}'::jsonb);

  if public.activate_daily_visual_candidate(
    v_auto_set, v_auto_candidate, 'https://example.com/auto.webp', 1600, 900,
    'English alt', 'Український alt', 'auto_qa_pass', null, null, 'service', gen_random_uuid()
  ) then
    raise exception 'stale claim token must not automatically activate a daily visual';
  end if;
  if exists (select 1 from public.daily_visual_publications where editorial_date = date '2099-01-02') then
    raise exception 'stale automatic activation created a public projection';
  end if;
  update public.daily_visual_jobs
  set lease_expires_at = clock_timestamp() - interval '1 second'
  where id = v_auto_job;
  if public.activate_daily_visual_candidate(
    v_auto_set, v_auto_candidate, 'https://example.com/auto.webp', 1600, 900,
    'English alt', 'Український alt', 'auto_qa_pass', null, null, 'service', v_auto_claim
  ) then
    raise exception 'expired claim token must not automatically activate a daily visual';
  end if;
  update public.daily_visual_jobs
  set lease_expires_at = clock_timestamp() + interval '5 minutes'
  where id = v_auto_job;
  if not public.activate_daily_visual_candidate(
    v_auto_set, v_auto_candidate, 'https://example.com/auto.webp', 1600, 900,
    'English alt', 'Український alt', 'auto_qa_pass', null, null, 'service', v_auto_claim
  ) then
    raise exception 'live claim token could not automatically activate a daily visual';
  end if;
  if (select status from public.daily_visual_jobs where id = v_auto_job) <> 'succeeded'
     or (select claim_token from public.daily_visual_jobs where id = v_auto_job) is not null then
    raise exception 'automatic activation must atomically close its lease';
  end if;

  insert into public.daily_visual_sets (
    editorial_date, source_hash, source_snapshot, display_title_en, display_title_uk, status
  ) values (
    date '2099-01-03', repeat('d', 64), '{}'::jsonb, 'Display title', 'Заголовок', 'needs_visual_choice'
  ) returning id into v_manual_set;
  insert into public.daily_visual_jobs (
    daily_visual_set_id, source_hash, status
  ) values (
    v_manual_set, repeat('d', 64), 'needs_visual_choice'
  ) returning id into v_manual_job;
  insert into public.daily_visual_candidates (
    daily_visual_set_id, candidate_kind, storage_bucket, storage_path, sha256, mime_type, width, height, byte_size
  ) values (
    v_manual_set, 'editor_upload', 'daily-visual-private', 'lease-test/manual.webp', repeat('e', 64), 'image/webp', 1600, 900, 100
  ) returning id into v_manual_candidate;

  if not public.activate_daily_visual_candidate(
    v_manual_set, v_manual_candidate, 'https://example.com/manual.webp', 1600, 900,
    'English alt', 'Український alt', 'manual_select', 'editor chose source', null, 'owner'
  ) then
    raise exception 'manual selection must not require a worker claim token';
  end if;
  if (select status from public.daily_visual_jobs where id = v_manual_job) <> 'succeeded' then
    raise exception 'manual selection did not close its unfinished job';
  end if;

  insert into public.daily_visual_sets (editorial_date, source_hash, source_snapshot)
  values (date '2099-01-04', repeat('f', 64), '{}'::jsonb);
  begin
    insert into public.daily_visual_sets (editorial_date, source_hash, source_snapshot)
    values (date '2099-01-04', repeat('0', 64), '{}'::jsonb);
    raise exception 'a daily visual date accepted a replacement source snapshot';
  exception
    when unique_violation then null;
  end;
  select * into v_frozen_result
  from public.begin_daily_visual_finalization(
    date '2099-01-04', repeat('0', 64), '{}'::jsonb, gen_random_uuid()
  );
  if v_frozen_result.should_run
     or v_frozen_result.reason <> 'source_snapshot_frozen'
     or v_frozen_result.daily_visual_set_id is null
     or v_frozen_result.daily_visual_job_id is null
     or v_frozen_result.claim_token is not null then
    raise exception 'an existing daily visual date did not return its frozen source snapshot';
  end if;

  insert into public.daily_visual_sets (editorial_date, source_hash, source_snapshot)
  values (date '2099-01-05', repeat('1', 64), '{}'::jsonb)
  returning id into v_budget_set;
  insert into public.daily_visual_budget_months (
    month_start, cap_micro_usd, reserved_micro_usd, committed_micro_usd
  ) values (
    date '2099-01-01', 5000000, 100, 0
  );
  begin
    perform 1
    from public.reserve_daily_visual_budget(
      date '2099-02-05', v_budget_set, 'direction', 0, 10000
    );
    raise exception 'budget reservation accepted a month that differs from its visual set';
  exception
    when others then
      if sqlerrm not like '%budget date does not match its frozen set%' then raise; end if;
  end;
  begin
    perform 1
    from public.reserve_daily_visual_budget(
      date '2099-01-05', v_budget_set, 'direction', 0, 9999
    );
    raise exception 'budget reservation accepted an under-declared direction ceiling';
  exception
    when others then
      if sqlerrm not like '%invalid daily visual budget reservation%' then raise; end if;
  end;
  insert into public.daily_visual_budget_reservations (
    month_start, daily_visual_set_id, candidate_kind, attempt_number,
    max_cost_micro_usd, status
  ) values (
    date '2099-01-01', v_budget_set, 'ai_primary', 0, 100, 'held_for_reconcile'
  ) returning id into v_reservation;
  if not public.reconcile_held_daily_visual_budget(v_reservation, 'committed', 80) then
    raise exception 'held daily visual reservation could not be reconciled';
  end if;
  if (select reserved_micro_usd from public.daily_visual_budget_months where month_start = date '2099-01-01') <> 0
     or (select committed_micro_usd from public.daily_visual_budget_months where month_start = date '2099-01-01') <> 80 then
    raise exception 'held reservation reconciliation did not move monthly counters once';
  end if;
  if public.reconcile_held_daily_visual_budget(v_reservation, 'released') then
    raise exception 'reconciled reservation changed monthly counters twice';
  end if;
end;
$lease_fence$;

rollback;
