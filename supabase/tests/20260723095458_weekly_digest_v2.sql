-- Run with `supabase test db` after migrations. Everything is rolled back.

begin;

do $test$
declare
  v_hash_definition text;
  v_save_definition text;
  v_claim_definition text;
begin
  if public.weekly_preflight_at_for_week_end(date '2026-07-25')
       <> timestamptz '2026-07-27 12:45:00+00' then
    raise exception 'Summer Kyiv preflight conversion is incorrect';
  end if;
  if public.weekly_release_at_for_week_end(date '2026-07-25')
       <> timestamptz '2026-07-27 13:00:00+00' then
    raise exception 'Summer Kyiv release conversion is incorrect';
  end if;
  if public.weekly_release_at_for_week_end(date '2026-12-26')
       <> timestamptz '2026-12-28 14:00:00+00' then
    raise exception 'Winter Kyiv release conversion is incorrect';
  end if;

  if (
    select bucket.public
    from storage.buckets bucket
    where bucket.id = 'weekly-digest-private'
  ) is distinct from false then
    raise exception 'weekly-digest-private bucket must remain private';
  end if;

  if has_function_privilege(
    'anon',
    'public.approve_weekly_digest(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute digest approval with override';
  end if;
  if has_function_privilege(
    'anon',
    'public.weekly_digest_artifact_input_hash(uuid,text,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute artifact dependency hashing';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.approve_weekly_digest(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated owners cannot call digest approval';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.initialize_weekly_digest_revision_from_legacy(uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated users can call the service initializer';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.initialize_weekly_digest_revision_from_legacy(uuid)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot call the composer revision initializer';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.claim_weekly_digest_generation_jobs(text[],integer,interval)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot claim generation jobs';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.run_due_weekly_digest_preflights(integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot run the 15:45 preflight gate';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.run_due_weekly_digest_preflights(integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated users can invoke the preflight worker';
  end if;
  if has_table_privilege(
    'anon',
    'public.weekly_digest_generation_jobs',
    'SELECT'
  ) then
    raise exception 'anon has table access to generation jobs';
  end if;
  if has_table_privilege(
    'anon',
    'public.weekly_digest_release_events',
    'SELECT'
  ) then
    raise exception 'anon has table access to release audit events';
  end if;
  if exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename in (
        'weekly_digest_items',
        'social_packages',
        'social_posts'
      )
      and policy.cmd in ('ALL', 'DELETE')
  ) then
    raise exception 'editorial source/social tables expose a broad DELETE RLS policy';
  end if;

  select pg_get_functiondef(
    'public.weekly_digest_artifact_input_hash(uuid,text,text,uuid)'::regprocedure
  ) into v_hash_definition;
  if position('weekly-artifact-input-v2' in v_hash_definition) = 0
     or position('video_script' in v_hash_definition) = 0
     or position('video_manifest' in v_hash_definition) = 0
     or position('story_image' in v_hash_definition) = 0
     or position('video_final' in v_hash_definition) = 0 then
    raise exception 'Artifact dependency hash omits a required visual/video dependency';
  end if;

  select pg_get_functiondef(
    'public.save_weekly_digest_artifact(uuid,uuid,text,text,text,uuid,text,text,jsonb,text,text,text,text,text,text,integer,integer,bigint,integer,jsonb)'::regprocedure
  ) into v_save_definition;
  if position('review_status = ''stale''' in v_save_definition) = 0
     or position('auto_revoked' in v_save_definition) = 0 then
    raise exception 'Artifact replacement does not revoke dependent approvals';
  end if;

  select pg_get_functiondef(
    'public.claim_due_weekly_digests(integer)'::regprocedure
  ) into v_claim_definition;
  if position('publishing_started_at' in v_claim_definition) = 0
     or (
       position('00:15:00' in v_claim_definition) = 0
       and position('15 minutes' in v_claim_definition) = 0
     )
     or position('publishing_retried' in v_claim_definition) = 0 then
    raise exception 'Release claim does not recover stale publishing leases';
  end if;
end;
$test$;

-- Seed one published and one draft pointer as the service worker, then verify
-- that anon RLS exposes only the published immutable revision and artifact.
set local request.jwt.claims = '{"role":"service_role"}';

insert into public.weekly_digests (
  id,
  week_start,
  week_end,
  period_model,
  slug,
  status,
  title_en,
  title_uk
) values
  (
    '10000000-0000-0000-0000-000000000001',
    date '2026-07-19',
    date '2026-07-25',
    'sun_sat',
    'rls-published-weekly-digest',
    'in_review',
    'Published test',
    'Опублікований тест'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    date '2026-07-26',
    date '2026-08-01',
    'sun_sat',
    'rls-draft-weekly-digest',
    'in_review',
    'Draft test',
    'Чернетка тесту'
  );

insert into public.weekly_digest_revisions (
  id,
  weekly_digest_id,
  revision_number,
  title_en,
  title_uk,
  content_hash
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    1,
    'Published test',
    'Опублікований тест',
    'published-hash'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    1,
    'Draft test',
    'Чернетка тесту',
    'draft-hash'
  );

update public.weekly_digests
set active_revision_id = case
      when id = '10000000-0000-0000-0000-000000000001'
        then '20000000-0000-0000-0000-000000000001'::uuid
      else '20000000-0000-0000-0000-000000000002'::uuid
    end,
    published_revision_id = case
      when id = '10000000-0000-0000-0000-000000000001'
        then '20000000-0000-0000-0000-000000000001'::uuid
      else null
    end,
    status = case
      when id = '10000000-0000-0000-0000-000000000001'
        then 'published'
      else 'in_review'
    end,
    published_at = case
      when id = '10000000-0000-0000-0000-000000000001'
        then now()
      else null
    end
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);

insert into public.weekly_digest_artifacts (
  id,
  weekly_digest_id,
  revision_id,
  artifact_type,
  locale,
  slot_key,
  version,
  generation_status,
  review_status,
  input_hash,
  content,
  published_at
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'cover',
    'neutral',
    'cover:neutral',
    1,
    'ready',
    'approved',
    'published-cover',
    '{}'::jsonb,
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'cover',
    'neutral',
    'cover:neutral',
    1,
    'ready',
    'approved',
    'draft-cover',
    '{}'::jsonb,
    null
  );

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $anon$
begin
  if (
    select count(*)
    from public.weekly_digest_revisions
    where id in (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002'
    )
  ) <> 1 then
    raise exception 'anon revision RLS did not follow published_revision_id';
  end if;
  if (
    select count(*)
    from public.weekly_digest_artifacts
    where id in (
      '30000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002'
    )
  ) <> 1 then
    raise exception 'anon artifact RLS exposed a draft or hid the published asset';
  end if;
end;
$anon$;

reset role;
rollback;
