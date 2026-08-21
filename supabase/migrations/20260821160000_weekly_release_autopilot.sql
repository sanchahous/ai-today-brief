-- Weekly release autopilot: one social-matrix table (TS ≡ SQL), machine
-- attestation for green artifacts, and Approve forbidden while quality
-- blockers remain.
create table if not exists public.weekly_digest_social_matrix (
  channel text primary key,
  locale text not null check (locale in ('en', 'uk'))
);

insert into public.weekly_digest_social_matrix (channel, locale)
values
  ('telegram', 'uk'),
  ('facebook', 'uk'),
  ('x', 'en'),
  ('threads', 'uk'),
  ('linkedin', 'en'),
  ('instagram', 'en')
on conflict (channel) do update
set locale = excluded.locale
where public.weekly_digest_social_matrix.locale is distinct from excluded.locale;

alter table public.weekly_digest_social_matrix enable row level security;

drop policy if exists weekly_digest_social_matrix_read on public.weekly_digest_social_matrix;
create policy weekly_digest_social_matrix_read
  on public.weekly_digest_social_matrix
  for select
  using (true);

grant select on public.weekly_digest_social_matrix to anon, authenticated, service_role;

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

create or replace function public.weekly_quality_content_has_blockers(p_content jsonb)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_content -> 'issues', '[]'::jsonb)) issue
    where coalesce((issue ->> 'blocker')::boolean, false)
  );
$$;

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

  select artifact.*
    into v_artifact
  from public.weekly_digest_artifacts artifact
  where artifact.id = p_artifact_id
    and artifact.is_current
    and artifact.generation_status = 'ready';
  if v_artifact.id is null then
    raise exception 'A ready current artifact was not found';
  end if;

  if p_action = 'approved' then
    if v_artifact.artifact_type = 'content_quality_report'
       and public.weekly_quality_content_has_blockers(v_artifact.content) then
      raise exception 'Cannot approve a quality report while blocking issues remain'
        using errcode = '23514';
    end if;
    if v_artifact.artifact_type = 'article'
       and exists (
         select 1
         from public.weekly_digest_artifacts report
         where report.revision_id = v_artifact.revision_id
           and report.artifact_type = 'content_quality_report'
           and report.is_current
           and public.weekly_quality_content_has_blockers(report.content)
       ) then
      raise exception 'Cannot approve an article while the quality report still has blocking issues'
        using errcode = '23514';
    end if;
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

create or replace function public.machine_attest_weekly_digest_artifact(p_artifact_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_artifact public.weekly_digest_artifacts;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  select artifact.*
    into v_artifact
  from public.weekly_digest_artifacts artifact
  where artifact.id = p_artifact_id
    and artifact.is_current;
  if v_artifact.id is null then
    raise exception 'Current artifact was not found';
  end if;
  if v_artifact.generation_status is distinct from 'ready' then
    return null;
  end if;
  if v_artifact.review_status = 'approved' then
    return v_artifact.id;
  end if;
  if v_artifact.artifact_type not in (
    'research_pack',
    'content_quality_report',
    'article',
    'pdf',
    'video_script',
    'video_manifest',
    'story_prompt_set',
    'story_image',
    'cover'
  ) then
    return null;
  end if;
  if v_artifact.artifact_type = 'research_pack'
     and jsonb_typeof(coalesce(v_artifact.content -> 'risks', '[]'::jsonb)) = 'array'
     and exists (
       select 1
       from jsonb_array_elements_text(coalesce(v_artifact.content -> 'risks', '[]'::jsonb)) flag
       where flag ~* 'hallucin'
     ) then
    return null;
  end if;
  if v_artifact.artifact_type = 'content_quality_report' then
    if public.weekly_quality_content_has_blockers(v_artifact.content) then
      return null;
    end if;
    if coalesce((v_artifact.metadata ->> 'passed')::boolean, false) is not true then
      return null;
    end if;
  end if;

  -- Review GUC allows review_status only. Metadata is immutable on this
  -- table unless the caller is service_role in the write guard; keep the
  -- attest flag on the review snapshot so owner sessions cannot trip the
  -- identity trigger.
  perform set_config('app.weekly_digest_artifact_review', 'allowed', true);
  update public.weekly_digest_artifacts artifact
  set review_status = 'approved'
  where artifact.id = p_artifact_id
    and artifact.is_current
    and artifact.generation_status = 'ready'
  returning artifact.* into v_artifact;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    note,
    artifact_snapshot
  ) values (
    v_artifact.id,
    null,
    'approved',
    'machine_attested',
    jsonb_build_object(
      'slot_key', v_artifact.slot_key,
      'version', v_artifact.version,
      'machine_attested', true
    )
  );

  return v_artifact.id;
end;
$function$;

create or replace function public.machine_attest_weekly_social_post(p_social_post_id uuid)
returns public.social_posts
language plpgsql
security definer
set search_path = public
as $function$
declare
  approved_post public.social_posts;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_social_action', 'allowed', true);

  update public.social_posts
  set
    publish_enabled = true,
    status = 'approved',
    approval_version = content_version,
    approved_by = null,
    approved_at = now(),
    last_error = null,
    meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('machine_attested', true)
  where id = p_social_post_id
    and status in ('draft', 'in_review', 'failed')
    and content_hash is not null
    and jsonb_array_length(coalesce(quality_report -> 'blocking', '[]'::jsonb)) = 0
    and coalesce((quality_report -> 'critic' ->> 'score')::numeric, 0) >= 85
  returning * into approved_post;

  if approved_post.id is null then
    raise exception 'Post is missing, blocked by quality rules, or below critic threshold';
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
    null,
    'approved',
    approved_post.content_version,
    approved_post.content_hash,
    jsonb_build_object(
      'channel', approved_post.channel,
      'machine_attested', true,
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

grant execute on function public.weekly_quality_content_has_blockers(jsonb) to authenticated, service_role;
grant execute on function public.machine_attest_weekly_digest_artifact(uuid) to service_role;
grant execute on function public.machine_attest_weekly_social_post(uuid) to service_role;
