begin;

-- Weekly Digest Content Studio v2. The public schema remains opt-in: every
-- new object below has RLS enabled and explicit, minimum grants.

alter table public.weekly_digest_artifacts
  drop constraint if exists weekly_digest_artifacts_artifact_type_check,
  add constraint weekly_digest_artifacts_artifact_type_check check (artifact_type in (
    'research_pack',
    'content_quality_report',
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
  ));

alter table public.weekly_digest_generation_jobs
  drop constraint if exists weekly_digest_generation_jobs_job_type_check,
  add constraint weekly_digest_generation_jobs_job_type_check check (job_type in (
    'research_pack',
    'editorial_master',
    'social_copy',
    'article',
    'pdf',
    'cover',
    'story_image',
    'social_asset',
    'video_manifest',
    'artifact_promotion'
  ));

alter table public.social_posts
  add column if not exists content_parts jsonb not null default '[]'::jsonb;

alter table public.social_posts
  drop constraint if exists social_posts_content_parts_array,
  add constraint social_posts_content_parts_array check (
    jsonb_typeof(content_parts) = 'array'
    and jsonb_array_length(content_parts) <= 12
    and not jsonb_path_exists(content_parts, '$[*] ? (@.type() != "string")')
  );

-- A row-per-locale configuration supports a future bilingual experiment
-- without another schema change. Only one locale is the default per channel.
create table if not exists public.weekly_locale_map (
  channel text not null check (channel in (
    'telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook'
  )),
  locale text not null check (locale in ('en', 'uk')),
  enabled boolean not null default true,
  is_default boolean not null default false,
  experiment_key text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (channel, locale),
  check (not is_default or enabled)
);

create unique index if not exists weekly_locale_map_default_channel_uniq
  on public.weekly_locale_map (channel)
  where is_default;

insert into public.weekly_locale_map (channel, locale, enabled, is_default)
values
  ('telegram', 'uk', true, true),
  ('facebook', 'uk', true, true),
  ('threads', 'uk', true, true),
  ('x', 'en', true, true),
  ('linkedin', 'en', true, true),
  ('instagram', 'en', true, true)
on conflict (channel, locale) do update
set enabled = excluded.enabled,
    is_default = excluded.is_default,
    updated_at = now();

create or replace function public.enforce_weekly_social_locale()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_kind text;
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

  if not exists (
    select 1
    from public.weekly_locale_map map
    where map.channel = new.channel
      and map.locale = new.locale
      and map.enabled
  ) then
    raise exception 'Weekly digest channel % does not enable locale %', new.channel, new.locale
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

create or replace function public.guard_social_content_approval()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.post_text is distinct from old.post_text
    or new.content_parts is distinct from old.content_parts
    or new.first_comment is distinct from old.first_comment
    or new.asset_urls is distinct from old.asset_urls
    or new.alt_text is distinct from old.alt_text
    or new.scheduled_for is distinct from old.scheduled_for
    or new.locale is distinct from old.locale
    or new.format is distinct from old.format
  then
    if old.status in ('publishing', 'posted') then
      raise exception 'A publishing or posted variant is immutable';
    end if;
    if new.content_version = old.content_version then
      new.content_version := old.content_version + 1;
    end if;
    if new.content_hash is not distinct from old.content_hash then
      new.content_hash := null;
    end if;
    new.approval_version := null;
    new.approved_by := null;
    new.approved_at := null;
    new.status := 'in_review';
  end if;
  return new;
end;
$function$;

create or replace function public.edit_weekly_social_post_v2(
  p_social_post_id uuid,
  p_expected_version integer,
  p_post_text text,
  p_content_parts jsonb,
  p_first_comment text,
  p_alt_text text,
  p_scheduled_for timestamptz,
  p_quality_report jsonb,
  p_content_hash text
)
returns public.social_posts
language plpgsql
security invoker
set search_path = public
as $function$
declare
  edited_post public.social_posts;
begin
  if not public.is_social_admin() then
    raise exception 'Social admin session required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_content_parts, '[]'::jsonb)) <> 'array' then
    raise exception 'Social content parts must be an array';
  end if;

  update public.social_posts
  set post_text = p_post_text,
      content_parts = coalesce(p_content_parts, '[]'::jsonb),
      first_comment = nullif(p_first_comment, ''),
      alt_text = nullif(p_alt_text, ''),
      scheduled_for = p_scheduled_for,
      quality_report = p_quality_report,
      content_version = content_version + 1,
      content_hash = p_content_hash,
      approval_version = null,
      approved_by = null,
      approved_at = null,
      status = 'in_review',
      retry_after = null,
      last_error = null,
      provider_meta = '{}'::jsonb
  where id = p_social_post_id
    and content_version = p_expected_version
    and status not in ('publishing', 'posted', 'cancelled')
  returning * into edited_post;

  if edited_post.id is null then
    raise exception 'Variant changed concurrently or can no longer be edited';
  end if;

  insert into public.social_post_reviews (
    social_post_id, package_id, reviewer_id, action,
    content_version, content_hash, snapshot
  ) values (
    edited_post.id, edited_post.package_id, auth.uid(), 'edited',
    edited_post.content_version, edited_post.content_hash,
    jsonb_build_object(
      'channel', edited_post.channel,
      'locale', edited_post.locale,
      'format', edited_post.format,
      'post_text', edited_post.post_text,
      'content_parts', edited_post.content_parts,
      'first_comment', edited_post.first_comment,
      'asset_urls', edited_post.asset_urls,
      'alt_text', edited_post.alt_text,
      'scheduled_for', edited_post.scheduled_for,
      'quality_report', edited_post.quality_report
    )
  );

  update public.social_packages
  set status = 'in_review', updated_at = now()
  where id = edited_post.package_id;

  return edited_post;
end;
$function$;

-- Privacy-preserving, first-party engagement events. The public endpoint uses
-- the service role; neither raw IP nor user-agent is stored.
create table if not exists public.weekly_digest_engagement_events (
  id bigint generated always as identity primary key,
  weekly_digest_id uuid not null references public.weekly_digests(id) on delete cascade,
  revision_id uuid not null references public.weekly_digest_revisions(id) on delete cascade,
  social_post_id uuid references public.social_posts(id) on delete set null,
  event_type text not null check (event_type in (
    'digest_view', 'scroll_50', 'story_open', 'subscribe_click', 'signup_complete',
    'pdf_download', 'video_play'
  )),
  locale text not null check (locale in ('en', 'uk')),
  channel text,
  hook_angle text,
  story_id uuid references public.weekly_digest_revision_items(id) on delete set null,
  session_hash text not null check (char_length(session_hash) = 64),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists weekly_digest_engagement_digest_event_idx
  on public.weekly_digest_engagement_events
  (weekly_digest_id, revision_id, event_type, occurred_at desc);
create index if not exists weekly_digest_engagement_channel_idx
  on public.weekly_digest_engagement_events
  (channel, locale, hook_angle, occurred_at desc);

alter table public.weekly_locale_map enable row level security;
alter table public.weekly_digest_engagement_events enable row level security;

drop policy if exists "weekly locale map: admin read" on public.weekly_locale_map;
create policy "weekly locale map: admin read"
  on public.weekly_locale_map for select to authenticated
  using (public.is_social_admin());

drop policy if exists "weekly locale map: owner write" on public.weekly_locale_map;
create policy "weekly locale map: owner write"
  on public.weekly_locale_map for all to authenticated
  using (public.social_admin_role() = 'owner' and public.has_social_aal2())
  with check (public.social_admin_role() = 'owner' and public.has_social_aal2());

drop policy if exists "weekly engagement: admin read"
  on public.weekly_digest_engagement_events;
create policy "weekly engagement: admin read"
  on public.weekly_digest_engagement_events for select to authenticated
  using (public.is_social_admin());

revoke all on table public.weekly_locale_map from public, anon, authenticated;
revoke all on table public.weekly_digest_engagement_events from public, anon, authenticated;
grant select, insert, update, delete on table public.weekly_locale_map to authenticated;
grant all on table public.weekly_locale_map to service_role;
grant select on table public.weekly_digest_engagement_events to authenticated;
grant insert, select on table public.weekly_digest_engagement_events to service_role;
grant usage, select on sequence public.weekly_digest_engagement_events_id_seq to service_role;

revoke all on function public.edit_weekly_social_post_v2(
  uuid, integer, text, jsonb, text, text, timestamptz, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.edit_weekly_social_post_v2(
  uuid, integer, text, jsonb, text, text, timestamptz, jsonb, text
) to authenticated;

-- Trigger helpers are not RPC surface. Revoke explicitly after replacement so
-- their historical privileges cannot drift across environments.
revoke all on function public.enforce_weekly_social_locale()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_social_content_approval()
  from public, anon, authenticated, service_role;

create or replace function public.resume_weekly_threads_sequence(p_social_post_id uuid)
returns public.social_posts
language plpgsql
security invoker
set search_path = public
as $function$
declare
  resumed public.social_posts;
begin
  if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
    raise exception 'Owner AAL2 session required' using errcode = '42501';
  end if;

  update public.social_posts post
  set status = 'scheduled',
      scheduled_for = now(),
      retry_after = null,
      last_error = null
  where post.id = p_social_post_id
    and post.channel = 'threads'
    and post.status = 'needs_reconciliation'
    and post.provider_meta ->> 'partial_sequence' = 'true'
    and case
      when jsonb_typeof(coalesce(post.provider_meta -> 'published_ids', '[]'::jsonb)) = 'array'
        then jsonb_array_length(coalesce(post.provider_meta -> 'published_ids', '[]'::jsonb)) > 0
      else false
    end
    and post.approval_version = post.content_version
  returning * into resumed;

  if resumed.id is null then
    raise exception 'No resumable approved Threads sequence was found';
  end if;

  insert into public.social_post_reviews (
    social_post_id, package_id, reviewer_id, action,
    content_version, content_hash, snapshot, note
  ) values (
    resumed.id, resumed.package_id, auth.uid(), 'scheduled',
    resumed.content_version, resumed.content_hash,
    jsonb_build_object(
      'channel', resumed.channel,
      'provider_meta', resumed.provider_meta,
      'scheduled_for', resumed.scheduled_for
    ),
    'Owner resumed the stored partial Threads sequence without reposting completed parts.'
  );

  return resumed;
end;
$function$;

revoke all on function public.resume_weekly_threads_sequence(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resume_weekly_threads_sequence(uuid) to authenticated;

-- Shadow revisions can be reviewed and compared, but can never enter the
-- public release lifecycle. Production v2 revisions keep the new hard gates
-- even if an older preflight caller omits them.
create or replace function public.guard_weekly_content_studio_release()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_story_count integer;
  v_v2_count integer;
  v_shadow_count integer;
  v_production_count integer;
begin
  if new.status not in ('publishing', 'published')
     or new.status is not distinct from old.status then
    return new;
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where item.source_snapshot #>> '{content_studio,version}' = 'weekly-content-studio-v2'
    )::integer,
    count(*) filter (
      where item.source_snapshot #>> '{content_studio,mode}' = 'shadow'
    )::integer,
    count(*) filter (
      where item.source_snapshot #>> '{content_studio,mode}' = 'production'
    )::integer
  into v_story_count, v_v2_count, v_shadow_count, v_production_count
  from public.weekly_digest_revision_items item
  where item.revision_id = new.active_revision_id;

  if v_shadow_count > 0 then
    raise exception 'A shadow Content Studio revision cannot be published'
      using errcode = '23514';
  end if;
  if v_v2_count = 0 then
    return new;
  end if;
  if v_v2_count <> v_story_count or v_production_count <> v_story_count then
    raise exception 'A Content Studio v2 revision must use one explicit production mode'
      using errcode = '23514';
  end if;
  if v_story_count not between 6 and 7 then
    raise exception 'Content Studio v2 release requires Top 3 plus 3-4 Radar stories'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.weekly_digest_revision_items item
    join public.weekly_digest_artifacts artifact
      on artifact.id::text = item.source_snapshot #>> '{content_studio,research_artifact_id}'
     and artifact.input_hash = item.source_snapshot #>> '{content_studio,research_input_hash}'
    where item.revision_id = new.active_revision_id
      and item.rank <= 3
      and artifact.weekly_digest_id = new.id
      and artifact.artifact_type = 'research_pack'
      and artifact.is_current
      and artifact.generation_status = 'ready'
      and artifact.review_status = 'approved'
  ) <> 3 then
    raise exception 'Three approved Top 3 research packs are required'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.weekly_digest_artifacts artifact
    where artifact.revision_id = new.active_revision_id
      and artifact.artifact_type = 'content_quality_report'
      and artifact.is_current
      and artifact.generation_status = 'ready'
      and artifact.review_status = 'approved'
      and coalesce((artifact.metadata ->> 'passed')::boolean, false)
  ) then
    raise exception 'An approved passing Content Studio quality report is required'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = new.active_revision_id
      and artifact.is_current
      and artifact.generation_status = 'ready'
      and artifact.review_status = 'approved'
      and (
        (artifact.artifact_type = 'article' and artifact.locale in ('en', 'uk'))
        or (artifact.artifact_type = 'video_script' and artifact.locale = 'en')
        or (artifact.artifact_type = 'video_manifest' and artifact.locale = 'en')
      )
  ) <> 4 then
    raise exception 'Approved EN/UK articles, video script and video manifest are required'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists weekly_content_studio_release_guard on public.weekly_digests;
create trigger weekly_content_studio_release_guard
before update of status on public.weekly_digests
for each row execute function public.guard_weekly_content_studio_release();

revoke all on function public.guard_weekly_content_studio_release()
  from public, anon, authenticated, service_role;

-- Claim order also encodes the dependency graph. A job stays queued until the
-- preceding human gate or render stage is satisfied.
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
      select 1 from unnest(p_job_types) as requested(job_type)
      where requested.job_type not in (
        'research_pack', 'editorial_master', 'social_copy', 'article', 'pdf',
        'cover', 'story_image', 'social_asset', 'video_manifest',
        'artifact_promotion'
      )
    )
  ) then
    raise exception 'Unsupported weekly digest generation job type filter';
  end if;
  if p_stale_after <= interval '0 seconds' or p_stale_after > interval '24 hours' then
    raise exception 'Stale timeout must be greater than zero and at most 24 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest on digest.id = job.weekly_digest_id
    where job.attempts < 5
      and digest.active_revision_id = job.revision_id
      and digest.status not in ('publishing', 'published', 'cancelled')
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (
        job.status in ('queued', 'failed')
        or (job.status = 'running' and job.locked_at < now() - p_stale_after)
      )
      and case job.job_type
        when 'editorial_master' then (
          select count(*) = 3
          from public.weekly_digest_artifacts artifact
          join public.weekly_digest_revision_items item
            on item.id = artifact.revision_item_id
          where artifact.revision_id = job.revision_id
            and item.rank <= 3
            and artifact.artifact_type = 'research_pack'
            and artifact.is_current
            and artifact.generation_status = 'ready'
            and artifact.review_status = 'approved'
        )
        when 'story_image' then (
          select count(*) = 3
          from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.is_current
            and artifact.review_status = 'approved'
            and artifact.artifact_type in ('article', 'video_script')
            and artifact.slot_key in ('article:en', 'article:uk', 'video-script:en')
        )
        when 'cover' then not exists (
          select 1
          from public.weekly_digest_revision_items item
          where item.revision_id = job.revision_id
            and not exists (
              select 1 from public.weekly_digest_artifacts artifact
              where artifact.revision_item_id = item.id
                and artifact.artifact_type = 'story_image'
                and artifact.is_current
                and artifact.generation_status = 'ready'
            )
        )
        when 'pdf' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'cover'
            and artifact.is_current
            and artifact.generation_status = 'ready'
            and artifact.review_status = 'approved'
        ) and exists (
          select 1 from public.weekly_digest_artifacts article
          where article.revision_id = job.revision_id
            and article.artifact_type = 'article'
            and article.locale = job.locale
            and article.is_current
            and article.review_status = 'approved'
        )
        when 'social_copy' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'cover'
            and artifact.is_current
            and artifact.generation_status = 'ready'
        ) and (
          select count(*) = 2 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'article'
            and artifact.is_current
            and artifact.review_status = 'approved'
        )
        when 'video_manifest' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'video_script'
            and artifact.is_current
            and artifact.review_status = 'approved'
        ) and (
          select count(*) = 3
          from public.weekly_digest_artifacts artifact
          join public.weekly_digest_revision_items item
            on item.id = artifact.revision_item_id
          where artifact.revision_id = job.revision_id
            and item.rank <= 3
            and artifact.artifact_type = 'story_image'
            and artifact.is_current
            and artifact.generation_status = 'ready'
            and artifact.review_status = 'approved'
        ) and exists (
          select 1 from public.weekly_digest_artifacts cover
          where cover.revision_id = job.revision_id
            and cover.artifact_type = 'cover'
            and cover.is_current
            and cover.generation_status = 'ready'
        )
        else true
      end
    order by
      case job.status when 'queued' then 0 when 'failed' then 1 else 2 end,
      case job.job_type
        when 'research_pack' then 0
        when 'editorial_master' then 1
        when 'story_image' then 2
        when 'cover' then 3
        when 'social_copy' then 4
        when 'video_manifest' then 5
        when 'pdf' then 6
        when 'social_asset' then 7
        else 8
      end,
      job.created_at,
      job.id
    for update of job skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    update public.weekly_digest_generation_jobs
    set status = 'running', attempts = attempts + 1, locked_at = now(),
        started_at = coalesce(started_at, now()), finished_at = null,
        last_error = null
    where id = v_job.id
    returning * into v_claimed;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_claimed.weekly_digest_id, v_claimed.revision_id, 'generation_started',
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

revoke all on function public.claim_weekly_digest_generation_jobs(
  text[], integer, interval
) from public, anon, authenticated, service_role;
grant execute on function public.claim_weekly_digest_generation_jobs(
  text[], integer, interval
) to service_role;

commit;
