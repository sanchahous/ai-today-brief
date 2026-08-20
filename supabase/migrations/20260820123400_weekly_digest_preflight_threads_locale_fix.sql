-- Owner request 2026-08-20: Approve kept failing on an unfixable, non-overridable
-- `social_variant_missing` blocker for "threads EN". `weekly_digest_preflight`
-- (added 2026-07-23 in weekly_digest_v2) hardcodes the required channel/locale
-- matrix inline and still expects threads:'en'. `WEEKLY_SOCIAL_MATRIX` in
-- src/lib/weekly-digest/preflight.ts -- the source the generator and composer
-- actually follow -- was changed to threads:'uk' in the same original PR, but
-- this DB-side copy of the matrix was never updated to match. Every threads
-- post the pipeline has ever generated is locale 'uk' (confirmed against
-- production `social_posts`), so this blocker could never clear: not just for
-- this edition, structurally for every edition since 2026-07-23. Realigning the
-- DB check to 'uk' (matching the app's own matrix and everything the generator
-- actually produces) is the fix, not generating a threads variant that nothing
-- else expects.
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
        ('threads', 'uk'),
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
