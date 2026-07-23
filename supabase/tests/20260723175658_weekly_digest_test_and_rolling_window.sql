-- Run with `supabase test db` after the test-edition and rolling-window migration.

begin;

do $test$
declare
  v_claimed_count integer;
  v_claim_definition text;
  v_test_lock_definition text;
begin
  if public.weekly_preflight_at_for_week_end(date '2026-07-12')
       <> timestamptz '2026-07-13 12:45:00+00' then
    raise exception 'A Sunday rolling window must preflight the following Monday';
  end if;
  if public.weekly_release_at_for_week_end(date '2026-07-16')
       <> timestamptz '2026-07-20 13:00:00+00' then
    raise exception 'A weekday-created test edition must release on the next Monday';
  end if;

  select pg_get_functiondef('public.claim_due_weekly_digests(integer)'::regprocedure)
    into v_claim_definition;
  if position('not digest.is_test' in v_claim_definition) = 0 then
    raise exception 'The weekly release worker does not exclude test editions';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
    into v_test_lock_definition
  from pg_constraint constraint_row
  where constraint_row.conname = 'weekly_digests_test_never_published_check';
  if position('is_test' in coalesce(v_test_lock_definition, '')) = 0
     or position('published' in coalesce(v_test_lock_definition, '')) = 0 then
    raise exception 'A test Weekly Digest does not have a publication lock';
  end if;

  insert into public.weekly_digests (
    id,
    week_start,
    week_end,
    period_model,
    is_test,
    slug,
    status,
    title_en,
    title_uk,
    preflight_at,
    release_at
  ) values (
    '10000000-0000-0000-0000-000000000003',
    date '2026-07-10',
    date '2026-07-16',
    'rolling_7d',
    true,
    'test-weekly-release-lock',
    'scheduled',
    'Test weekly release lock',
    'Тестове блокування випуску',
    now() - interval '16 minutes',
    now() - interval '1 minute'
  );

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select count(*) into v_claimed_count
  from public.claim_due_weekly_digests(5);
  if v_claimed_count <> 0 then
    raise exception 'A due test Weekly Digest was claimed for publication';
  end if;
end;
$test$;

rollback;
