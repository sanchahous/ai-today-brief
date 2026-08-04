begin;

-- ─────────────────────────────────────────────────────────────────────────
-- Weekly Digest revision stability fixes (2026-08-04 incident).
--
-- Root cause: weekly_digest_artifact_input_hash() hashed the *volatile*
-- primary keys of weekly_digest_revision_items (item.id, and item.revision_id
-- via to_jsonb(item)) instead of the stable brief_item_id. Every revision
-- gets fresh item UUIDs, so the hash never matched across revisions and
-- carry-forward in create_weekly_digest_revision() never fired -- every
-- manual Save (even a no-op Save with zero edits) wiped every approved
-- artifact back to "missing" and reset approvals/schedule/social posts.
--
-- create_service_weekly_digest_revision() (the automated master-worker path)
-- already guards against this with a content-hash no-op short-circuit and
-- cancels orphaned jobs on the superseded revision. This migration ports
-- both protections to the manual-save path and fixes the hash itself.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Stable artifact-dependency hash: identify revision items by their
--    stable brief_item_id, never by the revision-scoped row id/revision_id.
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
    select (to_jsonb(item) - 'id' - 'revision_id' - 'created_at')
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
        'brief_item_id', item.brief_item_id,
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
        'brief_item_id', item.brief_item_id,
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
    select coalesce(jsonb_agg(
      (to_jsonb(item) - 'id' - 'revision_id' - 'created_at') order by item.rank
    ), '[]'::jsonb)
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

-- 2) Manual-save path: skip creating a new revision when nothing actually
--    changed, and cancel jobs orphaned on the revision being superseded.
--    Mirrors create_service_weekly_digest_revision()'s existing guards.
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
  v_current_revision public.weekly_digest_revisions;
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

  -- No-op Save: identical content to the currently active revision.
  -- Return it unchanged instead of creating a new revision, resetting
  -- approvals, reopening social posts, and invalidating every artifact.
  if v_digest.active_revision_id is not null then
    select revision.*
      into v_current_revision
    from public.weekly_digest_revisions revision
    where revision.id = v_digest.active_revision_id;
    if v_current_revision.id is not null and v_current_revision.content_hash = v_content_hash then
      return v_current_revision.id;
    end if;
  end if;

  perform set_config('app.weekly_digest_revision_write', 'allowed', true);
  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);

  v_previous_revision_id := v_digest.active_revision_id;

  -- A real content change supersedes the previous revision: any of its
  -- still-outstanding generation jobs can never be claimed again (the claim
  -- queue only serves the *active* revision), so they'd otherwise sit
  -- "queued" forever. Cancel them explicitly so the UI reflects reality.
  if v_previous_revision_id is not null then
    update public.weekly_digest_generation_jobs
    set status = 'cancelled',
        locked_at = null,
        finished_at = now(),
        last_error = 'Superseded by a newer immutable editorial revision.'
    where revision_id = v_previous_revision_id
      and status in ('queued', 'failed');
  end if;

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

-- 3) story_image no longer requires an approved video_script -- illustration
--    generation only needs the article text for scene context. Requiring
--    video-script:en meant a brand-new revision (no video script yet) could
--    never unblock story images, which in turn blocked cover/pdf/social_asset.
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
          (
            select count(*) = 2
            from public.weekly_digest_artifacts artifact
            where artifact.revision_id = job.revision_id
              and artifact.is_current
              and artifact.review_status = 'approved'
              and artifact.artifact_type = 'article'
              and artifact.slot_key in ('article:en', 'article:uk')
          )
          or (
            nullif(btrim(coalesce(job.input ->> 'revision_item_id', '')), '') is not null
            and exists (
              select 1
              from public.weekly_digest_artifacts artifact
              where artifact.revision_id = job.revision_id
                and artifact.revision_item_id = nullif(btrim(job.input ->> 'revision_item_id'), '')::uuid
                and artifact.artifact_type = 'story_image'
                and artifact.is_current
                and artifact.generation_status = 'ready'
            )
          )
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
        ) and exists (
          select 1 from public.weekly_digest_artifacts article
          where article.revision_id = job.revision_id
            and article.artifact_type = 'article'
            and article.locale = coalesce(nullif(job.input ->> 'locale', ''), 'en')
            and article.is_current
            and article.generation_status = 'ready'
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

-- 4) A trial release may ship without the video pipeline. Extend the
--    override-eligible blockers (article/pdf already allowed) to also cover
--    the final video, captions and thumbnail -- still gated behind an
--    AAL2 owner session and a mandatory 20-1000 character reason.
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
          'pdf_file_missing',
          'youtube_video_missing',
          'captions_content_missing'
        )
        and (
          v_blocker.blocker ->> 'slot_key' like 'article:%'
          or v_blocker.blocker ->> 'slot_key' like 'pdf:%'
          or v_blocker.blocker ->> 'slot_key' like 'video-final:%'
          or v_blocker.blocker ->> 'slot_key' like 'captions:%'
          or v_blocker.blocker ->> 'slot_key' like 'thumbnail:%'
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

-- 5) Restore an earlier revision as the active one. Gives editors an
--    explicit, auditable "undo" instead of having to understand the
--    revision-chain internals -- reuses the exact same guarded path
--    create_weekly_digest_revision() uses to flip active_revision_id.
create or replace function public.revert_weekly_digest_revision(
  p_weekly_digest_id uuid,
  p_target_revision_id uuid,
  p_reason text
)
returns public.weekly_digests
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_target public.weekly_digest_revisions;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) not between 10 and 500 then
    raise exception 'A 10 to 500 character reason is required to restore a version';
  end if;

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

  select revision.*
    into v_target
  from public.weekly_digest_revisions revision
  where revision.id = p_target_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id;
  if v_target.id is null then
    raise exception 'The version to restore was not found on this Weekly Digest';
  end if;
  if v_target.id = v_digest.active_revision_id then
    raise exception 'This version is already active';
  end if;

  perform set_config('app.weekly_digest_revision_write', 'allowed', true);

  if v_digest.active_revision_id is not null then
    update public.weekly_digest_generation_jobs
    set status = 'cancelled',
        locked_at = null,
        finished_at = now(),
        last_error = 'Superseded: the editor restored an earlier version.'
    where revision_id = v_digest.active_revision_id
      and status in ('queued', 'failed');
  end if;

  update public.weekly_digests
  set active_revision_id = v_target.id,
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
  where id = p_weekly_digest_id
  returning * into v_digest;

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
  set weekly_digest_revision_id = v_target.id,
      status = 'in_review',
      updated_at = now()
  where weekly_digest_id = p_weekly_digest_id
    and status not in ('publishing', 'posted', 'cancelled');

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    p_weekly_digest_id,
    v_target.id,
    auth.uid(),
    'revision_restored',
    jsonb_build_object(
      'restored_revision_number', v_target.revision_number,
      'reason', v_reason
    )
  );

  return v_digest;
end;
$function$;

revoke all on function public.revert_weekly_digest_revision(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.revert_weekly_digest_revision(uuid, uuid, text)
  to authenticated, service_role;

-- 6) Backfill: every currently-live artifact's stored input_hash was computed
--    under the old (broken) hash formula. Recompute it under the fixed
--    formula now so already-approved work doesn't spuriously show "stale"
--    (its actual content hasn't changed -- only the hash algorithm has).
--    input_hash is deliberately immutable to guard_weekly_digest_artifact_write()
--    for every ordinary writer; this one-time repair runs as service_role,
--    the same escape hatch that trigger already grants unconditionally.
--    Published/publishing digests are excluded -- their approved input_hash
--    is a historical record of what actually shipped, not a live value.
--    Recomputed in dependency order: a single UPDATE only ever sees the
--    pre-statement snapshot of other rows, so cover (which embeds
--    story_image's input_hash) must be recomputed in a later pass than
--    story_image, and so on up the dependency chain.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Pass 1: leaf artifacts (no cross-artifact dependencies in the hash)
update public.weekly_digest_artifacts artifact
set input_hash = public.weekly_digest_artifact_input_hash(
  artifact.revision_id, artifact.artifact_type, artifact.locale, artifact.revision_item_id
)
where artifact.is_current
  and artifact.artifact_type in ('article', 'video_script', 'story_image', 'content_quality_report', 'research_pack')
  and exists (
    select 1 from public.weekly_digests wd
    where wd.id = artifact.weekly_digest_id and wd.status not in ('publishing', 'published')
  );

-- Pass 2: cover (depends on story_image)
update public.weekly_digest_artifacts artifact
set input_hash = public.weekly_digest_artifact_input_hash(
  artifact.revision_id, artifact.artifact_type, artifact.locale, artifact.revision_item_id
)
where artifact.is_current
  and artifact.artifact_type = 'cover'
  and exists (
    select 1 from public.weekly_digests wd
    where wd.id = artifact.weekly_digest_id and wd.status not in ('publishing', 'published')
  );

-- Pass 3: pdf, social_asset, video_manifest (depend on cover/story_image/video_script)
update public.weekly_digest_artifacts artifact
set input_hash = public.weekly_digest_artifact_input_hash(
  artifact.revision_id, artifact.artifact_type, artifact.locale, artifact.revision_item_id
)
where artifact.is_current
  and artifact.artifact_type in ('pdf', 'social_asset', 'video_manifest')
  and exists (
    select 1 from public.weekly_digests wd
    where wd.id = artifact.weekly_digest_id and wd.status not in ('publishing', 'published')
  );

-- Pass 4: video_preview, video_final, heygen_preview, graphics_preview
update public.weekly_digest_artifacts artifact
set input_hash = public.weekly_digest_artifact_input_hash(
  artifact.revision_id, artifact.artifact_type, artifact.locale, artifact.revision_item_id
)
where artifact.is_current
  and artifact.artifact_type in ('video_preview', 'video_final', 'heygen_preview', 'graphics_preview')
  and exists (
    select 1 from public.weekly_digests wd
    where wd.id = artifact.weekly_digest_id and wd.status not in ('publishing', 'published')
  );

-- Pass 5: captions, thumbnail (depend on video_script/video_manifest/video_final)
update public.weekly_digest_artifacts artifact
set input_hash = public.weekly_digest_artifact_input_hash(
  artifact.revision_id, artifact.artifact_type, artifact.locale, artifact.revision_item_id
)
where artifact.is_current
  and artifact.artifact_type in ('captions', 'thumbnail')
  and exists (
    select 1 from public.weekly_digests wd
    where wd.id = artifact.weekly_digest_id and wd.status not in ('publishing', 'published')
  );

-- 7) revert_weekly_digest_revision() logs a 'revision_restored' event type
--    that the release-events check constraint doesn't know about yet.
alter table public.weekly_digest_release_events
  drop constraint weekly_digest_release_events_event_type_check;
alter table public.weekly_digest_release_events
  add constraint weekly_digest_release_events_event_type_check
  check (event_type = any (array[
    'revision_created', 'revision_restored', 'artifact_saved', 'artifact_reviewed',
    'generation_queued', 'generation_started', 'generation_succeeded', 'generation_failed',
    'preflight_passed', 'preflight_failed', 'approved', 'scheduled', 'publishing_started',
    'publishing_retried', 'published', 'failed', 'paused', 'resumed', 'override'
  ]));

commit;
