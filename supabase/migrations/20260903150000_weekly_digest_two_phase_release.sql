begin;

-- Split the weekly digest release into two independent phases:
--
-- 1. Ship (unchanged RPC, loosened gate): the site (article, visuals, PDF)
--    and all six social posts publish as soon as they're ready. Video
--    (video_final / captions / thumbnail) is no longer a required slot --
--    video production is the slowest step and previously held back
--    everything else, including social, which never actually depended on it.
-- 2. Publish video (new RPC): once video_final/captions/thumbnail are
--    generated and approved -- using the existing Video tab workflow,
--    unchanged -- a separate, narrow action stamps them published and
--    updates the already-live page. This never touches social or the
--    digest's `status`.
--
-- Owner decision 2026-09-03: social must never be gated on video, in either
-- phase; video should never delay the initial release.

-- The generic artifact guard blocks any change to `published_at` outside the
-- release worker, with one narrow, already-proven exception for the visual
-- refresh promotion path. This adds a second, equally narrow exception: an
-- AAL2 owner may stamp `published_at` on an already-approved, current
-- video_final/captions/thumbnail row, but only on the digest's own
-- published_revision_id, and only via the dedicated GUC the new RPC below
-- sets for the duration of its own transaction. It does not permit rewriting
-- identity, bytes, metadata or text -- the immutable-fields check above this
-- one in the function is untouched.
create or replace function public.guard_weekly_digest_artifact_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_is_visual_refresh_stage boolean := false;
  v_is_visual_asset_promotion boolean := false;
  v_is_visual_refresh_stage_write boolean := false;
  v_is_visual_refresh_stage_review boolean := false;
  v_is_visual_refresh_direction_write boolean := false;
  v_is_video_publish boolean := false;
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
  where digest.id = new.weekly_digest_id;

  v_is_visual_refresh_stage_write :=
    current_setting('app.weekly_visual_refresh_asset_stage', true) = 'allowed';
  v_is_visual_refresh_stage_review :=
    current_setting('app.weekly_visual_refresh_asset_stage_review', true) = 'allowed';
  v_is_visual_refresh_direction_write :=
    current_setting('app.weekly_visual_refresh_direction_write', true) = 'allowed';

  if v_digest.id is not null then
    v_is_visual_refresh_stage :=
      v_digest.status = 'published'
      and v_digest.active_revision_id = new.revision_id
      and (
        current_setting('app.weekly_visual_refresh', true) = 'allowed'
        or v_is_visual_refresh_stage_write
        or v_is_visual_refresh_stage_review
        or v_is_visual_refresh_direction_write
      )
      and exists (
        select 1
        from public.weekly_digest_revisions revision
        where revision.id = new.revision_id
          and revision.weekly_digest_id = v_digest.id
          and revision.visual_refresh_source_revision_id = v_digest.published_revision_id
      );
    v_is_visual_asset_promotion :=
      current_setting('app.weekly_visual_asset_promotion', true) = 'allowed'
      and v_digest.status = 'published'
      and v_digest.published_revision_id = new.revision_id
      and exists (
        select 1
        from public.weekly_digest_revisions refresh
        where refresh.id = v_digest.active_revision_id
          and refresh.weekly_digest_id = v_digest.id
          and refresh.visual_refresh_source_revision_id = v_digest.published_revision_id
      );
    v_is_video_publish :=
      current_setting('app.weekly_digest_video_publish', true) = 'allowed'
      and v_digest.status = 'published'
      and v_digest.published_revision_id = new.revision_id;
  end if;

  if v_digest.id is null
     or v_digest.status in ('publishing', 'cancelled')
     or (
       v_digest.status = 'published'
       and not (
         v_is_visual_refresh_stage
         or v_is_visual_asset_promotion
         or v_is_video_publish
       )
     )
     or (
       v_digest.status <> 'published'
       and v_digest.active_revision_id is distinct from new.revision_id
     ) then
    raise exception 'Artifacts may target only the editable active revision'
      using errcode = '42501';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;

  if tg_op = 'INSERT' and v_is_visual_asset_promotion and (
    new.artifact_type not in ('cover', 'story_image')
    or new.locale <> 'neutral'
    or new.generation_status <> 'ready'
    or new.review_status <> 'approved'
    or new.is_current is not true
    or new.published_at is null
    or new.storage_bucket <> 'social-assets'
    or new.storage_path is null
    or new.external_url is not null
  ) then
    raise exception 'Visual refresh promotion may insert only a ready approved public cover or story image'
      using errcode = '42501';
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

  if tg_op = 'UPDATE' and v_is_visual_asset_promotion and (
    old.revision_id is distinct from v_digest.published_revision_id
    or old.artifact_type not in ('cover', 'story_image')
    or old.is_current is not true
    or new.is_current is not false
    or old.review_status <> 'approved'
    or new.review_status <> 'stale'
    or new.generation_status is distinct from old.generation_status
    or new.published_at is distinct from old.published_at
  ) then
    raise exception 'Visual refresh promotion may only supersede an approved current published image'
      using errcode = '42501';
  end if;

  -- Direction updates invalidate only prompt-set versions. This capability is
  -- held by the narrow AAL2 direction RPC, not by the generic artifact review
  -- RPC, so it cannot be used to alter staged or published pixels.
  if tg_op = 'UPDATE' and v_is_visual_refresh_direction_write and (
    old.artifact_type <> 'story_prompt_set'
    or old.is_current is not true
    or new.is_current is not false
    or new.generation_status is distinct from old.generation_status
    or not (
      new.review_status is not distinct from old.review_status
      or (old.review_status = 'approved' and new.review_status = 'stale')
    )
  ) then
    raise exception 'Visual direction updates may only supersede current prompt-set artifacts'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and new.review_status is distinct from old.review_status
     and current_setting('app.weekly_digest_artifact_write', true)
            is distinct from 'allowed'
     and current_setting('app.weekly_digest_artifact_review', true)
            is distinct from 'allowed'
     and not v_is_visual_refresh_direction_write then
    raise exception 'Artifact review state may be changed only by artifact workflow RPCs'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE'
     and new.published_at is distinct from old.published_at
     and not v_is_visual_asset_promotion
     and not (
       v_is_video_publish
       and old.artifact_type in ('video_final', 'captions', 'thumbnail')
       and old.is_current
       and old.review_status = 'approved'
       and old.generation_status = 'ready'
     ) then
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

-- Ship no longer waits on video: video_final / captions / thumbnail are
-- dropped from the required-slot table. Nothing else in this function
-- changes -- story_image-per-story, social six-channel matrix, editorial
-- change requests, PDF file checks and the override mechanism are untouched.
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
      ('cover', 'neutral', 'cover:neutral')
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
      select matrix.channel, matrix.locale
      from public.weekly_digest_social_matrix matrix
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
            or (
              post.channel = 'linkedin'
              and coalesce(post.meta ->> 'document_status', '')
                not in ('ready', 'completed')
            )
          )
      ) then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code', 'social_variant_not_ready',
          'message', format('%s copy is not approved, scheduled after release, and complete.', v_channel.channel),
          'channel', v_channel.channel
        ));
      elsif exists (
        select 1
        from public.social_posts post
        where post.package_id = v_package_id
          and post.channel = v_channel.channel
          and post.publish_enabled
          and (
            jsonb_array_length(coalesce(post.asset_urls, '[]'::jsonb)) = 0
            or exists (
              select 1
              from jsonb_array_elements(coalesce(post.asset_urls, '[]'::jsonb)) asset
              where coalesce(asset.value ->> 'artifactId', '') ~ '^[0-9a-fA-F-]{36}$'
                and not exists (
                  select 1
                  from public.weekly_digest_artifacts attached
                  where attached.id = (asset.value ->> 'artifactId')::uuid
                    and attached.is_current
                    and attached.review_status is distinct from 'stale'
                    and attached.generation_status = 'ready'
                )
            )
          )
      ) then
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code', 'social_assets_stale',
          'message', format('%s copy is approved but its attached image is missing or superseded.', v_channel.channel),
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

alter table public.weekly_digest_release_events
  drop constraint weekly_digest_release_events_event_type_check;
alter table public.weekly_digest_release_events
  add constraint weekly_digest_release_events_event_type_check
  check (event_type = any (array[
    'revision_created', 'revision_restored', 'artifact_saved', 'artifact_reviewed',
    'generation_queued', 'generation_started', 'generation_succeeded', 'generation_failed',
    'preflight_passed', 'preflight_failed', 'approved', 'scheduled', 'publishing_started',
    'publishing_retried', 'published', 'failed', 'paused', 'resumed', 'override',
    'draft_revision_created', 'visual_refresh_draft_created',
    'visual_refresh_direction_updated', 'job_cancelled', 'attest_failed',
    'visual_refresh_asset_staged', 'visual_refresh_assets_promoted', 'video_published'
  ]::text[]));

-- Part 2 of the two-phase release. Stamps `published_at` on an
-- already-approved video_final/captions/thumbnail set for a digest that has
-- already shipped via `ship_weekly_digest` -- no digest status change, no
-- interaction with social. Mirrors `ship_weekly_digest`'s AAL2 owner gate and
-- `finish_weekly_digest_release`'s `published_at` stamp and idempotency.
create or replace function public.publish_weekly_digest_video(p_weekly_digest_id uuid)
returns public.weekly_digests
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_blockers jsonb := '[]'::jsonb;
  v_required record;
  v_artifact public.weekly_digest_artifacts;
  v_video_final public.weekly_digest_artifacts;
  v_now timestamptz := now();
begin
  if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
    raise exception 'AAL2 owner session required' using errcode = '42501';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.status <> 'published' then
    raise exception 'The digest must be published (Ship) before its video can be released separately'
      using errcode = '55000';
  end if;
  if v_digest.published_revision_id is null
     or v_digest.active_revision_id is distinct from v_digest.published_revision_id then
    raise exception 'The active revision has moved on from the published revision; regenerate video against the live revision before publishing it'
      using errcode = '55000';
  end if;

  select artifact.*
    into v_video_final
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = v_digest.published_revision_id
    and artifact.artifact_type = 'video_final'
    and artifact.locale = 'en'
    and artifact.is_current;

  -- Idempotent: a second click (or a retried request) after the video is
  -- already live is a no-op, not an error.
  if v_video_final.id is not null and v_video_final.published_at is not null then
    return v_digest;
  end if;

  for v_required in
    select *
    from (values
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
    where artifact.revision_id = v_digest.published_revision_id
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
      v_digest.published_revision_id,
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
    if v_required.artifact_type = 'video_final'
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
    if v_required.artifact_type = 'captions'
       and v_artifact.content = '{}'::jsonb then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'captions_content_missing',
        'message', format('%s captions are empty.', upper(v_required.locale)),
        'slot_key', v_required.slot_key
      ));
    end if;
    if v_required.artifact_type = 'video_final' then
      v_video_final := v_artifact;
    end if;
  end loop;

  if jsonb_array_length(v_blockers) > 0 then
    raise exception 'Video release blocked by preflight: %', v_blockers
      using errcode = '55000';
  end if;

  perform set_config('app.weekly_digest_video_publish', 'allowed', true);

  update public.weekly_digest_artifacts
     set published_at = coalesce(published_at, v_now)
   where revision_id = v_digest.published_revision_id
     and is_current
     and generation_status = 'ready'
     and review_status = 'approved'
     and artifact_type in ('video_final', 'captions', 'thumbnail');

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_digest.id,
    v_digest.published_revision_id,
    auth.uid(),
    'video_published',
    jsonb_build_object(
      'published_at', v_now,
      'youtube_id', v_video_final.provider_id,
      'youtube_url', v_video_final.external_url
    )
  );

  return v_digest;
end;
$function$;

revoke all on function public.publish_weekly_digest_video(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_weekly_digest_video(uuid)
  to authenticated;

commit;
