begin;

-- Weekly Digest v2 separates editorial approval from release, keeps immutable
-- content revisions, and makes every generated deliverable independently
-- reviewable. Existing Monday-Sunday editions remain historically accurate and
-- are backfilled as legacy revisions below.

-- ── Role helpers ───────────────────────────────────────────────────────────

create or replace function public.social_admin_role()
returns text
language sql
stable
security invoker
set search_path = public
as $function$
  select admin.role
  from public.social_admins admin
  where admin.user_id = (select auth.uid())
    and admin.enabled
  limit 1
$function$;

create or replace function public.has_social_role(p_roles text[])
returns boolean
language sql
stable
security invoker
set search_path = public
as $function$
  select coalesce(public.social_admin_role() = any(coalesce(p_roles, '{}'::text[])), false)
$function$;

revoke all on function public.social_admin_role() from public, anon, authenticated, service_role;
revoke all on function public.has_social_role(text[]) from public, anon, authenticated, service_role;
grant execute on function public.social_admin_role() to authenticated, service_role;
grant execute on function public.has_social_role(text[]) to authenticated, service_role;

-- ── Edition lifecycle and calendar model ───────────────────────────────────

alter table public.weekly_digests
  add column if not exists week_end date,
  add column if not exists period_model text,
  add column if not exists preflight_at timestamptz,
  add column if not exists preflight_checked_at timestamptz,
  add column if not exists release_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists publishing_started_at timestamptz,
  add column if not exists last_error text,
  add column if not exists preflight_override jsonb,
  add column if not exists preflight_override_by uuid references auth.users(id) on delete set null,
  add column if not exists preflight_override_at timestamptz,
  add column if not exists active_revision_id uuid,
  add column if not exists published_revision_id uuid;

-- All rows that predate this migration were composed as Monday-Sunday weeks.
update public.weekly_digests
set period_model = 'legacy_mon_sun',
    week_end = week_start + 6
where period_model is null
   or week_end is null;

alter table public.weekly_digests
  alter column period_model set default 'sun_sat',
  alter column period_model set not null,
  alter column week_end set not null,
  drop constraint if exists weekly_digests_status_check,
  add constraint weekly_digests_status_check check (
    status in (
      'draft',
      'in_review',
      'changes_requested',
      'approved',
      'scheduled',
      'publishing',
      'published',
      'failed',
      'paused',
      'cancelled'
    )
  ),
  drop constraint if exists weekly_digests_period_model_check,
  add constraint weekly_digests_period_model_check
    check (period_model in ('legacy_mon_sun', 'sun_sat')),
  drop constraint if exists weekly_digests_seven_day_period_check,
  add constraint weekly_digests_seven_day_period_check
    check (week_end = week_start + 6),
  drop constraint if exists weekly_digests_sunday_start_check,
  add constraint weekly_digests_sunday_start_check check (
    period_model = 'legacy_mon_sun'
    or extract(dow from week_start) = 0
  ),
  drop constraint if exists weekly_digests_error_length_check,
  add constraint weekly_digests_error_length_check
    check (last_error is null or char_length(last_error) <= 2000),
  drop constraint if exists weekly_digests_preflight_override_check,
  add constraint weekly_digests_preflight_override_check check (
    (
      preflight_override is null
      and preflight_override_by is null
      and preflight_override_at is null
    )
    or (
      jsonb_typeof(preflight_override) = 'object'
      and preflight_override_by is not null
      and preflight_override_at is not null
    )
  );

create or replace function public.weekly_preflight_at_for_week_end(p_week_end date)
returns timestamptz
language sql
immutable
set search_path = ''
as $function$
  select ((p_week_end + 2) + time '15:45') at time zone 'Europe/Kyiv'
$function$;

create or replace function public.weekly_release_at_for_week_end(p_week_end date)
returns timestamptz
language sql
immutable
set search_path = ''
as $function$
  select ((p_week_end + 2) + time '16:00') at time zone 'Europe/Kyiv'
$function$;

revoke all on function public.weekly_preflight_at_for_week_end(date)
  from public, anon, authenticated, service_role;
revoke all on function public.weekly_release_at_for_week_end(date)
  from public, anon, authenticated, service_role;
grant execute on function public.weekly_preflight_at_for_week_end(date)
  to authenticated, service_role;
grant execute on function public.weekly_release_at_for_week_end(date)
  to authenticated, service_role;

create or replace function public.set_weekly_digest_calendar_defaults()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.period_model = 'sun_sat' then
    if new.preflight_at is null then
      new.preflight_at := public.weekly_preflight_at_for_week_end(new.week_end);
    end if;
    if new.release_at is null then
      new.release_at := public.weekly_release_at_for_week_end(new.week_end);
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists weekly_digests_calendar_defaults on public.weekly_digests;
create trigger weekly_digests_calendar_defaults
  before insert or update of week_end, period_model, preflight_at, release_at
  on public.weekly_digests
  for each row execute function public.set_weekly_digest_calendar_defaults();

-- ── Immutable editorial revisions ─────────────────────────────────────────

create table if not exists public.weekly_digest_revisions (
  id                 uuid primary key default gen_random_uuid(),
  weekly_digest_id   uuid not null references public.weekly_digests(id) on delete cascade,
  revision_number    integer not null check (revision_number > 0),
  selection_run_id   uuid references public.weekly_digest_selection_runs(id) on delete set null,
  title_en           text not null,
  title_uk           text not null,
  intro_en           text,
  intro_uk           text,
  editor_note_en     text,
  editor_note_uk     text,
  key_takeaways_en   jsonb not null default '[]'::jsonb
                       check (jsonb_typeof(key_takeaways_en) = 'array'),
  key_takeaways_uk   jsonb not null default '[]'::jsonb
                       check (jsonb_typeof(key_takeaways_uk) = 'array'),
  content_hash       text not null,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (weekly_digest_id, revision_number)
);

create index if not exists weekly_digest_revisions_digest_created_idx
  on public.weekly_digest_revisions (weekly_digest_id, revision_number desc);

create table if not exists public.weekly_digest_revision_items (
  id                 uuid primary key default gen_random_uuid(),
  revision_id        uuid not null references public.weekly_digest_revisions(id) on delete cascade,
  brief_item_id      uuid references public.brief_items(id) on delete set null,
  rank               smallint not null check (rank between 1 and 7),
  title_en           text not null,
  title_uk           text not null,
  summary_en         text not null,
  summary_uk         text not null,
  body_en            text not null,
  body_uk            text not null,
  why_en             text,
  why_uk             text,
  practical_en       text,
  practical_uk       text,
  takeaway_en        text,
  takeaway_uk        text,
  event_date         date,
  sources            jsonb not null default '[]'::jsonb
                       check (jsonb_typeof(sources) = 'array'),
  source_snapshot    jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(source_snapshot) = 'object'),
  created_at         timestamptz not null default now(),
  unique (revision_id, rank)
);

create unique index if not exists weekly_digest_revision_items_source_uniq
  on public.weekly_digest_revision_items (revision_id, brief_item_id)
  where brief_item_id is not null;
create index if not exists weekly_digest_revision_items_revision_rank_idx
  on public.weekly_digest_revision_items (revision_id, rank);

-- Backfill every existing edition before making the new revision pointers
-- authoritative. Do not rewrite legacy dates or slugs.
insert into public.weekly_digest_revisions (
  weekly_digest_id,
  revision_number,
  title_en,
  title_uk,
  intro_en,
  intro_uk,
  content_hash
)
select
  digest.id,
  1,
  digest.title_en,
  digest.title_uk,
  digest.intro_en,
  digest.intro_uk,
  md5(
    jsonb_build_object(
      'legacy', true,
      'digest_id', digest.id,
      'updated_at', digest.updated_at,
      'title_en', digest.title_en,
      'title_uk', digest.title_uk,
      'intro_en', digest.intro_en,
      'intro_uk', digest.intro_uk
    )::text
  )
from public.weekly_digests digest
where not exists (
  select 1
  from public.weekly_digest_revisions revision
  where revision.weekly_digest_id = digest.id
);

insert into public.weekly_digest_revision_items (
  revision_id,
  brief_item_id,
  rank,
  title_en,
  title_uk,
  summary_en,
  summary_uk,
  body_en,
  body_uk,
  why_en,
  why_uk,
  event_date,
  sources,
  source_snapshot
)
select
  revision.id,
  item.brief_item_id,
  item.rank,
  coalesce(nullif(item.snapshot ->> 'title_en', ''), digest.title_en),
  coalesce(nullif(item.snapshot ->> 'title_uk', ''), digest.title_uk),
  coalesce(item.snapshot ->> 'summary_en', ''),
  coalesce(item.snapshot ->> 'summary_uk', ''),
  coalesce(nullif(item.snapshot ->> 'body_en', ''), item.snapshot ->> 'summary_en', ''),
  coalesce(nullif(item.snapshot ->> 'body_uk', ''), item.snapshot ->> 'summary_uk', ''),
  nullif(item.snapshot ->> 'why_en', ''),
  nullif(item.snapshot ->> 'why_uk', ''),
  nullif(item.snapshot ->> 'brief_date', '')::date,
  case
    when nullif(item.snapshot #>> '{editorial_selection,source_url}', '') is null
      then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'name', coalesce(item.snapshot #>> '{editorial_selection,source_name}', 'Source'),
      'url', item.snapshot #>> '{editorial_selection,source_url}'
    ))
  end,
  item.snapshot
from public.weekly_digest_items item
join public.weekly_digests digest on digest.id = item.weekly_digest_id
join public.weekly_digest_revisions revision
  on revision.weekly_digest_id = digest.id
 and revision.revision_number = 1
where not exists (
  select 1
  from public.weekly_digest_revision_items revision_item
  where revision_item.revision_id = revision.id
    and revision_item.brief_item_id = item.brief_item_id
);

update public.weekly_digests digest
set active_revision_id = revision.id,
    published_revision_id = case when digest.status = 'published' then revision.id else null end
from public.weekly_digest_revisions revision
where revision.weekly_digest_id = digest.id
  and revision.revision_number = 1
  and digest.active_revision_id is null;

alter table public.weekly_digests
  drop constraint if exists weekly_digests_active_revision_id_fkey,
  add constraint weekly_digests_active_revision_id_fkey
    foreign key (active_revision_id)
    references public.weekly_digest_revisions(id)
    on delete set null,
  drop constraint if exists weekly_digests_published_revision_id_fkey,
  add constraint weekly_digests_published_revision_id_fkey
    foreign key (published_revision_id)
    references public.weekly_digest_revisions(id)
    on delete set null,
  drop constraint if exists weekly_digests_published_pointer_check,
  add constraint weekly_digests_published_pointer_check check (
    status <> 'published'
    or (published_at is not null and published_revision_id is not null)
  );

alter table public.weekly_digest_reviews
  add column if not exists revision_id uuid
    references public.weekly_digest_revisions(id) on delete set null;

create index if not exists weekly_digest_reviews_revision_created_idx
  on public.weekly_digest_reviews (revision_id, created_at desc)
  where revision_id is not null;

-- Content rows are append-only. Generated artifact state remains mutable below.
create or replace function public.reject_weekly_digest_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$function$;

drop trigger if exists weekly_digest_revisions_immutable on public.weekly_digest_revisions;
create trigger weekly_digest_revisions_immutable
  before update or delete on public.weekly_digest_revisions
  for each row execute function public.reject_weekly_digest_immutable_mutation();

drop trigger if exists weekly_digest_revision_items_immutable
  on public.weekly_digest_revision_items;
create trigger weekly_digest_revision_items_immutable
  before update or delete on public.weekly_digest_revision_items
  for each row execute function public.reject_weekly_digest_immutable_mutation();

-- ── Versioned artifacts, reviews, jobs and release audit ───────────────────

create table if not exists public.weekly_digest_artifacts (
  id                 uuid primary key default gen_random_uuid(),
  weekly_digest_id   uuid not null references public.weekly_digests(id) on delete cascade,
  revision_id        uuid not null references public.weekly_digest_revisions(id) on delete cascade,
  revision_item_id   uuid references public.weekly_digest_revision_items(id) on delete cascade,
  artifact_type      text not null check (artifact_type in (
                         'article',
                         'pdf',
                         'cover',
                         'story_image',
                         'video_script',
                         'video_manifest',
                         'video_preview',
                         'video_final',
                         'captions',
                         'thumbnail',
                         'heygen_preview',
                         'graphics_preview',
                         'social_asset'
                       )),
  locale             text not null default 'neutral'
                       check (locale in ('neutral', 'en', 'uk')),
  slot_key           text not null,
  version            integer not null check (version > 0),
  is_current         boolean not null default true,
  generation_status text not null default 'ready'
                       check (generation_status in ('queued', 'generating', 'ready', 'failed')),
  review_status      text not null default 'in_review'
                       check (review_status in (
                         'draft',
                         'in_review',
                         'changes_requested',
                         'approved',
                         'stale'
                       )),
  input_hash         text not null,
  content            jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(content) = 'object'),
  storage_bucket     text,
  storage_path       text,
  external_url       text,
  provider           text,
  provider_id        text,
  mime_type          text,
  width              integer check (width is null or width > 0),
  height             integer check (height is null or height > 0),
  byte_size          bigint check (byte_size is null or byte_size >= 0),
  duration_seconds   integer check (duration_seconds is null or duration_seconds > 0),
  metadata           jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(metadata) = 'object'),
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  published_at       timestamptz,
  check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket is not null and storage_path is not null)
  ),
  unique (revision_id, slot_key, version)
);

create unique index if not exists weekly_digest_artifacts_current_slot_uniq
  on public.weekly_digest_artifacts (revision_id, slot_key)
  where is_current;
create index if not exists weekly_digest_artifacts_digest_revision_idx
  on public.weekly_digest_artifacts (weekly_digest_id, revision_id, artifact_type, locale);
create index if not exists weekly_digest_artifacts_item_idx
  on public.weekly_digest_artifacts (revision_item_id, artifact_type)
  where revision_item_id is not null;

create table if not exists public.weekly_digest_artifact_reviews (
  id                 uuid primary key default gen_random_uuid(),
  artifact_id        uuid not null references public.weekly_digest_artifacts(id) on delete cascade,
  reviewer_id        uuid references auth.users(id) on delete set null,
  action             text not null check (action in (
                         'generated',
                         'edited',
                         'approved',
                         'changes_requested',
                         'changes_addressed',
                         'revoked',
                         'carried_forward',
                         'commented'
                       )),
  note               text,
  artifact_snapshot  jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(artifact_snapshot) = 'object'),
  created_at         timestamptz not null default now(),
  check (note is null or char_length(note) <= 2000)
);

create index if not exists weekly_digest_artifact_reviews_artifact_created_idx
  on public.weekly_digest_artifact_reviews (artifact_id, created_at desc);

create table if not exists public.weekly_digest_generation_jobs (
  id                 uuid primary key default gen_random_uuid(),
  weekly_digest_id   uuid not null references public.weekly_digests(id) on delete cascade,
  revision_id        uuid not null references public.weekly_digest_revisions(id) on delete cascade,
  artifact_id        uuid references public.weekly_digest_artifacts(id) on delete set null,
  job_type           text not null check (job_type in (
                         'article',
                         'pdf',
                         'cover',
                         'story_image',
                         'social_asset',
                         'video_manifest',
                         'artifact_promotion'
                       )),
  idempotency_key    text not null unique,
  status             text not null default 'queued'
                       check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts           integer not null default 0 check (attempts >= 0),
  input              jsonb not null default '{}'::jsonb,
  output             jsonb not null default '{}'::jsonb,
  last_error         text,
  locked_at          timestamptz,
  started_at         timestamptz,
  finished_at        timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (jsonb_typeof(input) = 'object'),
  check (jsonb_typeof(output) = 'object'),
  check (last_error is null or char_length(last_error) <= 2000)
);

create index if not exists weekly_digest_generation_jobs_claim_idx
  on public.weekly_digest_generation_jobs (status, created_at)
  where status in ('queued', 'failed');

create table if not exists public.weekly_digest_release_events (
  id                 bigint generated always as identity primary key,
  weekly_digest_id   uuid not null references public.weekly_digests(id) on delete cascade,
  revision_id        uuid references public.weekly_digest_revisions(id) on delete set null,
  actor_id           uuid references auth.users(id) on delete set null,
  event_type         text not null check (event_type in (
                         'revision_created',
                         'artifact_saved',
                         'artifact_reviewed',
                         'generation_queued',
                         'generation_started',
                         'generation_succeeded',
                         'generation_failed',
                         'preflight_passed',
                         'preflight_failed',
                         'approved',
                         'scheduled',
                         'publishing_started',
                         'publishing_retried',
                         'published',
                         'failed',
                         'paused',
                         'resumed',
                         'override'
                       )),
  payload            jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(payload) = 'object'),
  created_at         timestamptz not null default now()
);

create index if not exists weekly_digest_release_events_digest_created_idx
  on public.weekly_digest_release_events (weekly_digest_id, created_at desc);

drop trigger if exists weekly_digest_artifact_reviews_immutable
  on public.weekly_digest_artifact_reviews;
create trigger weekly_digest_artifact_reviews_immutable
  before update or delete on public.weekly_digest_artifact_reviews
  for each row execute function public.reject_weekly_digest_immutable_mutation();

drop trigger if exists weekly_digest_release_events_immutable
  on public.weekly_digest_release_events;
create trigger weekly_digest_release_events_immutable
  before update or delete on public.weekly_digest_release_events
  for each row execute function public.reject_weekly_digest_immutable_mutation();

drop trigger if exists weekly_digest_reviews_immutable
  on public.weekly_digest_reviews;
create trigger weekly_digest_reviews_immutable
  before update or delete on public.weekly_digest_reviews
  for each row execute function public.reject_weekly_digest_immutable_mutation();

drop trigger if exists weekly_digest_review_items_immutable
  on public.weekly_digest_review_items;
create trigger weekly_digest_review_items_immutable
  before update or delete on public.weekly_digest_review_items
  for each row execute function public.reject_weekly_digest_immutable_mutation();

drop trigger if exists weekly_digest_selection_runs_immutable
  on public.weekly_digest_selection_runs;
create trigger weekly_digest_selection_runs_immutable
  before update or delete on public.weekly_digest_selection_runs
  for each row execute function public.reject_weekly_digest_immutable_mutation();

drop trigger if exists social_post_reviews_immutable
  on public.social_post_reviews;
create trigger social_post_reviews_immutable
  before update or delete on public.social_post_reviews
  for each row execute function public.reject_weekly_digest_immutable_mutation();

drop trigger if exists weekly_digest_artifacts_set_updated_at
  on public.weekly_digest_artifacts;
create trigger weekly_digest_artifacts_set_updated_at
  before update on public.weekly_digest_artifacts
  for each row execute function extensions.moddatetime(updated_at);

drop trigger if exists weekly_digest_generation_jobs_set_updated_at
  on public.weekly_digest_generation_jobs;
create trigger weekly_digest_generation_jobs_set_updated_at
  before update on public.weekly_digest_generation_jobs
  for each row execute function extensions.moddatetime(updated_at);

-- ── Social package linkage and channel disable audit ───────────────────────

alter table public.social_packages
  add column if not exists weekly_digest_revision_id uuid
    references public.weekly_digest_revisions(id) on delete set null;

create index if not exists social_packages_weekly_revision_idx
  on public.social_packages (weekly_digest_revision_id)
  where weekly_digest_revision_id is not null;

alter table public.social_posts
  add column if not exists publish_enabled boolean not null default true,
  add column if not exists disabled_by uuid references auth.users(id) on delete set null,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text;

alter table public.social_posts
  drop constraint if exists social_posts_publish_enabled_audit_check,
  add constraint social_posts_publish_enabled_audit_check check (
    (
      publish_enabled
      and disabled_by is null
      and disabled_at is null
      and disabled_reason is null
    )
    or (
      not publish_enabled
      and disabled_by is not null
      and disabled_at is not null
      and char_length(btrim(coalesce(disabled_reason, ''))) between 10 and 500
    )
  );

alter table public.social_post_reviews
  drop constraint if exists social_post_reviews_action_check,
  add constraint social_post_reviews_action_check check (
    action in (
      'generated',
      'edited',
      'approved',
      'rejected',
      'scheduled',
      'cancelled',
      'auto_revoked',
      'commented'
    )
  );

-- The product contract is exactly one locale per channel. Keep the existing
-- unique(package_id, channel) index; a package/channel/locale index would allow
-- accidental bilingual duplicates.
create or replace function public.enforce_weekly_social_locale()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_kind text;
  v_expected_locale text;
begin
  if new.package_id is null then
    return new;
  end if;

  select package.kind
    into v_kind
  from public.social_packages package
  where package.id = new.package_id;

  if v_kind <> 'weekly_digest' then
    return new;
  end if;

  v_expected_locale := case
    when new.channel in ('telegram', 'facebook') then 'uk'
    when new.channel in ('linkedin', 'x', 'threads', 'instagram') then 'en'
    else null
  end;

  if v_expected_locale is null or new.locale is distinct from v_expected_locale then
    raise exception 'Weekly digest channel % requires locale %', new.channel, v_expected_locale
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists social_posts_weekly_locale_guard on public.social_posts;
create trigger social_posts_weekly_locale_guard
  before insert or update of package_id, channel, locale
  on public.social_posts
  for each row execute function public.enforce_weekly_social_locale();

create or replace function public.set_weekly_social_publish_enabled(
  p_social_post_id uuid,
  p_enabled boolean,
  p_reason text default null
)
returns public.social_posts
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_post public.social_posts;
begin
  if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
    raise exception 'AAL2 owner session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_social_action', 'allowed', true);
  if not p_enabled
     and char_length(btrim(coalesce(p_reason, ''))) not between 10 and 500 then
    raise exception 'A disable reason must contain 10 to 500 characters';
  end if;

  update public.social_posts post
  set publish_enabled = p_enabled,
      disabled_by = case when p_enabled then null else auth.uid() end,
      disabled_at = case when p_enabled then null else now() end,
      disabled_reason = case when p_enabled then null else btrim(p_reason) end,
      status = case
        when p_enabled then 'in_review'
        when post.status in ('publishing', 'posted') then post.status
        else 'cancelled'
      end,
      approval_version = case when p_enabled then null else post.approval_version end,
      approved_by = case when p_enabled then null else post.approved_by end,
      approved_at = case when p_enabled then null else post.approved_at end
  where post.id = p_social_post_id
    and exists (
      select 1
      from public.social_packages package
      where package.id = post.package_id
        and package.kind = 'weekly_digest'
    )
    and post.status not in ('publishing', 'posted')
  returning post.* into v_post;

  if v_post.id is null then
    raise exception 'Editable weekly social variant was not found';
  end if;
  return v_post;
end;
$function$;

-- ── Artifact dependency hashes ─────────────────────────────────────────────

create or replace function public.weekly_digest_artifact_input_hash(
  p_revision_id uuid,
  p_artifact_type text,
  p_locale text,
  p_revision_item_id uuid default null
)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
  v_revision public.weekly_digest_revisions;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb := null;
  v_dependencies jsonb := '[]'::jsonb;
  v_payload jsonb;
begin
  select revision.*
    into v_revision
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id;
  if v_revision.id is null then
    raise exception 'Weekly digest revision was not found';
  end if;

  if p_revision_item_id is not null then
    select to_jsonb(item) - 'created_at'
      into v_item
    from public.weekly_digest_revision_items item
    where item.id = p_revision_item_id
      and item.revision_id = p_revision_id;
    if v_item is null then
      raise exception 'Revision item was not found';
    end if;
  end if;

  if p_locale = 'en' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'rank', item.rank,
        'title', item.title_en,
        'summary', item.summary_en,
        'body', item.body_en,
        'why', item.why_en,
        'practical', item.practical_en,
        'takeaway', item.takeaway_en,
        'sources', item.sources
      )
      order by item.rank
    ), '[]'::jsonb)
      into v_items
    from public.weekly_digest_revision_items item
    where item.revision_id = p_revision_id;
  elsif p_locale = 'uk' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'rank', item.rank,
        'title', item.title_uk,
        'summary', item.summary_uk,
        'body', item.body_uk,
        'why', item.why_uk,
        'practical', item.practical_uk,
        'takeaway', item.takeaway_uk,
        'sources', item.sources
      )
      order by item.rank
    ), '[]'::jsonb)
      into v_items
    from public.weekly_digest_revision_items item
    where item.revision_id = p_revision_id;
  else
    select coalesce(jsonb_agg(to_jsonb(item) - 'created_at' order by item.rank), '[]'::jsonb)
      into v_items
    from public.weekly_digest_revision_items item
    where item.revision_id = p_revision_id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'artifact_type', dependency.artifact_type,
      'slot_key', dependency.slot_key,
      'locale', dependency.locale,
      'version', dependency.version,
      'input_hash', dependency.input_hash,
      'content_hash', md5(dependency.content::text),
      'external_url', dependency.external_url,
      'provider_id', dependency.provider_id
    )
    order by dependency.artifact_type, dependency.slot_key
  ), '[]'::jsonb)
    into v_dependencies
  from public.weekly_digest_artifacts dependency
  where dependency.revision_id = p_revision_id
    and dependency.is_current
    and (
      (p_artifact_type = 'cover'
        and dependency.artifact_type = 'story_image')
      or (p_artifact_type = 'pdf'
        and dependency.artifact_type in ('cover', 'story_image', 'video_final'))
      or (p_artifact_type = 'social_asset'
        and dependency.artifact_type in ('cover', 'story_image'))
      or (p_artifact_type = 'video_manifest'
        and dependency.artifact_type in ('video_script', 'story_image'))
      or (p_artifact_type in (
          'video_preview',
          'video_final',
          'heygen_preview',
          'graphics_preview'
        )
        and dependency.artifact_type in (
          'video_script',
          'video_manifest',
          'story_image'
        ))
      or (p_artifact_type in ('captions', 'thumbnail')
        and dependency.artifact_type in (
          'video_script',
          'video_manifest',
          'video_final'
        ))
    );

  v_payload := jsonb_build_object(
    'schema', 'weekly-artifact-input-v2',
    'artifact_type', p_artifact_type,
    'locale', p_locale,
    'revision_item', v_item,
    'dependencies', v_dependencies
  );

  if p_artifact_type = 'story_image' then
    v_payload := v_payload || jsonb_build_object('item', v_item);
  elsif p_artifact_type in ('article', 'pdf', 'captions') then
    v_payload := v_payload || jsonb_build_object(
      'title', case when p_locale = 'uk' then v_revision.title_uk else v_revision.title_en end,
      'intro', case when p_locale = 'uk' then v_revision.intro_uk else v_revision.intro_en end,
      'editor_note', case
        when p_locale = 'uk' then v_revision.editor_note_uk
        else v_revision.editor_note_en
      end,
      'takeaways', case
        when p_locale = 'uk' then v_revision.key_takeaways_uk
        else v_revision.key_takeaways_en
      end,
      'items', v_items
    );
  elsif p_artifact_type in (
    'video_script',
    'video_manifest',
    'video_preview',
    'video_final',
    'heygen_preview',
    'graphics_preview'
  ) then
    v_payload := v_payload || jsonb_build_object(
      'title', v_revision.title_en,
      'intro', v_revision.intro_en,
      'items', v_items
    );
  else
    v_payload := v_payload || jsonb_build_object(
      'title_en', v_revision.title_en,
      'title_uk', v_revision.title_uk,
      'intro_en', v_revision.intro_en,
      'intro_uk', v_revision.intro_uk,
      'takeaways_en', v_revision.key_takeaways_en,
      'takeaways_uk', v_revision.key_takeaways_uk,
      'items', v_items
    );
  end if;

  return md5(v_payload::text);
end;
$function$;

revoke all on function public.weekly_digest_artifact_input_hash(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.weekly_digest_artifact_input_hash(uuid, text, text, uuid)
  to authenticated, service_role;

-- ── Transactional revision and artifact writes ─────────────────────────────

create or replace function public.create_weekly_digest_revision(
  p_weekly_digest_id uuid,
  p_title_en text,
  p_title_uk text,
  p_intro_en text,
  p_intro_uk text,
  p_editor_note_en text,
  p_editor_note_uk text,
  p_key_takeaways_en jsonb,
  p_key_takeaways_uk jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_previous_revision_id uuid;
  v_revision_id uuid;
  v_revision_number integer;
  v_selection_run_id uuid;
  v_content_hash text;
  v_carried_count integer := 0;
  v_invalidated_slots jsonb := '[]'::jsonb;
begin
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title_en, ''))) = 0
     or char_length(btrim(coalesce(p_title_uk, ''))) = 0 then
    raise exception 'Both revision titles are required';
  end if;
  if jsonb_typeof(coalesce(p_key_takeaways_en, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_key_takeaways_uk, '[]'::jsonb)) <> 'array' then
    raise exception 'Key takeaways must be arrays';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) not between 3 and 7 then
    raise exception 'A weekly digest revision must contain 3 to 7 stories';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object'
      or char_length(btrim(coalesce(item ->> 'title_en', ''))) = 0
      or char_length(btrim(coalesce(item ->> 'title_uk', ''))) = 0
      or char_length(btrim(coalesce(item ->> 'summary_en', ''))) = 0
      or char_length(btrim(coalesce(item ->> 'summary_uk', ''))) = 0
      or (
        item ? 'sources'
        and jsonb_typeof(item -> 'sources') <> 'array'
      )
  ) then
    raise exception 'Every story requires bilingual title/summary and an optional sources array';
  end if;
  perform set_config('app.weekly_digest_revision_write', 'allowed', true);
  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'This weekly digest can no longer be edited';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; the owner must pause the release before editing'
      using errcode = '55000';
  end if;

  v_previous_revision_id := v_digest.active_revision_id;
  select coalesce(max(revision.revision_number), 0) + 1
    into v_revision_number
  from public.weekly_digest_revisions revision
  where revision.weekly_digest_id = p_weekly_digest_id;

  select run.id
    into v_selection_run_id
  from public.weekly_digest_selection_runs run
  where run.weekly_digest_id = p_weekly_digest_id
  order by run.created_at desc, run.id desc
  limit 1;

  v_content_hash := md5(jsonb_build_object(
    'schema', 'weekly-revision-v1',
    'title_en', btrim(p_title_en),
    'title_uk', btrim(p_title_uk),
    'intro_en', nullif(btrim(coalesce(p_intro_en, '')), ''),
    'intro_uk', nullif(btrim(coalesce(p_intro_uk, '')), ''),
    'editor_note_en', nullif(btrim(coalesce(p_editor_note_en, '')), ''),
    'editor_note_uk', nullif(btrim(coalesce(p_editor_note_uk, '')), ''),
    'key_takeaways_en', coalesce(p_key_takeaways_en, '[]'::jsonb),
    'key_takeaways_uk', coalesce(p_key_takeaways_uk, '[]'::jsonb),
    'items', p_items
  )::text);

  insert into public.weekly_digest_revisions (
    weekly_digest_id,
    revision_number,
    selection_run_id,
    title_en,
    title_uk,
    intro_en,
    intro_uk,
    editor_note_en,
    editor_note_uk,
    key_takeaways_en,
    key_takeaways_uk,
    content_hash,
    created_by
  ) values (
    p_weekly_digest_id,
    v_revision_number,
    v_selection_run_id,
    btrim(p_title_en),
    btrim(p_title_uk),
    nullif(btrim(coalesce(p_intro_en, '')), ''),
    nullif(btrim(coalesce(p_intro_uk, '')), ''),
    nullif(btrim(coalesce(p_editor_note_en, '')), ''),
    nullif(btrim(coalesce(p_editor_note_uk, '')), ''),
    coalesce(p_key_takeaways_en, '[]'::jsonb),
    coalesce(p_key_takeaways_uk, '[]'::jsonb),
    v_content_hash,
    auth.uid()
  )
  returning id into v_revision_id;

  insert into public.weekly_digest_revision_items (
    revision_id,
    brief_item_id,
    rank,
    title_en,
    title_uk,
    summary_en,
    summary_uk,
    body_en,
    body_uk,
    why_en,
    why_uk,
    practical_en,
    practical_uk,
    takeaway_en,
    takeaway_uk,
    event_date,
    sources,
    source_snapshot
  )
  select
    v_revision_id,
    nullif(entry.item ->> 'brief_item_id', '')::uuid,
    entry.ordinality::smallint,
    btrim(entry.item ->> 'title_en'),
    btrim(entry.item ->> 'title_uk'),
    btrim(entry.item ->> 'summary_en'),
    btrim(entry.item ->> 'summary_uk'),
    coalesce(nullif(btrim(entry.item ->> 'body_en'), ''), btrim(entry.item ->> 'summary_en')),
    coalesce(nullif(btrim(entry.item ->> 'body_uk'), ''), btrim(entry.item ->> 'summary_uk')),
    nullif(btrim(coalesce(entry.item ->> 'why_en', '')), ''),
    nullif(btrim(coalesce(entry.item ->> 'why_uk', '')), ''),
    nullif(btrim(coalesce(entry.item ->> 'practical_en', '')), ''),
    nullif(btrim(coalesce(entry.item ->> 'practical_uk', '')), ''),
    nullif(btrim(coalesce(entry.item ->> 'takeaway_en', '')), ''),
    nullif(btrim(coalesce(entry.item ->> 'takeaway_uk', '')), ''),
    nullif(entry.item ->> 'event_date', '')::date,
    case
      when jsonb_typeof(entry.item -> 'sources') = 'array' then entry.item -> 'sources'
      else '[]'::jsonb
    end,
    case
      when jsonb_typeof(entry.item -> 'source_snapshot') = 'object'
        then entry.item -> 'source_snapshot'
      else '{}'::jsonb
    end
  from jsonb_array_elements(p_items) with ordinality as entry(item, ordinality);

  -- Reuse only artifacts whose dependency hash is identical. A story image can
  -- carry forward only when its source brief item remains in the new revision.
  if v_previous_revision_id is not null then
    insert into public.weekly_digest_artifacts (
      weekly_digest_id,
      revision_id,
      revision_item_id,
      artifact_type,
      locale,
      slot_key,
      version,
      is_current,
      generation_status,
      review_status,
      input_hash,
      content,
      storage_bucket,
      storage_path,
      external_url,
      provider,
      provider_id,
      mime_type,
      width,
      height,
      byte_size,
      duration_seconds,
      metadata,
      created_by
    )
    select
      artifact.weekly_digest_id,
      v_revision_id,
      new_item.id,
      artifact.artifact_type,
      artifact.locale,
      artifact.slot_key,
      artifact.version,
      true,
      artifact.generation_status,
      artifact.review_status,
      artifact.input_hash,
      artifact.content,
      artifact.storage_bucket,
      artifact.storage_path,
      artifact.external_url,
      artifact.provider,
      artifact.provider_id,
      artifact.mime_type,
      artifact.width,
      artifact.height,
      artifact.byte_size,
      artifact.duration_seconds,
      artifact.metadata || jsonb_build_object('carried_from_artifact_id', artifact.id),
      auth.uid()
    from public.weekly_digest_artifacts artifact
    left join public.weekly_digest_revision_items old_item
      on old_item.id = artifact.revision_item_id
    left join public.weekly_digest_revision_items new_item
      on new_item.revision_id = v_revision_id
     and new_item.brief_item_id = old_item.brief_item_id
    where artifact.revision_id = v_previous_revision_id
      and artifact.is_current
      and (artifact.revision_item_id is null or new_item.id is not null)
      and artifact.input_hash = public.weekly_digest_artifact_input_hash(
        v_revision_id,
        artifact.artifact_type,
        artifact.locale,
        new_item.id
      );
    get diagnostics v_carried_count = row_count;

    insert into public.weekly_digest_artifact_reviews (
      artifact_id,
      reviewer_id,
      action,
      note,
      artifact_snapshot
    )
    select
      artifact.id,
      null,
      'carried_forward',
      'Dependency hash is unchanged from the previous revision.',
      jsonb_build_object(
        'slot_key', artifact.slot_key,
        'input_hash', artifact.input_hash,
        'carried_from_artifact_id', artifact.metadata ->> 'carried_from_artifact_id'
      )
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = v_revision_id
      and artifact.metadata ? 'carried_from_artifact_id';

    select coalesce(jsonb_agg(previous.slot_key order by previous.slot_key), '[]'::jsonb)
      into v_invalidated_slots
    from public.weekly_digest_artifacts previous
    where previous.revision_id = v_previous_revision_id
      and previous.is_current
      and not exists (
        select 1
        from public.weekly_digest_artifacts carried
        where carried.revision_id = v_revision_id
          and carried.slot_key = previous.slot_key
          and carried.is_current
      );
  end if;

  update public.weekly_digests
  set active_revision_id = v_revision_id,
      status = 'in_review',
      approved_by = null,
      approved_at = null,
      preflight_override = null,
      preflight_override_by = null,
      preflight_override_at = null,
      preflight_checked_at = null,
      scheduled_at = null,
      publishing_started_at = null,
      last_error = null
  where id = p_weekly_digest_id;

  update public.social_posts post
  set status = 'in_review',
      approval_version = null,
      approved_by = null,
      approved_at = null,
      retry_after = null
  where post.publish_enabled
    and post.status in ('draft', 'in_review', 'approved', 'scheduled', 'failed')
    and exists (
      select 1
      from public.social_packages package
      where package.id = post.package_id
        and package.weekly_digest_id = p_weekly_digest_id
    );

  update public.social_packages
  set weekly_digest_revision_id = v_revision_id,
      status = 'in_review',
      updated_at = now()
  where weekly_digest_id = p_weekly_digest_id
    and status not in ('publishing', 'posted', 'cancelled');

  insert into public.weekly_digest_release_events (
    weekly_digest_id,
    revision_id,
    actor_id,
    event_type,
    payload
  ) values (
    p_weekly_digest_id,
    v_revision_id,
    auth.uid(),
    'revision_created',
    jsonb_build_object(
      'revision_number', v_revision_number,
      'content_hash', v_content_hash,
      'carried_artifact_count', v_carried_count,
      'invalidated_slots', v_invalidated_slots
    )
  );

  return v_revision_id;
end;
$function$;

create or replace function public.save_weekly_digest_artifact(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_artifact_type text,
  p_locale text,
  p_slot_key text,
  p_revision_item_id uuid default null,
  p_generation_status text default 'ready',
  p_review_status text default 'in_review',
  p_content jsonb default '{}'::jsonb,
  p_storage_bucket text default null,
  p_storage_path text default null,
  p_external_url text default null,
  p_provider text default null,
  p_provider_id text default null,
  p_mime_type text default null,
  p_width integer default null,
  p_height integer default null,
  p_byte_size bigint default null,
  p_duration_seconds integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_artifact_id uuid;
  v_version integer;
  v_input_hash text;
  v_action text;
  v_digest public.weekly_digests;
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if not v_is_service
     and not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if v_is_service
     and (
       p_generation_status <> 'ready'
       or p_review_status <> 'in_review'
     ) then
    raise exception 'Generation workers may save only ready artifacts in review'
      using errcode = '42501';
  end if;
  if p_review_status = 'approved' and public.social_admin_role() <> 'owner' then
    raise exception 'Only an owner can save an approved artifact' using errcode = '42501';
  end if;
  if p_review_status not in ('draft', 'in_review', 'approved')
     or p_generation_status not in ('queued', 'generating', 'ready', 'failed') then
    raise exception 'Invalid artifact state';
  end if;
  if char_length(btrim(coalesce(p_slot_key, ''))) = 0 then
    raise exception 'Artifact slot key is required';
  end if;
  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);
  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
    and digest.active_revision_id = p_revision_id
  for update;
  if v_digest.id is null
     or v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'An editable active revision is required';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; the owner must pause the release before editing'
      using errcode = '55000';
  end if;
  if p_revision_item_id is not null and not exists (
    select 1
    from public.weekly_digest_revision_items item
    where item.id = p_revision_item_id
      and item.revision_id = p_revision_id
  ) then
    raise exception 'Artifact story does not belong to the active revision';
  end if;
  if jsonb_typeof(coalesce(p_content, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Artifact content and metadata must be objects';
  end if;

  select coalesce(max(artifact.version), 0) + 1
    into v_version
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = p_revision_id
    and artifact.slot_key = p_slot_key;

  update public.weekly_digest_artifacts
  set is_current = false,
      review_status = case when review_status = 'approved' then 'stale' else review_status end
  where revision_id = p_revision_id
    and slot_key = p_slot_key
    and is_current;

  v_input_hash := public.weekly_digest_artifact_input_hash(
    p_revision_id,
    p_artifact_type,
    p_locale,
    p_revision_item_id
  );

  insert into public.weekly_digest_artifacts (
    weekly_digest_id,
    revision_id,
    revision_item_id,
    artifact_type,
    locale,
    slot_key,
    version,
    generation_status,
    review_status,
    input_hash,
    content,
    storage_bucket,
    storage_path,
    external_url,
    provider,
    provider_id,
    mime_type,
    width,
    height,
    byte_size,
    duration_seconds,
    metadata,
    created_by
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    p_revision_item_id,
    p_artifact_type,
    p_locale,
    btrim(p_slot_key),
    v_version,
    p_generation_status,
    p_review_status,
    v_input_hash,
    coalesce(p_content, '{}'::jsonb),
    nullif(btrim(coalesce(p_storage_bucket, '')), ''),
    nullif(btrim(coalesce(p_storage_path, '')), ''),
    nullif(btrim(coalesce(p_external_url, '')), ''),
    nullif(btrim(coalesce(p_provider, '')), ''),
    nullif(btrim(coalesce(p_provider_id, '')), ''),
    nullif(btrim(coalesce(p_mime_type, '')), ''),
    p_width,
    p_height,
    p_byte_size,
    p_duration_seconds,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_artifact_id;

  v_action := case
    when p_review_status = 'approved' then 'approved'
    when v_version = 1 then 'generated'
    else 'edited'
  end;
  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    artifact_snapshot
  ) values (
    v_artifact_id,
    auth.uid(),
    v_action,
    jsonb_build_object(
      'slot_key', p_slot_key,
      'artifact_type', p_artifact_type,
      'locale', p_locale,
      'version', v_version,
      'generation_status', p_generation_status,
      'review_status', p_review_status,
      'input_hash', v_input_hash
    )
  );

  with invalidated as (
    update public.weekly_digest_artifacts dependency
    set review_status = 'stale'
    where dependency.revision_id = p_revision_id
      and dependency.is_current
      and dependency.id <> v_artifact_id
      and dependency.review_status <> 'stale'
      and (
        (p_artifact_type = 'story_image'
          and dependency.artifact_type in (
            'cover',
            'pdf',
            'social_asset',
            'video_manifest',
            'video_preview',
            'video_final',
            'captions',
            'thumbnail',
            'heygen_preview',
            'graphics_preview'
          ))
        or (p_artifact_type = 'cover'
          and dependency.artifact_type in ('pdf', 'social_asset'))
        or (p_artifact_type = 'video_script'
          and dependency.artifact_type in (
            'video_manifest',
            'video_preview',
            'video_final',
            'captions',
            'thumbnail',
            'heygen_preview',
            'graphics_preview',
            'pdf'
          ))
        or (p_artifact_type = 'video_manifest'
          and dependency.artifact_type in (
            'video_preview',
            'video_final',
            'captions',
            'thumbnail',
            'heygen_preview',
            'graphics_preview',
            'pdf'
          ))
        or (p_artifact_type = 'video_final'
          and dependency.artifact_type in ('captions', 'thumbnail', 'pdf'))
      )
    returning dependency.*
  )
  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    note,
    artifact_snapshot
  )
  select
    invalidated.id,
    auth.uid(),
    'revoked',
    format('Dependency %s was replaced.', p_slot_key),
    jsonb_build_object(
      'slot_key', invalidated.slot_key,
      'version', invalidated.version,
      'invalidated_by_artifact_id', v_artifact_id,
      'invalidated_by_slot_key', p_slot_key
    )
  from invalidated;

  if p_artifact_type in ('story_image', 'cover', 'social_asset') then
    insert into public.social_post_reviews (
      social_post_id,
      package_id,
      reviewer_id,
      action,
      content_version,
      content_hash,
      snapshot,
      note
    )
    select
      post.id,
      post.package_id,
      auth.uid(),
      'auto_revoked',
      post.content_version,
      post.content_hash,
      jsonb_build_object(
        'status', post.status,
        'channel', post.channel,
        'asset_urls', post.asset_urls,
        'invalidated_by_artifact_id', v_artifact_id
      ),
      format('Weekly visual dependency %s was replaced.', p_slot_key)
    from public.social_posts post
    left join public.social_packages package
      on package.id = post.package_id
    where package.weekly_digest_id = p_weekly_digest_id
      and package.weekly_digest_revision_id = p_revision_id
      and post.publish_enabled
      and post.status in ('approved', 'scheduled', 'failed');

    update public.social_posts post
    set status = 'in_review',
        approval_version = null,
        approved_by = null,
        approved_at = null,
        retry_after = null
    where post.publish_enabled
      and post.status in ('draft', 'in_review', 'approved', 'scheduled', 'failed')
      and exists (
        select 1
        from public.social_packages package
        where package.id = post.package_id
          and package.weekly_digest_id = p_weekly_digest_id
          and package.weekly_digest_revision_id = p_revision_id
      );

    update public.social_packages
    set status = 'in_review',
        updated_at = now()
    where weekly_digest_id = p_weekly_digest_id
      and weekly_digest_revision_id = p_revision_id
      and status not in ('publishing', 'posted', 'cancelled');
  end if;

  update public.weekly_digests
  set status = 'in_review',
      approved_by = null,
      approved_at = null,
      preflight_override = null,
      preflight_override_by = null,
      preflight_override_at = null,
      preflight_checked_at = null,
      scheduled_at = null,
      publishing_started_at = null,
      last_error = null
  where id = p_weekly_digest_id;

  insert into public.weekly_digest_release_events (
    weekly_digest_id,
    revision_id,
    actor_id,
    event_type,
    payload
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    auth.uid(),
    'artifact_saved',
    jsonb_build_object(
      'artifact_id', v_artifact_id,
      'slot_key', p_slot_key,
      'version', v_version,
      'input_hash', v_input_hash
    )
  );

  return v_artifact_id;
end;
$function$;

create or replace function public.review_weekly_digest_artifact(
  p_artifact_id uuid,
  p_action text,
  p_note text default null
)
returns public.weekly_digest_artifacts
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_artifact public.weekly_digest_artifacts;
  v_status text;
begin
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_artifact_review', 'allowed', true);
  if p_action not in ('approved', 'changes_requested') then
    raise exception 'Artifact review action must be approved or changes_requested';
  end if;
  if p_action = 'approved' and public.social_admin_role() <> 'owner' then
    raise exception 'Only an owner can approve an artifact' using errcode = '42501';
  end if;
  if p_action = 'changes_requested'
     and char_length(btrim(coalesce(p_note, ''))) not between 10 and 2000 then
    raise exception 'A change request note must contain 10 to 2000 characters';
  end if;

  v_status := case when p_action = 'approved' then 'approved' else 'changes_requested' end;
  update public.weekly_digest_artifacts artifact
  set review_status = v_status
  where artifact.id = p_artifact_id
    and artifact.is_current
    and artifact.generation_status = 'ready'
  returning artifact.* into v_artifact;
  if v_artifact.id is null then
    raise exception 'A ready current artifact was not found';
  end if;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    note,
    artifact_snapshot
  ) values (
    v_artifact.id,
    auth.uid(),
    p_action,
    nullif(btrim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'slot_key', v_artifact.slot_key,
      'version', v_artifact.version,
      'input_hash', v_artifact.input_hash,
      'review_status', v_status
    )
  );

  update public.weekly_digests
  set status = case
        when p_action = 'changes_requested' then 'changes_requested'
        else 'in_review'
      end,
      approved_by = null,
      approved_at = null,
      preflight_override = null,
      preflight_override_by = null,
      preflight_override_at = null,
      preflight_checked_at = null,
      scheduled_at = null,
      publishing_started_at = null,
      last_error = null
  where id = v_artifact.weekly_digest_id
    and active_revision_id = v_artifact.revision_id
    and status not in ('publishing', 'published', 'cancelled');

  insert into public.weekly_digest_release_events (
    weekly_digest_id,
    revision_id,
    actor_id,
    event_type,
    payload
  ) values (
    v_artifact.weekly_digest_id,
    v_artifact.revision_id,
    auth.uid(),
    'artifact_reviewed',
    jsonb_build_object(
      'artifact_id', v_artifact.id,
      'slot_key', v_artifact.slot_key,
      'action', p_action
    )
  );

  return v_artifact;
end;
$function$;

create or replace function public.comment_weekly_digest_artifact(
  p_artifact_id uuid,
  p_note text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_artifact public.weekly_digest_artifacts;
  v_review_id uuid;
begin
  if not public.is_social_admin() then
    raise exception 'Social admin session required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'Comment must contain 1 to 2000 characters';
  end if;

  select artifact.*
    into v_artifact
  from public.weekly_digest_artifacts artifact
  where artifact.id = p_artifact_id;
  if v_artifact.id is null then
    raise exception 'Weekly digest artifact was not found';
  end if;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    note,
    artifact_snapshot
  ) values (
    v_artifact.id,
    auth.uid(),
    'commented',
    btrim(p_note),
    jsonb_build_object(
      'slot_key', v_artifact.slot_key,
      'version', v_artifact.version,
      'input_hash', v_artifact.input_hash,
      'review_status', v_artifact.review_status
    )
  )
  returning id into v_review_id;
  return v_review_id;
end;
$function$;

create or replace function public.comment_weekly_social_post(
  p_social_post_id uuid,
  p_note text
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_post public.social_posts;
  v_review_id bigint;
begin
  if not public.is_social_admin() then
    raise exception 'Social admin session required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'Comment must contain 1 to 2000 characters';
  end if;

  select post.*
    into v_post
  from public.social_posts post
  join public.social_packages package
    on package.id = post.package_id
  where post.id = p_social_post_id
    and package.kind = 'weekly_digest';
  if v_post.id is null then
    raise exception 'Weekly social variant was not found';
  end if;

  insert into public.social_post_reviews (
    social_post_id,
    package_id,
    reviewer_id,
    action,
    content_version,
    content_hash,
    snapshot,
    note
  ) values (
    v_post.id,
    v_post.package_id,
    auth.uid(),
    'commented',
    v_post.content_version,
    v_post.content_hash,
    jsonb_build_object(
      'channel', v_post.channel,
      'locale', v_post.locale,
      'status', v_post.status,
      'content_version', v_post.content_version
    ),
    btrim(p_note)
  )
  returning id into v_review_id;
  return v_review_id;
end;
$function$;

-- ── Release preflight and lifecycle RPCs ───────────────────────────────────

create or replace function public.weekly_digest_preflight(p_weekly_digest_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_blockers jsonb := '[]'::jsonb;
  v_effective_blockers jsonb := '[]'::jsonb;
  v_overridden_blockers jsonb := '[]'::jsonb;
  v_required record;
  v_item record;
  v_artifact public.weekly_digest_artifacts;
  v_package_id uuid;
  v_latest_review_action text;
  v_channel record;
begin
  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id;

  if v_digest.id is null then
    return jsonb_build_object(
      'ready', false,
      'digest_id', p_weekly_digest_id,
      'revision_id', null,
      'checked_at', now(),
      'blockers', jsonb_build_array(jsonb_build_object(
        'code', 'digest_not_found',
        'message', 'Weekly digest was not found.'
      ))
    );
  end if;

  if v_digest.active_revision_id is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'active_revision_missing',
      'message', 'The digest has no active revision.'
    ));
  end if;

  if v_digest.release_at is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'release_time_missing',
      'message', 'The Monday 16:00 Kyiv release time is missing.'
    ));
  end if;

  if v_digest.active_revision_id is not null
     and (
       select count(*)
       from public.weekly_digest_revision_items item
       where item.revision_id = v_digest.active_revision_id
     ) not between 3 and 7 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'story_count_invalid',
      'message', 'The active revision must contain 3 to 7 stories.'
    ));
  end if;

  for v_required in
    select *
    from (values
      ('article', 'en', 'article:en'),
      ('article', 'uk', 'article:uk'),
      ('pdf', 'en', 'pdf:en'),
      ('pdf', 'uk', 'pdf:uk'),
      ('cover', 'neutral', 'cover:neutral'),
      ('video_final', 'en', 'video-final:en'),
      ('captions', 'en', 'captions:en'),
      ('captions', 'uk', 'captions:uk'),
      ('thumbnail', 'neutral', 'thumbnail:neutral')
    ) as required(artifact_type, locale, slot_key)
  loop
    v_artifact := null;
    select artifact.*
      into v_artifact
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = v_digest.active_revision_id
      and artifact.artifact_type = v_required.artifact_type
      and artifact.locale = v_required.locale
      and artifact.is_current
    order by artifact.created_at desc
    limit 1;

    if v_artifact.id is null then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'artifact_missing',
        'message', format('Required artifact %s is missing.', v_required.slot_key),
        'slot_key', v_required.slot_key
      ));
      continue;
    end if;
    if v_artifact.generation_status <> 'ready'
       or v_artifact.review_status <> 'approved' then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'artifact_not_approved',
        'message', format('Artifact %s is not ready and approved.', v_required.slot_key),
        'slot_key', v_required.slot_key
      ));
    end if;
    if v_artifact.input_hash is distinct from public.weekly_digest_artifact_input_hash(
      v_digest.active_revision_id,
      v_artifact.artifact_type,
      v_artifact.locale,
      null
    ) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'artifact_stale',
        'message', format('Artifact %s was generated from an older input.', v_required.slot_key),
        'slot_key', v_required.slot_key
      ));
    end if;
    if v_artifact.artifact_type = 'pdf'
       and (v_artifact.storage_bucket is null or v_artifact.storage_path is null) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'pdf_file_missing',
        'message', format('PDF %s has no private storage file.', v_required.locale),
        'slot_key', v_required.slot_key
      ));
    end if;
    if v_artifact.artifact_type = 'video_final'
       and (
         v_artifact.provider is distinct from 'youtube'
         or nullif(v_artifact.provider_id, '') is null
         or nullif(v_artifact.external_url, '') is null
       ) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'youtube_video_missing',
        'message', 'The final YouTube video ID and URL are required.',
        'slot_key', v_required.slot_key
      ));
    end if;
    if v_artifact.artifact_type = 'captions'
       and v_artifact.content = '{}'::jsonb then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'captions_content_missing',
        'message', format('%s captions are empty.', upper(v_required.locale)),
        'slot_key', v_required.slot_key
      ));
    end if;
  end loop;

  for v_item in
    select item.id, item.rank
    from public.weekly_digest_revision_items item
    where item.revision_id = v_digest.active_revision_id
    order by item.rank
  loop
    v_artifact := null;
    select artifact.*
      into v_artifact
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = v_digest.active_revision_id
      and artifact.revision_item_id = v_item.id
      and artifact.artifact_type = 'story_image'
      and artifact.is_current
    order by artifact.created_at desc
    limit 1;

    if v_artifact.id is null
       or v_artifact.generation_status <> 'ready'
       or v_artifact.review_status <> 'approved' then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'story_image_not_approved',
        'message', format('Story %s needs an approved illustration.', v_item.rank),
        'slot_key', format('story:%s:image', v_item.id)
      ));
    elsif v_artifact.input_hash is distinct from public.weekly_digest_artifact_input_hash(
      v_digest.active_revision_id,
      'story_image',
      v_artifact.locale,
      v_item.id
    ) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'story_image_stale',
        'message', format('Story %s illustration is stale.', v_item.rank),
        'slot_key', v_artifact.slot_key
      ));
    end if;
  end loop;

  select review.action
    into v_latest_review_action
  from public.weekly_digest_reviews review
  where review.weekly_digest_id = p_weekly_digest_id
    and (
      review.revision_id = v_digest.active_revision_id
      or review.revision_id is null
    )
  order by review.created_at desc, review.id desc
  limit 1;
  if v_latest_review_action = 'changes_requested' then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'editorial_changes_unresolved',
      'message', 'The latest editorial change request has not been addressed.'
    ));
  end if;

  select package.id
    into v_package_id
  from public.social_packages package
  where package.kind = 'weekly_digest'
    and package.weekly_digest_id = p_weekly_digest_id
    and package.weekly_digest_revision_id = v_digest.active_revision_id
    and package.status <> 'cancelled'
  order by package.created_at desc
  limit 1;

  if v_package_id is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'social_package_missing',
      'message', 'The active revision has no social package.'
    ));
  else
    if (
      select count(distinct post.channel)
      from public.social_posts post
      where post.package_id = v_package_id
        and post.channel in ('telegram', 'facebook', 'linkedin', 'x', 'threads', 'instagram')
    ) <> 6 then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'social_matrix_incomplete',
        'message', 'Exactly six platform variants are required.'
      ));
    end if;

    for v_channel in
      select *
      from (values
        ('telegram', 'uk'),
        ('facebook', 'uk'),
        ('linkedin', 'en'),
        ('x', 'en'),
        ('threads', 'en'),
        ('instagram', 'en')
      ) as channel(channel, locale)
    loop
      if not exists (
        select 1
        from public.social_posts post
        where post.package_id = v_package_id
          and post.channel = v_channel.channel
          and post.locale = v_channel.locale
      ) then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code', 'social_variant_missing',
          'message', format('%s %s variant is missing.', v_channel.channel, upper(v_channel.locale)),
          'channel', v_channel.channel
        ));
      elsif exists (
        select 1
        from public.social_posts post
        where post.package_id = v_package_id
          and post.channel = v_channel.channel
          and post.publish_enabled
          and (
            post.status not in ('approved', 'scheduled')
            or post.approval_version is distinct from post.content_version
            or post.content_hash is null
            or post.scheduled_for is null
            or post.scheduled_for < v_digest.release_at
            or nullif(btrim(coalesce(post.post_text, '')), '') is null
            or jsonb_array_length(coalesce(post.asset_urls, '[]'::jsonb)) = 0
            or (
              post.channel = 'linkedin'
              and coalesce(post.meta ->> 'document_status', '')
                not in ('ready', 'completed')
            )
          )
      ) then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code', 'social_variant_not_ready',
          'message', format('%s is not approved, scheduled after release, and complete.', v_channel.channel),
          'channel', v_channel.channel
        ));
      end if;
    end loop;
  end if;

  for v_required in
    select blocker.value as blocker
    from jsonb_array_elements(v_blockers) blocker
  loop
    if v_digest.preflight_override is not null
       and v_digest.preflight_override ->> 'revision_id'
         = v_digest.active_revision_id::text
       and exists (
         select 1
         from jsonb_array_elements(
           coalesce(v_digest.preflight_override -> 'blockers', '[]'::jsonb)
         ) overridden
         where overridden.value ->> 'code'
                 = v_required.blocker ->> 'code'
           and coalesce(overridden.value ->> 'slot_key', '')
                 = coalesce(v_required.blocker ->> 'slot_key', '')
           and coalesce(overridden.value ->> 'channel', '')
                 = coalesce(v_required.blocker ->> 'channel', '')
       ) then
      v_overridden_blockers :=
        v_overridden_blockers || jsonb_build_array(v_required.blocker);
    else
      v_effective_blockers :=
        v_effective_blockers || jsonb_build_array(v_required.blocker);
    end if;
  end loop;

  return jsonb_build_object(
    'ready', jsonb_array_length(v_effective_blockers) = 0,
    'digest_id', v_digest.id,
    'revision_id', v_digest.active_revision_id,
    'checked_at', now(),
    'blockers', v_effective_blockers,
    'overridden_blockers', v_overridden_blockers,
    'override', v_digest.preflight_override
  );
end;
$function$;

create or replace function public.approve_weekly_digest(
  p_weekly_digest_id uuid,
  p_override_reason text
)
returns public.weekly_digests
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_raw_preflight jsonb;
  v_effective_preflight jsonb;
  v_blocker record;
  v_override_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
begin
  if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
    raise exception 'AAL2 owner session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_release_action', 'allowed', true);

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.status not in ('in_review', 'changes_requested', 'failed', 'paused') then
    raise exception 'Weekly digest is not in an approvable state';
  end if;

  -- Re-evaluate from an unoverridden baseline. Content edits also clear these
  -- fields, so an override can never leak across revisions.
  update public.weekly_digests
  set preflight_override = null,
      preflight_override_by = null,
      preflight_override_at = null
  where id = p_weekly_digest_id;

  v_raw_preflight := public.weekly_digest_preflight(p_weekly_digest_id);
  v_effective_preflight := v_raw_preflight;
  if not coalesce((v_raw_preflight ->> 'ready')::boolean, false) then
    if v_override_reason is null
       or char_length(v_override_reason) not between 20 and 1000 then
      raise exception
        'A 20 to 1000 character override reason is required for overridable blockers';
    end if;

    for v_blocker in
      select blocker.value as blocker
      from jsonb_array_elements(v_raw_preflight -> 'blockers') blocker
    loop
      if not (
        v_blocker.blocker ->> 'code' in (
          'artifact_missing',
          'artifact_not_approved',
          'pdf_file_missing'
        )
        and (
          v_blocker.blocker ->> 'slot_key' like 'article:%'
          or v_blocker.blocker ->> 'slot_key' like 'pdf:%'
        )
      ) then
        raise exception
          'Blocker % cannot be overridden',
          v_blocker.blocker
          using errcode = '55000';
      end if;
    end loop;

    perform set_config('app.weekly_digest_override', 'allowed', true);
    update public.weekly_digests
    set preflight_override = jsonb_build_object(
          'revision_id', active_revision_id,
          'reason', v_override_reason,
          'blockers', v_raw_preflight -> 'blockers',
          'approved_by', auth.uid(),
          'approved_at', now()
        ),
        preflight_override_by = auth.uid(),
        preflight_override_at = now()
    where id = p_weekly_digest_id;

    v_effective_preflight := public.weekly_digest_preflight(p_weekly_digest_id);
    if not coalesce((v_effective_preflight ->> 'ready')::boolean, false) then
      raise exception
        'Weekly digest still has non-overridden blockers: %',
        v_effective_preflight -> 'blockers';
    end if;
  elsif v_override_reason is not null then
    raise exception 'Override reason was supplied, but preflight has no blockers';
  end if;

  update public.weekly_digests
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      preflight_checked_at = now(),
      scheduled_at = null,
      publishing_started_at = null,
      last_error = null
  where id = p_weekly_digest_id
  returning * into v_digest;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_digest.id,
    v_digest.active_revision_id,
    auth.uid(),
    'approved',
    jsonb_build_object(
      'preflight', v_effective_preflight,
      'raw_preflight', v_raw_preflight,
      'override', v_digest.preflight_override
    )
  );
  return v_digest;
end;
$function$;

create or replace function public.approve_weekly_digest(p_weekly_digest_id uuid)
returns public.weekly_digests
language sql
security invoker
set search_path = public
as $function$
  select public.approve_weekly_digest(p_weekly_digest_id, null)
$function$;

create or replace function public.schedule_weekly_digest(
  p_weekly_digest_id uuid,
  p_release_at timestamptz
)
returns public.weekly_digests
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_preflight jsonb;
  v_local timestamp;
begin
  if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
    raise exception 'AAL2 owner session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_release_action', 'allowed', true);
  perform set_config('app.weekly_digest_social_action', 'allowed', true);
  if p_release_at is null then
    raise exception 'Release time is required';
  end if;
  v_local := p_release_at at time zone 'Europe/Kyiv';
  if extract(isodow from v_local) <> 1
     or extract(hour from v_local) <> 16
     or extract(minute from v_local) <> 0 then
    raise exception 'Weekly Digest release must be Monday at 16:00 Europe/Kyiv';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null or v_digest.status <> 'approved' then
    raise exception 'An approved weekly digest is required';
  end if;
  if p_release_at <= now() then
    raise exception 'Release time must be in the future';
  end if;

  v_preflight := public.weekly_digest_preflight(p_weekly_digest_id);
  if not coalesce((v_preflight ->> 'ready')::boolean, false) then
    raise exception 'Weekly digest preflight failed: %', v_preflight -> 'blockers';
  end if;

  update public.weekly_digests
  set status = 'scheduled',
      release_at = p_release_at,
      preflight_at = p_release_at - interval '15 minutes',
      scheduled_at = now(),
      preflight_checked_at = now(),
      publishing_started_at = null,
      last_error = null
  where id = p_weekly_digest_id
  returning * into v_digest;

  update public.social_posts post
  set status = 'scheduled'
  where post.publish_enabled
    and post.status = 'approved'
    and exists (
      select 1
      from public.social_packages package
      where package.id = post.package_id
        and package.weekly_digest_id = p_weekly_digest_id
        and package.weekly_digest_revision_id = v_digest.active_revision_id
    );
  update public.social_packages
  set status = 'scheduled',
      updated_at = now()
  where weekly_digest_id = p_weekly_digest_id
    and weekly_digest_revision_id = v_digest.active_revision_id
    and status = 'approved';

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_digest.id,
    v_digest.active_revision_id,
    auth.uid(),
    'scheduled',
    jsonb_build_object(
      'release_at', p_release_at,
      'preflight_at', v_digest.preflight_at,
      'preflight', v_preflight
    )
  );
  return v_digest;
end;
$function$;

create or replace function public.pause_weekly_digest(
  p_weekly_digest_id uuid,
  p_reason text
)
returns public.weekly_digests
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
begin
  if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
    raise exception 'AAL2 owner session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_release_action', 'allowed', true);
  perform set_config('app.weekly_digest_social_action', 'allowed', true);
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'Pause reason must contain 10 to 1000 characters';
  end if;

  update public.weekly_digests
  set status = 'paused',
      scheduled_at = null,
      publishing_started_at = null,
      last_error = btrim(p_reason)
  where id = p_weekly_digest_id
    and status not in ('published', 'cancelled')
  returning * into v_digest;
  if v_digest.id is null then
    raise exception 'Pausable weekly digest was not found';
  end if;

  update public.social_posts post
  set status = 'approved'
  where post.publish_enabled
    and post.status = 'scheduled'
    and exists (
      select 1
      from public.social_packages package
      where package.id = post.package_id
        and package.weekly_digest_id = p_weekly_digest_id
    );
  update public.social_packages
  set status = 'approved',
      updated_at = now()
  where weekly_digest_id = p_weekly_digest_id
    and status = 'scheduled';

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_digest.id,
    v_digest.active_revision_id,
    auth.uid(),
    'paused',
    jsonb_build_object('reason', btrim(p_reason))
  );
  return v_digest;
end;
$function$;

create or replace function public.run_due_weekly_digest_preflights(
  p_limit integer default 5
)
returns setof public.weekly_digests
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_checked public.weekly_digests;
  v_preflight jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  for v_digest in
    select digest.*
    from public.weekly_digests digest
    where digest.status = 'scheduled'
      and digest.preflight_at <= now()
      and digest.release_at > now()
      and coalesce(digest.preflight_checked_at, '-infinity'::timestamptz)
            < digest.preflight_at
    order by digest.preflight_at, digest.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    v_preflight := public.weekly_digest_preflight(v_digest.id);
    update public.weekly_digests
    set status = case
          when coalesce((v_preflight ->> 'ready')::boolean, false)
            then 'scheduled'
          else 'failed'
        end,
        preflight_checked_at = now(),
        publishing_started_at = null,
        last_error = case
          when coalesce((v_preflight ->> 'ready')::boolean, false)
            then null
          else left((v_preflight -> 'blockers')::text, 2000)
        end
    where id = v_digest.id
      and status = 'scheduled'
    returning * into v_checked;

    if v_checked.id is not null then
      insert into public.weekly_digest_release_events (
        weekly_digest_id,
        revision_id,
        event_type,
        payload
      ) values (
        v_checked.id,
        v_checked.active_revision_id,
        case
          when v_checked.status = 'scheduled' then 'preflight_passed'
          else 'preflight_failed'
        end,
        jsonb_build_object(
          'scheduled_preflight', true,
          'preflight', v_preflight
        )
      );
      return next v_checked;
    end if;
  end loop;
end;
$function$;

create or replace function public.claim_due_weekly_digests(p_limit integer default 5)
returns setof public.weekly_digests
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_claimed public.weekly_digests;
  v_preflight jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  for v_digest in
    select digest.*
    from public.weekly_digests digest
    where (
        digest.status = 'scheduled'
        and digest.release_at <= now()
      )
      or (
        digest.status = 'publishing'
        and digest.publishing_started_at < now() - interval '15 minutes'
      )
    order by digest.release_at, digest.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    v_preflight := public.weekly_digest_preflight(v_digest.id);
    if coalesce((v_preflight ->> 'ready')::boolean, false) then
      update public.weekly_digests
      set status = 'publishing',
          publishing_started_at = now(),
          preflight_checked_at = now(),
          last_error = null
      where id = v_digest.id
        and status = v_digest.status
      returning * into v_claimed;

      if v_claimed.id is not null then
        insert into public.weekly_digest_release_events (
          weekly_digest_id, revision_id, event_type, payload
        ) values (
          v_claimed.id,
          v_claimed.active_revision_id,
          case
            when v_digest.status = 'publishing' then 'publishing_retried'
            else 'publishing_started'
          end,
          jsonb_build_object(
            'preflight', v_preflight,
            'reclaimed_stale_lease', v_digest.status = 'publishing',
            'previous_publishing_started_at', v_digest.publishing_started_at
          )
        );
        return next v_claimed;
      end if;
    else
      update public.weekly_digests
      set status = 'failed',
          publishing_started_at = null,
          preflight_checked_at = now(),
          last_error = left((v_preflight -> 'blockers')::text, 2000)
      where id = v_digest.id;
      insert into public.weekly_digest_release_events (
        weekly_digest_id, revision_id, event_type, payload
      ) values (
        v_digest.id,
        v_digest.active_revision_id,
        'preflight_failed',
        jsonb_build_object('preflight', v_preflight)
      );
    end if;
  end loop;
end;
$function$;

create or replace function public.finish_weekly_digest_release(
  p_weekly_digest_id uuid,
  p_succeeded boolean,
  p_error text default null
)
returns public.weekly_digests
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision public.weekly_digest_revisions;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
    and digest.status = 'publishing'
  for update;
  if v_digest.id is null then
    select digest.*
      into v_digest
    from public.weekly_digests digest
    where digest.id = p_weekly_digest_id;
    if v_digest.status = 'published' and p_succeeded then
      return v_digest;
    end if;
    raise exception 'Publishing weekly digest was not found';
  end if;

  if p_succeeded then
    select revision.*
      into v_revision
    from public.weekly_digest_revisions revision
    where revision.id = v_digest.active_revision_id;

    update public.weekly_digest_artifacts
    set published_at = coalesce(published_at, now())
    where revision_id = v_digest.active_revision_id
      and is_current
      and generation_status = 'ready'
      and review_status = 'approved';

    update public.weekly_digests
    set status = 'published',
        published_revision_id = active_revision_id,
        published_at = coalesce(published_at, now()),
        publishing_started_at = null,
        last_error = null,
        title_en = v_revision.title_en,
        title_uk = v_revision.title_uk,
        intro_en = v_revision.intro_en,
        intro_uk = v_revision.intro_uk
    where id = p_weekly_digest_id
    returning * into v_digest;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_digest.id,
      v_digest.published_revision_id,
      'published',
      jsonb_build_object('published_at', v_digest.published_at)
    );
  else
    update public.weekly_digests
    set status = 'failed',
        publishing_started_at = null,
        last_error = left(coalesce(nullif(btrim(p_error), ''), 'Release worker failed.'), 2000)
    where id = p_weekly_digest_id
    returning * into v_digest;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_digest.id,
      v_digest.active_revision_id,
      'failed',
      jsonb_build_object('error', v_digest.last_error)
    );
  end if;

  return v_digest;
end;
$function$;

-- The existing composer writes the digest and legacy selection snapshot with a
-- service-role client. This idempotent bridge freezes that draft into revision
-- 1 without granting the worker general editorial approval privileges.
create or replace function public.initialize_weekly_digest_revision_from_legacy(
  p_weekly_digest_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision_id uuid;
  v_selection_run_id uuid;
  v_item_count integer;
  v_content_hash text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.active_revision_id is not null then
    return v_digest.active_revision_id;
  end if;
  if v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'Weekly digest cannot be initialized in its current state';
  end if;

  select count(*)
    into v_item_count
  from public.weekly_digest_items item
  where item.weekly_digest_id = p_weekly_digest_id;
  if v_item_count not between 3 and 7 then
    raise exception 'Weekly digest revision must contain 3 to 7 stories';
  end if;

  select run.id
    into v_selection_run_id
  from public.weekly_digest_selection_runs run
  where run.weekly_digest_id = p_weekly_digest_id
  order by run.created_at desc, run.id desc
  limit 1;

  select md5(
    jsonb_build_object(
      'title_en', v_digest.title_en,
      'title_uk', v_digest.title_uk,
      'intro_en', v_digest.intro_en,
      'intro_uk', v_digest.intro_uk,
      'items', jsonb_agg(
        jsonb_build_object(
          'brief_item_id', item.brief_item_id,
          'rank', item.rank,
          'snapshot', item.snapshot
        )
        order by item.rank
      )
    )::text
  )
    into v_content_hash
  from public.weekly_digest_items item
  where item.weekly_digest_id = p_weekly_digest_id;

  insert into public.weekly_digest_revisions (
    weekly_digest_id,
    revision_number,
    selection_run_id,
    title_en,
    title_uk,
    intro_en,
    intro_uk,
    content_hash,
    created_by
  ) values (
    p_weekly_digest_id,
    1,
    v_selection_run_id,
    v_digest.title_en,
    v_digest.title_uk,
    v_digest.intro_en,
    v_digest.intro_uk,
    v_content_hash,
    null
  )
  returning id into v_revision_id;

  insert into public.weekly_digest_revision_items (
    revision_id,
    brief_item_id,
    rank,
    title_en,
    title_uk,
    summary_en,
    summary_uk,
    body_en,
    body_uk,
    why_en,
    why_uk,
    practical_en,
    practical_uk,
    takeaway_en,
    takeaway_uk,
    event_date,
    sources,
    source_snapshot
  )
  select
    v_revision_id,
    item.brief_item_id,
    item.rank,
    coalesce(nullif(item.snapshot ->> 'title_en', ''), v_digest.title_en),
    coalesce(nullif(item.snapshot ->> 'title_uk', ''), v_digest.title_uk),
    coalesce(item.snapshot ->> 'summary_en', ''),
    coalesce(item.snapshot ->> 'summary_uk', ''),
    coalesce(nullif(item.snapshot ->> 'body_en', ''), item.snapshot ->> 'summary_en', ''),
    coalesce(nullif(item.snapshot ->> 'body_uk', ''), item.snapshot ->> 'summary_uk', ''),
    nullif(item.snapshot ->> 'why_en', ''),
    nullif(item.snapshot ->> 'why_uk', ''),
    nullif(item.snapshot ->> 'practical_en', ''),
    nullif(item.snapshot ->> 'practical_uk', ''),
    nullif(item.snapshot ->> 'takeaway_en', ''),
    nullif(item.snapshot ->> 'takeaway_uk', ''),
    nullif(item.snapshot ->> 'brief_date', '')::date,
    case
      when nullif(item.snapshot #>> '{editorial_selection,source_url}', '') is null
        then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object(
        'name', coalesce(
          nullif(item.snapshot #>> '{editorial_selection,source_name}', ''),
          'Source'
        ),
        'url', item.snapshot #>> '{editorial_selection,source_url}'
      ))
    end,
    item.snapshot
  from public.weekly_digest_items item
  where item.weekly_digest_id = p_weekly_digest_id
  order by item.rank;

  update public.weekly_digests
  set active_revision_id = v_revision_id,
      status = 'in_review',
      approved_by = null,
      approved_at = null,
      preflight_override = null,
      preflight_override_by = null,
      preflight_override_at = null,
      preflight_checked_at = null,
      scheduled_at = null,
      publishing_started_at = null,
      last_error = null
  where id = p_weekly_digest_id;

  insert into public.weekly_digest_release_events (
    weekly_digest_id,
    revision_id,
    event_type,
    payload
  ) values (
    p_weekly_digest_id,
    v_revision_id,
    'revision_created',
    jsonb_build_object(
      'revision_number', 1,
      'content_hash', v_content_hash,
      'source', 'legacy_composer_initializer'
    )
  );

  return v_revision_id;
end;
$function$;

-- ── Durable generation queue RPCs ─────────────────────────────────────────

create or replace function public.queue_weekly_digest_generation_job(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_job_type text,
  p_idempotency_key text,
  p_input jsonb default '{}'::jsonb,
  p_artifact_id uuid default null
)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_job public.weekly_digest_generation_jobs;
begin
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if p_job_type not in (
    'article',
    'pdf',
    'cover',
    'story_image',
    'social_asset',
    'video_manifest',
    'artifact_promotion'
  ) then
    raise exception 'Unsupported weekly digest generation job type';
  end if;
  if char_length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 250 then
    raise exception 'Idempotency key must contain 8 to 250 characters';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Generation input must be a JSON object';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.active_revision_id is distinct from p_revision_id then
    raise exception 'Generation jobs may target only the active revision';
  end if;
  if v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'Weekly digest is not editable';
  end if;
  if p_artifact_id is not null and not exists (
    select 1
    from public.weekly_digest_artifacts artifact
    where artifact.id = p_artifact_id
      and artifact.weekly_digest_id = p_weekly_digest_id
      and artifact.revision_id = p_revision_id
      and artifact.is_current
  ) then
    raise exception 'Current artifact does not belong to the requested revision';
  end if;

  insert into public.weekly_digest_generation_jobs (
    weekly_digest_id,
    revision_id,
    artifact_id,
    job_type,
    idempotency_key,
    status,
    input,
    created_by
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    p_artifact_id,
    p_job_type,
    btrim(p_idempotency_key),
    'queued',
    p_input,
    auth.uid()
  )
  on conflict (idempotency_key) do update
  set status = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then 'queued'
        else public.weekly_digest_generation_jobs.status
      end,
      input = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then excluded.input
        else public.weekly_digest_generation_jobs.input
      end,
      artifact_id = coalesce(
        public.weekly_digest_generation_jobs.artifact_id,
        excluded.artifact_id
      ),
      output = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then '{}'::jsonb
        else public.weekly_digest_generation_jobs.output
      end,
      last_error = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.last_error
      end,
      locked_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.locked_at
      end,
      started_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.started_at
      end,
      finished_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then null
        else public.weekly_digest_generation_jobs.finished_at
      end
  where public.weekly_digest_generation_jobs.weekly_digest_id = excluded.weekly_digest_id
    and public.weekly_digest_generation_jobs.revision_id = excluded.revision_id
    and public.weekly_digest_generation_jobs.job_type = excluded.job_type
  returning * into v_job;

  if v_job.id is null then
    raise exception 'Idempotency key is already used by a different generation job';
  end if;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_job.weekly_digest_id,
    v_job.revision_id,
    auth.uid(),
    'generation_queued',
    jsonb_build_object(
      'job_id', v_job.id,
      'job_type', v_job.job_type,
      'status', v_job.status,
      'idempotency_key', v_job.idempotency_key
    )
  );
  return v_job;
end;
$function$;

create or replace function public.claim_weekly_digest_generation_jobs(
  p_job_types text[] default null,
  p_limit integer default 5,
  p_stale_after interval default interval '15 minutes'
)
returns setof public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
  v_claimed public.weekly_digest_generation_jobs;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_job_types is not null and (
    cardinality(p_job_types) = 0
    or exists (
      select 1
      from unnest(p_job_types) as requested(job_type)
      where requested.job_type not in (
        'article',
        'pdf',
        'cover',
        'story_image',
        'social_asset',
        'video_manifest',
        'artifact_promotion'
      )
    )
  ) then
    raise exception 'Unsupported weekly digest generation job type filter';
  end if;
  if p_stale_after <= interval '0 seconds'
     or p_stale_after > interval '24 hours' then
    raise exception 'Stale timeout must be greater than zero and at most 24 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest
      on digest.id = job.weekly_digest_id
    where job.attempts < 5
      and digest.active_revision_id = job.revision_id
      and digest.status not in ('publishing', 'published', 'cancelled')
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (
        job.status in ('queued', 'failed')
        or (
          job.status = 'running'
          and job.locked_at < now() - p_stale_after
        )
      )
    order by
      case job.status when 'queued' then 0 when 'failed' then 1 else 2 end,
      job.created_at
    for update of job skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    update public.weekly_digest_generation_jobs
    set status = 'running',
        attempts = attempts + 1,
        locked_at = now(),
        started_at = coalesce(started_at, now()),
        finished_at = null,
        last_error = null
    where id = v_job.id
    returning * into v_claimed;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_claimed.weekly_digest_id,
      v_claimed.revision_id,
      'generation_started',
      jsonb_build_object(
        'job_id', v_claimed.id,
        'job_type', v_claimed.job_type,
        'attempt', v_claimed.attempts
      )
    );
    return next v_claimed;
  end loop;
end;
$function$;

create or replace function public.finish_weekly_digest_generation_job(
  p_job_id uuid,
  p_succeeded boolean,
  p_output jsonb default '{}'::jsonb,
  p_error text default null,
  p_artifact_id uuid default null
)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
  v_artifact_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'Generation output must be a JSON object';
  end if;

  select job.*
    into v_job
  from public.weekly_digest_generation_jobs job
  where job.id = p_job_id
    and job.status = 'running'
  for update;
  if v_job.id is null then
    raise exception 'Running weekly digest generation job was not found';
  end if;

  v_artifact_id := coalesce(p_artifact_id, v_job.artifact_id);
  if v_artifact_id is not null and not exists (
    select 1
    from public.weekly_digest_artifacts artifact
    where artifact.id = v_artifact_id
      and artifact.weekly_digest_id = v_job.weekly_digest_id
      and artifact.revision_id = v_job.revision_id
  ) then
    raise exception 'Artifact does not belong to the generation job revision';
  end if;

  update public.weekly_digest_generation_jobs
  set artifact_id = v_artifact_id,
      status = case when p_succeeded then 'succeeded' else 'failed' end,
      output = p_output,
      last_error = case
        when p_succeeded then null
        else left(coalesce(nullif(btrim(p_error), ''), 'Generation worker failed.'), 2000)
      end,
      locked_at = null,
      finished_at = now()
  where id = v_job.id
  returning * into v_job;

  if v_artifact_id is not null then
    update public.weekly_digest_artifacts
    set generation_status = case when p_succeeded then 'ready' else 'failed' end
    where id = v_artifact_id
      and is_current;
  end if;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, event_type, payload
  ) values (
    v_job.weekly_digest_id,
    v_job.revision_id,
    case when p_succeeded then 'generation_succeeded' else 'generation_failed' end,
    jsonb_build_object(
      'job_id', v_job.id,
      'job_type', v_job.job_type,
      'attempt', v_job.attempts,
      'artifact_id', v_job.artifact_id,
      'output', v_job.output,
      'error', v_job.last_error
    )
  );
  return v_job;
end;
$function$;

-- ── Owner-only social approval (approval is not publication) ──────────────

create or replace function public.approve_social_post(p_social_post_id uuid)
returns public.social_posts
language plpgsql
security invoker
set search_path = public
as $function$
declare
  approved_post public.social_posts;
begin
  if public.social_admin_role() <> 'owner' then
    raise exception 'Owner session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_social_action', 'allowed', true);

  update public.social_posts
  set status = 'approved',
      approval_version = content_version,
      approved_by = auth.uid(),
      approved_at = now(),
      last_error = null
  where id = p_social_post_id
    and publish_enabled
    and status in ('draft', 'in_review', 'failed')
    and content_hash is not null
    and jsonb_array_length(coalesce(quality_report -> 'blocking', '[]'::jsonb)) = 0
  returning * into approved_post;

  if approved_post.id is null then
    raise exception 'Post is disabled, missing, blocked by quality rules, or not reviewable';
  end if;

  insert into public.social_post_reviews (
    social_post_id,
    package_id,
    reviewer_id,
    action,
    content_version,
    content_hash,
    snapshot
  ) values (
    approved_post.id,
    approved_post.package_id,
    auth.uid(),
    'approved',
    approved_post.content_version,
    approved_post.content_hash,
    jsonb_build_object(
      'channel', approved_post.channel,
      'locale', approved_post.locale,
      'format', approved_post.format,
      'post_text', approved_post.post_text,
      'first_comment', approved_post.first_comment,
      'asset_urls', approved_post.asset_urls,
      'alt_text', approved_post.alt_text,
      'scheduled_for', approved_post.scheduled_for,
      'publish_enabled', approved_post.publish_enabled,
      'quality_report', approved_post.quality_report
    )
  );

  update public.social_packages package
  set status = case
        when exists (
          select 1
          from public.social_posts post
          where post.package_id = package.id
            and post.publish_enabled
        )
        and not exists (
          select 1
          from public.social_posts post
          where post.package_id = package.id
            and post.publish_enabled
            and post.status <> 'approved'
        ) then 'approved'
        else 'in_review'
      end,
      updated_at = now()
  where package.id = approved_post.package_id;

  return approved_post;
end;
$function$;

create or replace function public.approve_social_package(p_package_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $function$
declare
  post_id uuid;
  approved_count integer := 0;
  v_package public.social_packages;
  v_selection_run_id uuid;
  v_latest_review_action text;
  v_rationale jsonb := '{}'::jsonb;
begin
  if public.social_admin_role() <> 'owner' then
    raise exception 'Owner session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_social_action', 'allowed', true);

  select package.*
    into v_package
  from public.social_packages package
  where package.id = p_package_id
  for update;
  if v_package.id is null then
    raise exception 'Social package was not found';
  end if;

  if v_package.kind = 'weekly_digest' then
    if v_package.weekly_digest_id is null
       or v_package.weekly_digest_revision_id is null
       or not exists (
         select 1
         from public.weekly_digests digest
         where digest.id = v_package.weekly_digest_id
           and digest.active_revision_id = v_package.weekly_digest_revision_id
           and digest.status not in ('publishing', 'published', 'cancelled')
       ) then
      raise exception 'Weekly social package must target the active editable revision';
    end if;
    if (
      select count(*)
      from public.social_posts post
      where post.package_id = p_package_id
        and post.channel in ('telegram', 'facebook', 'linkedin', 'x', 'threads', 'instagram')
    ) <> 6 then
      raise exception 'Weekly social package must contain exactly six channel variants';
    end if;

    select review.action
      into v_latest_review_action
    from public.weekly_digest_reviews review
    where review.weekly_digest_id = v_package.weekly_digest_id
      and (
        review.revision_id is null
        or review.revision_id = v_package.weekly_digest_revision_id
      )
    order by review.created_at desc, review.id desc
    limit 1;
    if v_latest_review_action = 'changes_requested' then
      raise exception 'Resolve the weekly digest change request before approval';
    end if;
  end if;

  if not exists (
    select 1
    from public.social_posts post
    where post.package_id = p_package_id
      and post.publish_enabled
  ) then
    raise exception 'Package has no enabled variants';
  end if;
  if exists (
    select 1
    from public.social_posts post
    where post.package_id = p_package_id
      and post.publish_enabled
      and (
        post.content_hash is null
        or jsonb_array_length(coalesce(post.quality_report -> 'blocking', '[]'::jsonb)) > 0
        or post.status not in ('draft', 'in_review', 'approved', 'failed')
      )
  ) then
    raise exception 'Package contains a blocked or non-reviewable enabled variant';
  end if;

  for post_id in
    select post.id
    from public.social_posts post
    where post.package_id = p_package_id
      and post.publish_enabled
      and post.status <> 'approved'
    order by post.created_at
  loop
    perform public.approve_social_post(post_id);
    approved_count := approved_count + 1;
  end loop;

  update public.social_packages
  set status = 'approved',
      updated_at = now()
  where id = p_package_id;

  if v_package.kind = 'weekly_digest' then
    select run.id, run.rationale
      into v_selection_run_id, v_rationale
    from public.weekly_digest_selection_runs run
    where run.weekly_digest_id = v_package.weekly_digest_id
    order by run.created_at desc, run.id desc
    limit 1;

    insert into public.weekly_digest_reviews (
      weekly_digest_id,
      revision_id,
      package_id,
      selection_run_id,
      reviewer_id,
      action,
      digest_snapshot
    ) values (
      v_package.weekly_digest_id,
      v_package.weekly_digest_revision_id,
      v_package.id,
      v_selection_run_id,
      auth.uid(),
      'approved',
      jsonb_build_object(
        'rationale', coalesce(v_rationale, '{}'::jsonb),
        'revision_id', v_package.weekly_digest_revision_id,
        'social_package_id', v_package.id
      )
    );
  end if;

  -- Deliberately do not update weekly_digests.status here. Digest approval and
  -- publication are separate owner/release-worker operations.
  return approved_count;
end;
$function$;

create or replace function public.auto_approve_green_package(p_package_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  allowed boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.social_packages package
    cross join public.social_settings settings
    where package.id = p_package_id
      and package.kind <> 'weekly_digest'
      and package.risk_level = 'green'
      and package.status = 'in_review'
      and settings.id = true
      and settings.auto_publish_green
      and settings.green_success_count >= 30
      and not exists (
        select 1
        from public.social_posts post
        where post.package_id = package.id
          and (
            post.content_hash is null
            or jsonb_array_length(coalesce(post.quality_report -> 'blocking', '[]'::jsonb)) > 0
          )
      )
  ) into allowed;
  if not allowed then
    return false;
  end if;

  update public.social_posts
  set status = 'approved',
      approval_version = content_version,
      approved_at = now(),
      approved_by = null
  where package_id = p_package_id
    and status = 'in_review';

  insert into public.social_post_reviews (
    social_post_id,
    package_id,
    reviewer_id,
    action,
    content_version,
    content_hash,
    snapshot,
    note
  )
  select
    post.id,
    post.package_id,
    null,
    'approved',
    post.content_version,
    post.content_hash,
    jsonb_build_object(
      'channel', post.channel,
      'post_text', post.post_text,
      'first_comment', post.first_comment,
      'asset_urls', post.asset_urls,
      'scheduled_for', post.scheduled_for,
      'quality_report', post.quality_report
    ),
    'Automatic green approval after 30 incident-free green deliveries'
  from public.social_posts post
  where post.package_id = p_package_id;

  update public.social_packages
  set status = 'approved',
      updated_at = now()
  where id = p_package_id;
  return true;
end;
$function$;

create or replace function public.claim_due_social_posts(p_limit integer default 10)
returns setof public.social_posts
language plpgsql
security definer
set search_path = public
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  return query
  with settings as (
    select
      global_kill_switch,
      channel_enabled,
      x_monthly_budget_eur,
      x_monthly_spend_eur
    from public.social_settings
    where id = true
  ),
  candidates as (
    select post.id
    from public.social_posts post
    join public.social_packages package
      on package.id = post.package_id
    cross join settings
    left join public.social_accounts account
      on account.channel = post.channel
    where post.publish_enabled
      and not settings.global_kill_switch
      and coalesce((settings.channel_enabled ->> post.channel)::boolean, false)
      and coalesce(account.enabled, false)
      and (
        post.channel <> 'x'
        or settings.x_monthly_spend_eur < settings.x_monthly_budget_eur
      )
      and post.status in ('approved', 'scheduled', 'failed')
      and (post.status <> 'failed' or post.retry_after is not null)
      and post.approval_version = post.content_version
      and post.content_hash is not null
      and post.attempts < 4
      and coalesce(post.retry_after, post.scheduled_for) <= now()
      and (
        package.id is null
        or package.kind <> 'weekly_digest'
        or exists (
          select 1
          from public.weekly_digests digest
          where digest.id = package.weekly_digest_id
            and digest.status = 'published'
            and digest.published_revision_id = package.weekly_digest_revision_id
        )
      )
    order by coalesce(post.retry_after, post.scheduled_for), post.created_at
    for update of post skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 10))
  ),
  claimed as (
    update public.social_posts post
    set status = 'publishing',
        attempts = post.attempts + 1,
        publishing_started_at = now(),
        retry_after = null,
        last_error = null
    from candidates
    where post.id = candidates.id
    returning post.*
  )
  select *
  from claimed;
end;
$function$;

-- Editors may request/address changes at AAL1. These replace the legacy AAL2
-- versions and bind every event to the active immutable revision.
create or replace function public.request_weekly_digest_changes(
  p_package_id uuid,
  p_reason_codes text[],
  p_note text,
  p_item_feedback jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_package_status text;
  v_selection_run_id uuid;
  v_candidate_pool jsonb := '[]'::jsonb;
  v_latest_review_action text;
  v_review_id uuid;
begin
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_reason_codes), 0) = 0
     or not (p_reason_codes <@ array[
       'missing_important_story',
       'wrong_story_selected',
       'wrong_priority_or_order',
       'inaccurate_or_misleading',
       'weak_summary_or_why',
       'poor_tone_or_writing',
       'insufficient_evidence',
       'other'
     ]::text[]) then
    raise exception 'Select at least one valid review reason';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 10 and 2000 then
    raise exception 'Review note must contain 10 to 2000 characters';
  end if;
  if jsonb_typeof(coalesce(p_item_feedback, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_item_feedback, '[]'::jsonb)) > 30 then
    raise exception 'Item feedback must be an array of at most 30 entries';
  end if;

  select digest.*
    into v_digest
  from public.social_packages package
  join public.weekly_digests digest
    on digest.id = package.weekly_digest_id
  where package.id = p_package_id
    and package.kind = 'weekly_digest'
    and package.weekly_digest_revision_id = digest.active_revision_id
  for update of digest, package;
  if v_digest.id is null then
    raise exception 'Active weekly digest package was not found';
  end if;

  select package.status
    into v_package_status
  from public.social_packages package
  where package.id = p_package_id;

  if v_package_status not in ('in_review', 'approved', 'scheduled') then
    raise exception 'Only a reviewable weekly digest can receive change requests';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before requesting changes'
      using errcode = '55000';
  end if;
  if v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'Weekly digest can no longer be changed';
  end if;

  select review.action
    into v_latest_review_action
  from public.weekly_digest_reviews review
  where review.weekly_digest_id = v_digest.id
    and review.revision_id = v_digest.active_revision_id
  order by review.created_at desc, review.id desc
  limit 1;
  if v_latest_review_action = 'changes_requested' then
    raise exception 'Weekly digest already has an open change request';
  end if;

  select run.id, run.candidate_pool
    into v_selection_run_id, v_candidate_pool
  from public.weekly_digest_selection_runs run
  where run.weekly_digest_id = v_digest.id
  order by run.created_at desc, run.id desc
  limit 1;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_item_feedback, '[]'::jsonb))
      as feedback(value)
    where jsonb_typeof(feedback.value) <> 'object'
      or coalesce(feedback.value ->> 'action', '') not in
        ('keep', 'remove', 'add', 'replace', 'reorder', 'edit')
      or nullif(feedback.value ->> 'brief_item_id', '') is null
      or feedback.value ->> 'brief_item_id'
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Item feedback contains an invalid entry';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_item_feedback, '[]'::jsonb))
      as feedback(value)
    where case
      when feedback.value ->> 'action' = 'add' then not exists (
        select 1
        from jsonb_array_elements(coalesce(v_candidate_pool, '[]'::jsonb))
          as candidate(value)
        where candidate.value ->> 'brief_item_id'
                = feedback.value ->> 'brief_item_id'
          and candidate.value ->> 'status' = 'eligible_not_selected'
      )
      else not exists (
        select 1
        from public.weekly_digest_revision_items item
        where item.revision_id = v_digest.active_revision_id
          and item.brief_item_id::text = feedback.value ->> 'brief_item_id'
      )
    end
  ) then
    raise exception 'Item feedback references a story outside this selection run';
  end if;

  insert into public.weekly_digest_reviews (
    weekly_digest_id,
    revision_id,
    package_id,
    selection_run_id,
    reviewer_id,
    action,
    reason_codes,
    note,
    digest_snapshot
  ) values (
    v_digest.id,
    v_digest.active_revision_id,
    p_package_id,
    v_selection_run_id,
    auth.uid(),
    'changes_requested',
    p_reason_codes,
    btrim(p_note),
    jsonb_build_object(
      'package_status', v_package_status,
      'revision_id', v_digest.active_revision_id
    )
  )
  returning id into v_review_id;

  insert into public.weekly_digest_review_items (
    review_id,
    brief_item_id,
    action,
    reason_codes,
    note,
    previous_rank,
    requested_rank,
    candidate_snapshot
  )
  select
    v_review_id,
    (feedback.value ->> 'brief_item_id')::uuid,
    feedback.value ->> 'action',
    p_reason_codes,
    nullif(left(btrim(coalesce(feedback.value ->> 'note', '')), 1000), ''),
    (
      select item.rank
      from public.weekly_digest_revision_items item
      where item.revision_id = v_digest.active_revision_id
        and item.brief_item_id::text = feedback.value ->> 'brief_item_id'
    ),
    nullif(feedback.value ->> 'requested_rank', '')::smallint,
    coalesce((
      select candidate.value
      from jsonb_array_elements(coalesce(v_candidate_pool, '[]'::jsonb))
        as candidate(value)
      where candidate.value ->> 'brief_item_id'
              = feedback.value ->> 'brief_item_id'
      limit 1
    ), '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_item_feedback, '[]'::jsonb))
    as feedback(value);

  insert into public.social_post_reviews (
    social_post_id,
    package_id,
    reviewer_id,
    action,
    content_version,
    content_hash,
    snapshot,
    note
  )
  select
    post.id,
    post.package_id,
    auth.uid(),
    'auto_revoked',
    post.content_version,
    post.content_hash,
    jsonb_build_object(
      'status', post.status,
      'channel', post.channel,
      'scheduled_for', post.scheduled_for
    ),
    'Weekly digest changes requested'
  from public.social_posts post
  where post.package_id = p_package_id
    and post.status in ('approved', 'scheduled', 'failed');

  update public.social_posts
  set status = 'in_review',
      approval_version = null,
      approved_by = null,
      approved_at = null,
      retry_after = null
  where package_id = p_package_id
    and status in ('draft', 'in_review', 'approved', 'scheduled', 'failed');

  update public.social_packages
  set status = 'in_review',
      updated_at = now()
  where id = p_package_id;

  update public.weekly_digests
  set status = 'changes_requested',
      approved_by = null,
      approved_at = null,
      preflight_override = null,
      preflight_override_by = null,
      preflight_override_at = null,
      preflight_checked_at = null,
      scheduled_at = null,
      publishing_started_at = null
  where id = v_digest.id;

  return v_review_id;
end;
$function$;

create or replace function public.address_weekly_digest_changes(
  p_package_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_parent_review_id uuid;
  v_latest_action text;
  v_review_id uuid;
begin
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Resolution note must not exceed 2000 characters';
  end if;

  select digest.*
    into v_digest
  from public.social_packages package
  join public.weekly_digests digest
    on digest.id = package.weekly_digest_id
  where package.id = p_package_id
    and package.kind = 'weekly_digest'
    and package.weekly_digest_revision_id = digest.active_revision_id
  for update of digest, package;
  if v_digest.id is null then
    raise exception 'Active weekly digest package was not found';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before addressing changes'
      using errcode = '55000';
  end if;

  select review.id, review.action
    into v_parent_review_id, v_latest_action
  from public.weekly_digest_reviews review
  where review.weekly_digest_id = v_digest.id
    and review.revision_id = v_digest.active_revision_id
  order by review.created_at desc, review.id desc
  limit 1;
  if v_latest_action is distinct from 'changes_requested' then
    raise exception 'Weekly digest has no open change request';
  end if;

  insert into public.weekly_digest_reviews (
    weekly_digest_id,
    revision_id,
    package_id,
    selection_run_id,
    parent_review_id,
    reviewer_id,
    action,
    note,
    digest_snapshot
  ) values (
    v_digest.id,
    v_digest.active_revision_id,
    p_package_id,
    (
      select run.id
      from public.weekly_digest_selection_runs run
      where run.weekly_digest_id = v_digest.id
      order by run.created_at desc, run.id desc
      limit 1
    ),
    v_parent_review_id,
    auth.uid(),
    'changes_addressed',
    nullif(btrim(coalesce(p_note, '')), ''),
    jsonb_build_object('addresses_review_id', v_parent_review_id)
  )
  returning id into v_review_id;

  update public.weekly_digests
  set status = 'in_review'
  where id = v_digest.id
    and status = 'changes_requested';

  return v_review_id;
end;
$function$;

-- ── Direct-write lifecycle guards ─────────────────────────────────────────

create or replace function public.guard_weekly_digest_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_role text := public.social_admin_role();
begin
  if v_is_service then
    return new;
  end if;
  if v_role not in ('owner', 'editor') then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'in_review') then
      raise exception 'New weekly digests must begin as draft or in review';
    end if;
    if new.published_at is not null
       or new.published_revision_id is not null
       or new.approved_by is not null
       or new.approved_at is not null then
      raise exception 'Approval and publication fields cannot be set directly';
    end if;
    return new;
  end if;

  if new.status in ('publishing', 'published', 'failed') then
    raise exception 'Only the release worker may set status %', new.status
      using errcode = '42501';
  end if;
  if new.published_revision_id is distinct from old.published_revision_id
     or new.published_at is distinct from old.published_at
     or (
       new.publishing_started_at is distinct from old.publishing_started_at
       and not (
         new.status = 'paused'
         and v_role = 'owner'
         and public.has_social_aal2()
       )
     ) then
    raise exception 'Only the release worker may change publication fields'
      using errcode = '42501';
  end if;
  if new.active_revision_id is distinct from old.active_revision_id
     and current_setting('app.weekly_digest_revision_write', true)
       is distinct from 'allowed' then
    raise exception 'Active revision may be changed only by the revision RPC'
      using errcode = '42501';
  end if;
  if new.title_en is distinct from old.title_en
     or new.title_uk is distinct from old.title_uk
     or new.intro_en is distinct from old.intro_en
     or new.intro_uk is distinct from old.intro_uk
     or new.week_start is distinct from old.week_start
     or new.week_end is distinct from old.week_end
     or new.period_model is distinct from old.period_model
     or new.slug is distinct from old.slug then
    raise exception 'Edition content and calendar fields change only through immutable revisions'
      using errcode = '42501';
  end if;
  if new.preflight_override is not null
     and (
       new.preflight_override is distinct from old.preflight_override
       or new.preflight_override_by is distinct from old.preflight_override_by
       or new.preflight_override_at is distinct from old.preflight_override_at
     )
     and current_setting('app.weekly_digest_override', true) is distinct from 'allowed' then
    raise exception 'Preflight overrides may be created only by the approval RPC'
      using errcode = '42501';
  end if;
  if (
    new.status in ('approved', 'scheduled', 'paused', 'cancelled')
    or (
      new.release_at is distinct from old.release_at
      and new.status <> 'in_review'
    )
    or (
      new.preflight_at is distinct from old.preflight_at
      and new.status <> 'in_review'
    )
    or new.approved_by is not null
    or new.approved_at is not null
    or new.scheduled_at is not null
  ) and current_setting('app.weekly_digest_release_action', true)
        is distinct from 'allowed' then
    raise exception 'Release transitions may be performed only by lifecycle RPCs'
      using errcode = '42501';
  end if;

  if (
    new.status in ('approved', 'scheduled', 'paused', 'cancelled')
    or (
      new.release_at is distinct from old.release_at
      and new.status <> 'in_review'
    )
    or (
      new.preflight_at is distinct from old.preflight_at
      and new.status <> 'in_review'
    )
    or new.approved_by is not null
    or new.approved_at is not null
    or new.scheduled_at is not null
  ) and (v_role <> 'owner' or not public.has_social_aal2()) then
    raise exception 'Only an AAL2 owner may approve, schedule, pause, or cancel a release'
      using errcode = '42501';
  end if;

  if old.status = 'scheduled'
     and now() >= coalesce(old.preflight_at, old.release_at)
     and new.status <> 'paused'
     and (
       new.active_revision_id is distinct from old.active_revision_id
       or new.title_en is distinct from old.title_en
       or new.title_uk is distinct from old.title_uk
       or new.intro_en is distinct from old.intro_en
       or new.intro_uk is distinct from old.intro_uk
       or new.status is distinct from old.status
       or new.release_at is distinct from old.release_at
       or new.preflight_at is distinct from old.preflight_at
     ) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

drop trigger if exists weekly_digests_lifecycle_guard on public.weekly_digests;
create trigger weekly_digests_lifecycle_guard
  before insert or update on public.weekly_digests
  for each row execute function public.guard_weekly_digest_lifecycle();

create or replace function public.guard_weekly_digest_revision_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if current_setting('app.weekly_digest_revision_write', true)
       is distinct from 'allowed' then
    raise exception 'Revision rows may be inserted only by the revision RPC'
      using errcode = '42501';
  end if;

  if tg_table_name = 'weekly_digest_revisions' then
    select digest.*
      into v_digest
    from public.weekly_digests digest
    where digest.id = new.weekly_digest_id;
  else
    v_revision_id := new.revision_id;
    select digest.*
      into v_digest
    from public.weekly_digest_revisions revision
    join public.weekly_digests digest
      on digest.id = revision.weekly_digest_id
    where revision.id = v_revision_id;
  end if;

  if v_digest.id is null
     or v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'An editable weekly digest is required';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;
  return new;
end;
$function$;

drop trigger if exists weekly_digest_revisions_write_guard
  on public.weekly_digest_revisions;
create trigger weekly_digest_revisions_write_guard
  before insert on public.weekly_digest_revisions
  for each row execute function public.guard_weekly_digest_revision_write();

drop trigger if exists weekly_digest_revision_items_write_guard
  on public.weekly_digest_revision_items;
create trigger weekly_digest_revision_items_write_guard
  before insert on public.weekly_digest_revision_items
  for each row execute function public.guard_weekly_digest_revision_write();

create or replace function public.guard_weekly_digest_artifact_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if tg_op = 'INSERT'
     and current_setting('app.weekly_digest_artifact_write', true)
       is distinct from 'allowed' then
    raise exception 'Artifact versions may be inserted only by the artifact RPC'
      using errcode = '42501';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = new.weekly_digest_id
    and digest.active_revision_id = new.revision_id;
  if v_digest.id is null
     or v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'Artifacts may target only the editable active revision';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and (
    new.weekly_digest_id is distinct from old.weekly_digest_id
    or new.revision_id is distinct from old.revision_id
    or new.revision_item_id is distinct from old.revision_item_id
    or new.artifact_type is distinct from old.artifact_type
    or new.locale is distinct from old.locale
    or new.slot_key is distinct from old.slot_key
    or new.version is distinct from old.version
    or new.input_hash is distinct from old.input_hash
    or new.content is distinct from old.content
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.external_url is distinct from old.external_url
    or new.provider is distinct from old.provider
    or new.provider_id is distinct from old.provider_id
    or new.mime_type is distinct from old.mime_type
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.byte_size is distinct from old.byte_size
    or new.duration_seconds is distinct from old.duration_seconds
    or new.metadata is distinct from old.metadata
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Artifact identity and dependency fields are immutable';
  end if;
  if tg_op = 'UPDATE'
     and new.review_status is distinct from old.review_status
     and current_setting('app.weekly_digest_artifact_write', true)
           is distinct from 'allowed'
     and current_setting('app.weekly_digest_artifact_review', true)
           is distinct from 'allowed' then
    raise exception 'Artifact review state may be changed only by artifact workflow RPCs'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE'
     and new.published_at is distinct from old.published_at then
    raise exception 'Only the release worker may publish an artifact'
      using errcode = '42501';
  end if;
  if new.review_status = 'approved'
     and public.social_admin_role() <> 'owner' then
    raise exception 'Only an owner may approve an artifact'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists weekly_digest_artifacts_write_guard
  on public.weekly_digest_artifacts;
create trigger weekly_digest_artifacts_write_guard
  before insert or update on public.weekly_digest_artifacts
  for each row execute function public.guard_weekly_digest_artifact_write();

create or replace function public.guard_social_v2_owner_actions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_role text := public.social_admin_role();
begin
  if v_is_service then
    return new;
  end if;
  if v_role not in ('owner', 'editor') then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;

  if tg_table_name = 'social_posts' then
    if new.status in ('publishing', 'posted', 'failed', 'needs_reconciliation') then
      raise exception 'Only the social publishing worker may set status %', new.status
        using errcode = '42501';
    end if;
    if (
      new.status in ('approved', 'scheduled', 'cancelled')
      or new.publish_enabled is distinct from old.publish_enabled
    ) and current_setting('app.weekly_digest_social_action', true)
          is distinct from 'allowed' then
      raise exception 'Social approval/schedule transitions require a workflow RPC'
        using errcode = '42501';
    end if;
    if (
      new.status = 'approved'
      or new.approval_version is not null
      or new.approved_by is not null
      or new.approved_at is not null
    ) and v_role <> 'owner' then
      raise exception 'Only an owner may approve a social variant'
        using errcode = '42501';
    end if;
    if (
      new.status in ('scheduled', 'cancelled')
      or new.publish_enabled is distinct from old.publish_enabled
      or new.scheduled_for is distinct from old.scheduled_for
    ) and (v_role <> 'owner' or not public.has_social_aal2()) then
      raise exception 'Only an AAL2 owner may schedule or disable a social variant'
        using errcode = '42501';
    end if;
  else
    if new.status in ('publishing', 'posted', 'failed', 'needs_reconciliation') then
      raise exception 'Only the social publishing worker may set package status %', new.status
        using errcode = '42501';
    end if;
    if new.status in ('approved', 'scheduled', 'cancelled')
       and current_setting('app.weekly_digest_social_action', true)
             is distinct from 'allowed' then
      raise exception 'Social package transitions require a workflow RPC'
        using errcode = '42501';
    end if;
    if new.status = 'approved' and v_role <> 'owner' then
      raise exception 'Only an owner may approve a social package'
        using errcode = '42501';
    end if;
    if new.status in ('scheduled', 'cancelled')
       and (v_role <> 'owner' or not public.has_social_aal2()) then
      raise exception 'Only an AAL2 owner may schedule or cancel a social package'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists social_posts_v2_owner_guard on public.social_posts;
create trigger social_posts_v2_owner_guard
  before update on public.social_posts
  for each row execute function public.guard_social_v2_owner_actions();

drop trigger if exists social_packages_v2_owner_guard on public.social_packages;
create trigger social_packages_v2_owner_guard
  before update on public.social_packages
  for each row execute function public.guard_social_v2_owner_actions();

create or replace function public.attach_weekly_digest_review_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if new.revision_id is null then
    select digest.active_revision_id
      into new.revision_id
    from public.weekly_digests digest
    where digest.id = new.weekly_digest_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists weekly_digest_reviews_attach_revision
  on public.weekly_digest_reviews;
create trigger weekly_digest_reviews_attach_revision
  before insert on public.weekly_digest_reviews
  for each row execute function public.attach_weekly_digest_review_revision();

create or replace function public.sync_weekly_digest_review_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if new.action = 'changes_requested' then
    update public.weekly_digests
    set status = 'changes_requested',
        approved_by = null,
        approved_at = null,
        preflight_override = null,
        preflight_override_by = null,
        preflight_override_at = null,
        preflight_checked_at = null,
        scheduled_at = null,
        publishing_started_at = null
    where id = new.weekly_digest_id
      and status not in ('publishing', 'published', 'cancelled');
  elsif new.action = 'changes_addressed' then
    update public.weekly_digests
    set status = 'in_review'
    where id = new.weekly_digest_id
      and status = 'changes_requested';
  end if;
  return null;
end;
$function$;

drop trigger if exists weekly_digest_reviews_sync_state
  on public.weekly_digest_reviews;
create constraint trigger weekly_digest_reviews_sync_state
  after insert on public.weekly_digest_reviews
  deferrable initially deferred
  for each row execute function public.sync_weekly_digest_review_state();

-- ── RLS: public sees only the published pointer; admin drafts stay private ─

alter table public.weekly_digest_revisions enable row level security;
alter table public.weekly_digest_revision_items enable row level security;
alter table public.weekly_digest_artifacts enable row level security;
alter table public.weekly_digest_artifact_reviews enable row level security;
alter table public.weekly_digest_generation_jobs enable row level security;
alter table public.weekly_digest_release_events enable row level security;

drop policy if exists "weekly revisions: public published" on public.weekly_digest_revisions;
create policy "weekly revisions: public published"
  on public.weekly_digest_revisions
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.weekly_digests digest
      where digest.id = weekly_digest_revisions.weekly_digest_id
        and digest.status = 'published'
        and digest.published_revision_id = weekly_digest_revisions.id
    )
  );

drop policy if exists "weekly revision items: public published"
  on public.weekly_digest_revision_items;
create policy "weekly revision items: public published"
  on public.weekly_digest_revision_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.weekly_digest_revisions revision
      join public.weekly_digests digest
        on digest.id = revision.weekly_digest_id
      where revision.id = weekly_digest_revision_items.revision_id
        and digest.status = 'published'
        and digest.published_revision_id = revision.id
    )
  );

drop policy if exists "weekly artifacts: public published"
  on public.weekly_digest_artifacts;
create policy "weekly artifacts: public published"
  on public.weekly_digest_artifacts
  for select
  to anon, authenticated
  using (
    is_current
    and generation_status = 'ready'
    and review_status = 'approved'
    and published_at is not null
    and artifact_type in (
      'article',
      'pdf',
      'cover',
      'story_image',
      'video_final',
      'captions',
      'thumbnail'
    )
    and exists (
      select 1
      from public.weekly_digests digest
      where digest.id = weekly_digest_artifacts.weekly_digest_id
        and digest.status = 'published'
        and digest.published_revision_id = weekly_digest_artifacts.revision_id
    )
  );

drop policy if exists "weekly revisions: admin read" on public.weekly_digest_revisions;
create policy "weekly revisions: admin read"
  on public.weekly_digest_revisions
  for select
  to authenticated
  using (public.is_social_admin());

drop policy if exists "weekly revision items: admin read"
  on public.weekly_digest_revision_items;
create policy "weekly revision items: admin read"
  on public.weekly_digest_revision_items
  for select
  to authenticated
  using (public.is_social_admin());

drop policy if exists "weekly artifacts: admin read" on public.weekly_digest_artifacts;
create policy "weekly artifacts: admin read"
  on public.weekly_digest_artifacts
  for select
  to authenticated
  using (public.is_social_admin());

drop policy if exists "weekly artifact reviews: admin read"
  on public.weekly_digest_artifact_reviews;
create policy "weekly artifact reviews: admin read"
  on public.weekly_digest_artifact_reviews
  for select
  to authenticated
  using (public.is_social_admin());

drop policy if exists "weekly generation jobs: admin read"
  on public.weekly_digest_generation_jobs;
create policy "weekly generation jobs: admin read"
  on public.weekly_digest_generation_jobs
  for select
  to authenticated
  using (public.is_social_admin());

drop policy if exists "weekly release events: admin read"
  on public.weekly_digest_release_events;
create policy "weekly release events: admin read"
  on public.weekly_digest_release_events
  for select
  to authenticated
  using (public.is_social_admin());

drop policy if exists "weekly revisions: editorial insert"
  on public.weekly_digest_revisions;
create policy "weekly revisions: editorial insert"
  on public.weekly_digest_revisions
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
    and created_by = auth.uid()
    and exists (
      select 1
      from public.weekly_digests digest
      where digest.id = weekly_digest_revisions.weekly_digest_id
        and digest.status not in ('publishing', 'published', 'cancelled')
        and not (
          digest.status = 'scheduled'
          and now() >= coalesce(digest.preflight_at, digest.release_at)
        )
    )
  );

drop policy if exists "weekly revision items: editorial insert"
  on public.weekly_digest_revision_items;
create policy "weekly revision items: editorial insert"
  on public.weekly_digest_revision_items
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
    and exists (
      select 1
      from public.weekly_digest_revisions revision
      join public.weekly_digests digest
        on digest.id = revision.weekly_digest_id
      where revision.id = weekly_digest_revision_items.revision_id
        and revision.created_by = auth.uid()
        and digest.status not in ('publishing', 'published', 'cancelled')
        and not (
          digest.status = 'scheduled'
          and now() >= coalesce(digest.preflight_at, digest.release_at)
        )
    )
  );

drop policy if exists "weekly artifacts: editorial insert"
  on public.weekly_digest_artifacts;
create policy "weekly artifacts: editorial insert"
  on public.weekly_digest_artifacts
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
    and created_by = auth.uid()
    and exists (
      select 1
      from public.weekly_digests digest
      where digest.id = weekly_digest_artifacts.weekly_digest_id
        and digest.active_revision_id = weekly_digest_artifacts.revision_id
        and digest.status not in ('publishing', 'published', 'cancelled')
        and not (
          digest.status = 'scheduled'
          and now() >= coalesce(digest.preflight_at, digest.release_at)
        )
    )
  );

drop policy if exists "weekly artifacts: editorial update"
  on public.weekly_digest_artifacts;
create policy "weekly artifacts: editorial update"
  on public.weekly_digest_artifacts
  for update
  to authenticated
  using (
    public.has_social_role(array['owner', 'editor'])
  )
  with check (
    public.has_social_role(array['owner', 'editor'])
  );

drop policy if exists "weekly artifact reviews: editorial insert"
  on public.weekly_digest_artifact_reviews;
create policy "weekly artifact reviews: editorial insert"
  on public.weekly_digest_artifact_reviews
  for insert
  to authenticated
  with check (
    public.is_social_admin()
    and (
      (
        action = 'commented'
        and reviewer_id = auth.uid()
      )
      or (
        public.has_social_role(array['owner', 'editor'])
        and (
          reviewer_id = auth.uid()
          or (
            reviewer_id is null
            and action = 'carried_forward'
          )
        )
        and (
          action <> 'approved'
          or public.social_admin_role() = 'owner'
        )
      )
    )
  );

drop policy if exists "weekly release events: editorial insert"
  on public.weekly_digest_release_events;
create policy "weekly release events: editorial insert"
  on public.weekly_digest_release_events
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
    and actor_id = auth.uid()
  );

-- Replace broad legacy write policies with product roles. Trigger guards above
-- still enforce owner-only state transitions even for direct REST mutations.
drop policy if exists "weekly digests: aal2 write" on public.weekly_digests;
drop policy if exists "weekly digests: editorial insert" on public.weekly_digests;
create policy "weekly digests: editorial insert"
  on public.weekly_digests
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
  );
drop policy if exists "weekly digests: editorial update" on public.weekly_digests;
create policy "weekly digests: editorial update"
  on public.weekly_digests
  for update
  to authenticated
  using (
    public.has_social_role(array['owner', 'editor'])
  )
  with check (
    public.has_social_role(array['owner', 'editor'])
  );
drop policy if exists "weekly digests: owner delete" on public.weekly_digests;
create policy "weekly digests: owner delete"
  on public.weekly_digests
  for delete
  to authenticated
  using (
    public.social_admin_role() = 'owner'
    and public.has_social_aal2()
    and status in ('draft', 'cancelled')
  );

drop policy if exists "weekly items: aal2 write" on public.weekly_digest_items;
drop policy if exists "weekly items: editorial write" on public.weekly_digest_items;
drop policy if exists "weekly items: editorial insert" on public.weekly_digest_items;
create policy "weekly items: editorial insert"
  on public.weekly_digest_items
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
  );
drop policy if exists "weekly items: editorial update" on public.weekly_digest_items;
create policy "weekly items: editorial update"
  on public.weekly_digest_items
  for update
  to authenticated
  using (public.has_social_role(array['owner', 'editor']))
  with check (public.has_social_role(array['owner', 'editor']));

drop policy if exists "social cms: aal2 write" on public.social_packages;
drop policy if exists "social packages: editorial write" on public.social_packages;
drop policy if exists "social packages: editorial insert" on public.social_packages;
create policy "social packages: editorial insert"
  on public.social_packages
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
  );
drop policy if exists "social packages: editorial update" on public.social_packages;
create policy "social packages: editorial update"
  on public.social_packages
  for update
  to authenticated
  using (public.has_social_role(array['owner', 'editor']))
  with check (public.has_social_role(array['owner', 'editor']));

drop policy if exists "social cms: aal2 write" on public.social_posts;
drop policy if exists "social posts: editorial write" on public.social_posts;
drop policy if exists "social posts: editorial insert" on public.social_posts;
create policy "social posts: editorial insert"
  on public.social_posts
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
  );
drop policy if exists "social posts: editorial update" on public.social_posts;
create policy "social posts: editorial update"
  on public.social_posts
  for update
  to authenticated
  using (public.has_social_role(array['owner', 'editor']))
  with check (public.has_social_role(array['owner', 'editor']));

drop policy if exists "social cms: aal2 write" on public.social_post_reviews;
drop policy if exists "social post reviews: editorial insert"
  on public.social_post_reviews;
create policy "social post reviews: editorial insert"
  on public.social_post_reviews
  for insert
  to authenticated
  with check (
    public.is_social_admin()
    and reviewer_id = auth.uid()
    and (
      action = 'commented'
      or public.has_social_role(array['owner', 'editor'])
    )
  );

drop policy if exists "weekly reviews: aal2 insert" on public.weekly_digest_reviews;
drop policy if exists "weekly reviews: editorial insert" on public.weekly_digest_reviews;
create policy "weekly reviews: editorial insert"
  on public.weekly_digest_reviews
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
    and reviewer_id = auth.uid()
    and (
      action <> 'approved'
      or public.social_admin_role() = 'owner'
    )
  );

drop policy if exists "weekly review items: aal2 insert"
  on public.weekly_digest_review_items;
drop policy if exists "weekly review items: editorial insert"
  on public.weekly_digest_review_items;
create policy "weekly review items: editorial insert"
  on public.weekly_digest_review_items
  for insert
  to authenticated
  with check (
    public.has_social_role(array['owner', 'editor'])
    and exists (
      select 1
      from public.weekly_digest_reviews review
      where review.id = weekly_digest_review_items.review_id
        and review.reviewer_id = auth.uid()
    )
  );

-- Explicit grants prevent Supabase default privileges from exposing private
-- operational tables if project defaults change later.
revoke all on table public.weekly_digest_revisions
  from public, anon, authenticated;
revoke all on table public.weekly_digest_revision_items
  from public, anon, authenticated;
revoke all on table public.weekly_digest_artifacts
  from public, anon, authenticated;
revoke all on table public.weekly_digest_artifact_reviews
  from public, anon, authenticated;
revoke all on table public.weekly_digest_generation_jobs
  from public, anon, authenticated;
revoke all on table public.weekly_digest_release_events
  from public, anon, authenticated;
revoke all on table public.social_post_reviews
  from public, anon, authenticated;

grant select on table public.weekly_digest_revisions
  to anon, authenticated;
grant insert on table public.weekly_digest_revisions
  to authenticated;
grant select on table public.weekly_digest_revision_items
  to anon, authenticated;
grant insert on table public.weekly_digest_revision_items
  to authenticated;
grant select, insert, update on table public.weekly_digest_artifacts
  to authenticated;
grant select, insert on table public.weekly_digest_artifact_reviews
  to authenticated;
grant select on table public.weekly_digest_generation_jobs
  to authenticated;
grant select, insert on table public.weekly_digest_release_events
  to authenticated;
grant select, insert on table public.social_post_reviews
  to authenticated;

grant all on table public.weekly_digest_revisions to service_role;
grant all on table public.weekly_digest_revision_items to service_role;
grant all on table public.weekly_digest_artifacts to service_role;
grant all on table public.weekly_digest_artifact_reviews to service_role;
grant all on table public.weekly_digest_generation_jobs to service_role;
grant all on table public.weekly_digest_release_events to service_role;
grant all on table public.social_post_reviews to service_role;
grant usage, select on sequence public.weekly_digest_release_events_id_seq
  to service_role;

-- ── Private PDF/visual source storage ─────────────────────────────────────

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'weekly-digest-private',
  'weekly-digest-private',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/vtt',
    'application/json'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "weekly digest private: admin read" on storage.objects;
create policy "weekly digest private: admin read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'weekly-digest-private'
    and public.is_social_admin()
  );

drop policy if exists "weekly digest private: editorial insert" on storage.objects;
create policy "weekly digest private: editorial insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'weekly-digest-private'
    and public.has_social_role(array['owner', 'editor'])
  );

drop policy if exists "weekly digest private: editorial update" on storage.objects;
create policy "weekly digest private: editorial update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'weekly-digest-private'
    and public.has_social_role(array['owner', 'editor'])
  )
  with check (
    bucket_id = 'weekly-digest-private'
    and public.has_social_role(array['owner', 'editor'])
  );

drop policy if exists "weekly digest private: editorial delete" on storage.objects;
create policy "weekly digest private: editorial delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'weekly-digest-private'
    and public.social_admin_role() = 'owner'
    and public.has_social_aal2()
  );

-- ── RPC execute grants ─────────────────────────────────────────────────────

revoke all on function public.set_weekly_social_publish_enabled(uuid, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_weekly_digest_revision(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.save_weekly_digest_artifact(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, text, text,
  text, text, text, integer, integer, bigint, integer, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.review_weekly_digest_artifact(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.comment_weekly_digest_artifact(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.comment_weekly_social_post(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.weekly_digest_preflight(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.approve_weekly_digest(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.approve_weekly_digest(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.schedule_weekly_digest(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.pause_weekly_digest(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.initialize_weekly_digest_revision_from_legacy(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.queue_weekly_digest_generation_job(
  uuid, uuid, text, text, jsonb, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.claim_weekly_digest_generation_jobs(
  text[], integer, interval
) from public, anon, authenticated, service_role;
revoke all on function public.finish_weekly_digest_generation_job(
  uuid, boolean, jsonb, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.claim_due_weekly_digests(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.run_due_weekly_digest_preflights(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_weekly_digest_release(uuid, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.approve_social_post(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.approve_social_package(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.auto_approve_green_package(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.set_weekly_social_publish_enabled(uuid, boolean, text)
  to authenticated;
grant execute on function public.create_weekly_digest_revision(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb
) to authenticated;
grant execute on function public.save_weekly_digest_artifact(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, text, text, text,
  text, text, text, integer, integer, bigint, integer, jsonb
) to authenticated, service_role;
grant execute on function public.review_weekly_digest_artifact(uuid, text, text)
  to authenticated;
grant execute on function public.comment_weekly_digest_artifact(uuid, text)
  to authenticated;
grant execute on function public.comment_weekly_social_post(uuid, text)
  to authenticated;
grant execute on function public.weekly_digest_preflight(uuid)
  to authenticated, service_role;
grant execute on function public.approve_weekly_digest(uuid)
  to authenticated;
grant execute on function public.approve_weekly_digest(uuid, text)
  to authenticated;
grant execute on function public.schedule_weekly_digest(uuid, timestamptz)
  to authenticated;
grant execute on function public.pause_weekly_digest(uuid, text)
  to authenticated;
grant execute on function public.initialize_weekly_digest_revision_from_legacy(uuid)
  to service_role;
grant execute on function public.queue_weekly_digest_generation_job(
  uuid, uuid, text, text, jsonb, uuid
) to authenticated;
grant execute on function public.claim_weekly_digest_generation_jobs(
  text[], integer, interval
) to service_role;
grant execute on function public.finish_weekly_digest_generation_job(
  uuid, boolean, jsonb, text, uuid
) to service_role;
grant execute on function public.claim_due_weekly_digests(integer)
  to service_role;
grant execute on function public.run_due_weekly_digest_preflights(integer)
  to service_role;
grant execute on function public.finish_weekly_digest_release(uuid, boolean, text)
  to service_role;
grant execute on function public.approve_social_post(uuid)
  to authenticated;
grant execute on function public.approve_social_package(uuid)
  to authenticated;
grant execute on function public.auto_approve_green_package(uuid)
  to service_role;

-- Trigger and dependency helpers are not callable API surface.
revoke all on function public.set_weekly_digest_calendar_defaults()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_weekly_digest_immutable_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_weekly_social_locale()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_weekly_digest_lifecycle()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_weekly_digest_revision_write()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_weekly_digest_artifact_write()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_social_v2_owner_actions()
  from public, anon, authenticated, service_role;
revoke all on function public.attach_weekly_digest_review_revision()
  from public, anon, authenticated, service_role;
revoke all on function public.sync_weekly_digest_review_state()
  from public, anon, authenticated, service_role;

commit;
