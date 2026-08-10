begin;

-- Both revision RPCs are `security invoker` and, since 2026-08-04, cancel stale
-- `queued`/`failed` generation jobs tied to the revision they supersede via a
-- direct UPDATE on `weekly_digest_generation_jobs`. That table has only ever
-- granted `authenticated` SELECT (public.weekly_digest_v2, 2026-07-23) --
-- every other writer of this table (`claim_weekly_digest_generation_jobs_v2`,
-- `retry_weekly_digest_generation_job`, `reap_stale_weekly_digest_generation_
-- attempts`) is `security definer` for exactly this reason. These two were
-- not, so every call from a real owner/editor session -- not just a rare
-- edge case -- hit `42501: permission denied for table
-- weekly_digest_generation_jobs` (Postgres checks table-level privilege
-- before the WHERE clause, so even zero matching rows still fails).
--
-- Reproduced live 2026-08-10: an owner clicking "Restore this version" got
-- Next.js's opaque `Minified React error #441` with no readable message
-- (see the app-side fix in the same PR, which at least surfaces the real
-- text next time). Confirmed via `set local role authenticated;` simulation
-- that the identical UPDATE inside `create_weekly_digest_revision` (the
-- "Save" action) has been broken the same way since this table's grants were
-- set -- production history shows exactly one human-authored
-- `revision_created` event ever, against zero since.
--
-- `security definer` matches the existing pattern for this table's other
-- writers and changes nothing about who may call these functions: the
-- `has_social_role(array['owner','editor'])` check inside each body remains
-- the actual authorization gate, still evaluated against the caller's own
-- `auth.uid()` (has_social_role is a separate, unaffected `security invoker`
-- function). `set search_path = public` was already present on both,
-- required to make `security definer` safe against search-path hijacking.

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
security definer
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

create or replace function public.revert_weekly_digest_revision(
  p_weekly_digest_id uuid,
  p_target_revision_id uuid,
  p_reason text
)
returns public.weekly_digests
language plpgsql
security definer
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

revoke all on function public.create_weekly_digest_revision(uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_weekly_digest_revision(uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb)
  to authenticated, service_role;

revoke all on function public.revert_weekly_digest_revision(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.revert_weekly_digest_revision(uuid, uuid, text)
  to authenticated, service_role;

commit;
