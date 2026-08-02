-- Run with `supabase test db` after Weekly Content Studio v2 migration.

begin;

select plan(22);

select has_table('public', 'weekly_locale_map', 'weekly locale configuration exists');
select has_table(
  'public',
  'weekly_digest_engagement_events',
  'first-party weekly engagement table exists'
);
select has_column(
  'public',
  'social_posts',
  'content_parts',
  'social posts preserve native multi-part content'
);
select has_column(
  'public',
  'weekly_digest_engagement_events',
  'session_hash',
  'engagement sessions are stored only as hashes'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weekly_digest_engagement_events'
      and column_name in ('ip', 'raw_ip', 'user_agent', 'ua')
  ),
  'engagement schema stores neither raw IP nor user-agent'
);
select is(
  (select count(*)::integer from public.weekly_locale_map where enabled and is_default),
  6,
  'all six channels have a default locale'
);
select is(
  (select locale from public.weekly_locale_map where channel = 'threads' and is_default),
  'uk',
  'Threads starts in Ukrainian'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weekly_locale_map'::regclass),
  'locale map has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weekly_digest_engagement_events'::regclass),
  'engagement events have RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.weekly_digest_engagement_events', 'SELECT'),
  'anonymous users cannot read first-party engagement events'
);
select ok(
  has_table_privilege('service_role', 'public.weekly_digest_engagement_events', 'INSERT'),
  'service endpoint can insert first-party engagement events'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.weekly_digest_engagement_events'::regclass
      and pg_get_constraintdef(oid) like '%signup_complete%'
  ),
  'engagement events distinguish completed signups from subscribe clicks'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.edit_weekly_social_post_v2(uuid,integer,text,jsonb,text,text,timestamptz,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated CMS editors can call the multi-part edit RPC subject to its admin gate'
);
select ok(
  not has_function_privilege('anon', 'public.enforce_weekly_social_locale()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.guard_social_content_approval()', 'EXECUTE'),
  'trigger helpers are not callable API surface'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.resume_weekly_threads_sequence(uuid)',
    'EXECUTE'
  ) and not has_function_privilege(
    'anon',
    'public.resume_weekly_threads_sequence(uuid)',
    'EXECUTE'
  ),
  'only authenticated callers can reach the owner-gated Threads resume RPC'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.weekly_digest_artifacts'::regclass
      and conname = 'weekly_digest_artifacts_artifact_type_check'
      and pg_get_constraintdef(oid) like '%research_pack%'
      and pg_get_constraintdef(oid) like '%content_quality_report%'
  ),
  'artifact constraint accepts research and quality reports'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.weekly_digest_generation_jobs'::regclass
      and conname = 'weekly_digest_generation_jobs_job_type_check'
      and pg_get_constraintdef(oid) like '%editorial_master%'
      and pg_get_constraintdef(oid) like '%social_copy%'
      and pg_get_constraintdef(oid) like '%research_pack%'
  ),
  'job constraint accepts Content Studio v2 stages'
);
select ok(
  pg_get_functiondef(
    'public.queue_weekly_digest_generation_job(uuid,uuid,text,text,jsonb,uuid)'::regprocedure
  ) like '%''research_pack''%'
  and pg_get_functiondef(
    'public.queue_weekly_digest_generation_job(uuid,uuid,text,text,jsonb,uuid)'::regprocedure
  ) like '%''editorial_master''%'
  and pg_get_functiondef(
    'public.queue_weekly_digest_generation_job(uuid,uuid,text,text,jsonb,uuid)'::regprocedure
  ) like '%''social_copy''%',
  'queue RPC accepts every Content Studio v2 stage'
);
select ok(
  pg_get_functiondef(
    'public.claim_weekly_digest_generation_jobs(text[],integer,interval)'::regprocedure
  ) not like '%job.locale%'
  and pg_get_functiondef(
    'public.claim_weekly_digest_generation_jobs(text[],integer,interval)'::regprocedure
  ) like '%job.input ->> ''locale''%',
  'claim RPC reads the PDF locale from durable job input'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.weekly_digests'::regclass
      and tgname = 'weekly_content_studio_release_guard'
      and not tgisinternal
  ),
  'shadow and incomplete v2 revisions are blocked at the release boundary'
);

select is(
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'weekly_digest_engagement_revision_idx',
        'weekly_digest_engagement_social_post_idx',
        'weekly_digest_engagement_story_idx',
        'weekly_locale_map_updated_by_idx'
      )
  ),
  4::bigint,
  'Content Studio v2 foreign keys have covering indexes'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_locale_map'
      and 'authenticated' = any (roles)
      and cmd in ('SELECT', 'ALL')
  ),
  1::bigint,
  'locale map has one permissive authenticated SELECT path'
);

select * from finish();
rollback;
