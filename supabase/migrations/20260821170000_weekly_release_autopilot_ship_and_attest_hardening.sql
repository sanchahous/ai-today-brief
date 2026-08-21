-- Review fixes for the weekly release autopilot (PR #311 audit):
-- 1. machine_attest_weekly_digest_artifact now mirrors the human review gate:
--    an article is never machine-approved while the current quality report
--    still carries blocking issues (previously only research_pack and the
--    report itself were checked, so the machine path was weaker than the
--    owner path it replaces).
-- 2. machine_attest_weekly_social_post becomes idempotent (an already
--    approved post is returned as-is instead of raising, which made every
--    linked retry log fake failures for clean channels) and no longer flips
--    publish_enabled back on — pausing a channel is an owner decision.
-- 3. New ship_weekly_digest: the owner's single Ship click becomes one
--    atomic approve + schedule(now()+15min) transaction with the real
--    preflight blockers in the error, instead of two RPCs that could split.

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
  -- Same invariant the owner approval path enforces: an article must never
  -- become approved while its revision's current quality report blocks.
  if v_artifact.artifact_type = 'article'
     and exists (
       select 1
       from public.weekly_digest_artifacts report
       where report.revision_id = v_artifact.revision_id
         and report.artifact_type = 'content_quality_report'
         and report.is_current
         and public.weekly_quality_content_has_blockers(report.content)
     ) then
    return null;
  end if;

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

  select * into approved_post from public.social_posts where id = p_social_post_id;
  if approved_post.id is null then
    raise exception 'Social post was not found';
  end if;

  -- Idempotent: the generation worker re-runs this over every green post on
  -- each linked retry. Already-approved posts (attested earlier, or approved
  -- by the owner meanwhile) are a no-op, not an error.
  if approved_post.status = 'approved' then
    return approved_post;
  end if;
  if approved_post.status not in ('draft', 'in_review', 'failed') then
    raise exception
      'Post % cannot be machine-attested from status %',
      p_social_post_id,
      approved_post.status;
  end if;
  if approved_post.content_hash is null
     or jsonb_array_length(coalesce(approved_post.quality_report -> 'blocking', '[]'::jsonb)) > 0
     or coalesce((approved_post.quality_report -> 'critic' ->> 'score')::numeric, 0) < 85 then
    raise exception 'Post is blocked by quality rules or below critic threshold';
  end if;

  perform set_config('app.weekly_digest_social_action', 'allowed', true);

  -- publish_enabled is deliberately untouched: flipping it back on would
  -- silently unpause a channel the owner disabled.
  update public.social_posts
  set
    status = 'approved',
    approval_version = content_version,
    approved_by = null,
    approved_at = now(),
    last_error = null,
    meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('machine_attested', true)
  where id = p_social_post_id
  returning * into approved_post;

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

-- One transaction for the owner's Ship click: quality gate -> approve ->
-- schedule release_at = now() + 15 minutes (preflight_at lands exactly on
-- now(), matching the "preflight is the same instant" contract).
create or replace function public.ship_weekly_digest(p_weekly_digest_id uuid)
returns public.weekly_digests
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_preflight jsonb;
  v_release_at timestamptz;
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
  if v_digest.active_revision_id is null then
    raise exception 'The digest has no active revision';
  end if;
  if v_digest.status in ('publishing', 'published', 'cancelled') then
    raise exception 'Weekly digest cannot be shipped from status %', v_digest.status;
  end if;

  -- Fail here, with the real reason, instead of inside approve_weekly_digest
  -- asking for an override reason the Ship flow never collects.
  if exists (
    select 1
    from public.weekly_digest_artifacts report
    where report.revision_id = v_digest.active_revision_id
      and report.artifact_type = 'content_quality_report'
      and report.is_current
      and public.weekly_quality_content_has_blockers(report.content)
  ) then
    raise exception 'Cannot ship while the quality report still has blocking issues'
      using errcode = '55000';
  end if;

  perform set_config('app.weekly_digest_release_action', 'allowed', true);
  perform set_config('app.weekly_digest_social_action', 'allowed', true);

  if v_digest.status not in ('approved', 'scheduled') then
    update public.weekly_digests
    set preflight_override = null,
        preflight_override_by = null,
        preflight_override_at = null
    where id = p_weekly_digest_id;

    v_preflight := public.weekly_digest_preflight(p_weekly_digest_id);
    if not coalesce((v_preflight ->> 'ready')::boolean, false) then
      raise exception 'Ship blocked by preflight: %', v_preflight -> 'blockers'
        using errcode = '55000';
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
      jsonb_build_object('ship', true, 'preflight', v_preflight)
    );
  else
    v_preflight := public.weekly_digest_preflight(p_weekly_digest_id);
    if not coalesce((v_preflight ->> 'ready')::boolean, false) then
      raise exception 'Ship blocked by preflight: %', v_preflight -> 'blockers'
        using errcode = '55000';
    end if;
  end if;

  v_release_at := now() + interval '15 minutes';

  update public.weekly_digests
  set status = 'scheduled',
      release_at = v_release_at,
      preflight_at = v_release_at - interval '15 minutes',
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
      'release_at', v_release_at,
      'preflight_at', v_digest.preflight_at,
      'preflight', v_preflight,
      'ship', true
    )
  );
  return v_digest;
end;
$function$;

revoke all on function public.ship_weekly_digest(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ship_weekly_digest(uuid)
  to authenticated;
grant execute on function public.machine_attest_weekly_digest_artifact(uuid) to service_role;
grant execute on function public.machine_attest_weekly_social_post(uuid) to service_role;
