begin;

-- Stage 0 of wiki/audits/2026-08-29-weekly-digest-revision-architecture-review.md
-- A1: generic artifact carry-forward on the automated master-writer path.
-- A2: cover/story/social_asset replacement must not auto-revoke social copy;
--     preflight splits "text approved" from "asset link current".
-- B1: service-role RPC listing applied schema_migrations for CI drift check.

create or replace function public.carry_forward_weekly_digest_revision_artifacts(
  p_previous_revision_id uuid,
  p_new_revision_id uuid,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_carried_count integer := 0;
  v_invalidated_slots jsonb := '[]'::jsonb;
begin
  if p_previous_revision_id is null or p_new_revision_id is null then
    perform set_config('app.weekly_digest_invalidated_slots', '[]', true);
    return jsonb_build_object(
      'carried_count', 0,
      'invalidated_slots', '[]'::jsonb
    );
  end if;

  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);

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
    p_new_revision_id,
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
    p_created_by
  from public.weekly_digest_artifacts artifact
  left join public.weekly_digest_revision_items old_item
    on old_item.id = artifact.revision_item_id
  left join public.weekly_digest_revision_items new_item
    on new_item.revision_id = p_new_revision_id
   and new_item.brief_item_id = old_item.brief_item_id
  where artifact.revision_id = p_previous_revision_id
    and artifact.is_current
    and (artifact.revision_item_id is null or new_item.id is not null)
    and artifact.input_hash = public.weekly_digest_artifact_input_hash(
      p_new_revision_id,
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
  where artifact.revision_id = p_new_revision_id
    and artifact.metadata ? 'carried_from_artifact_id';

  select coalesce(jsonb_agg(previous.slot_key order by previous.slot_key), '[]'::jsonb)
    into v_invalidated_slots
  from public.weekly_digest_artifacts previous
  where previous.revision_id = p_previous_revision_id
    and previous.is_current
    and not exists (
      select 1
      from public.weekly_digest_artifacts carried
      where carried.revision_id = p_new_revision_id
        and carried.slot_key = previous.slot_key
        and carried.is_current
    );

  perform set_config(
    'app.weekly_digest_invalidated_slots',
    coalesce(v_invalidated_slots, '[]'::jsonb)::text,
    true
  );

  return jsonb_build_object(
    'carried_count', v_carried_count,
    'invalidated_slots', v_invalidated_slots
  );
end;
$function$;

revoke all on function public.carry_forward_weekly_digest_revision_artifacts(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- A3: a new revision used to null preflight_override even when the overridden
-- slots were carried unchanged. Rebind the same owner override onto the new
-- active_revision_id, dropping only blockers whose slot was invalidated.
create or replace function public.rebind_weekly_digest_preflight_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_raw text;
  v_slots jsonb := '[]'::jsonb;
  v_kept jsonb := '[]'::jsonb;
begin
  if new.active_revision_id is not distinct from old.active_revision_id then
    return new;
  end if;
  if old.preflight_override is null or new.preflight_override is not null then
    return new;
  end if;
  v_raw := current_setting('app.weekly_digest_invalidated_slots', true);
  if v_raw is null or v_raw = '' then
    return new;
  end if;
  begin
    v_slots := v_raw::jsonb;
  exception
    when others then
      return new;
  end;
  if jsonb_typeof(v_slots) <> 'array' then
    v_slots := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(blocker.value), '[]'::jsonb)
    into v_kept
  from jsonb_array_elements(coalesce(old.preflight_override -> 'blockers', '[]'::jsonb)) blocker
  where coalesce(blocker.value ->> 'slot_key', '') = ''
     or not exists (
       select 1
       from jsonb_array_elements_text(v_slots) slot
       where slot = blocker.value ->> 'slot_key'
     );

  if jsonb_array_length(v_kept) = 0 then
    return new;
  end if;

  new.preflight_override := (old.preflight_override - 'revision_id' - 'blockers')
    || jsonb_build_object(
      'revision_id', new.active_revision_id,
      'blockers', v_kept
    );
  new.preflight_override_by := old.preflight_override_by;
  new.preflight_override_at := old.preflight_override_at;
  return new;
end;
$function$;

drop trigger if exists weekly_digests_rebind_preflight_override on public.weekly_digests;
create trigger weekly_digests_rebind_preflight_override
  before update of active_revision_id on public.weekly_digests
  for each row
  execute function public.rebind_weekly_digest_preflight_override();

revoke all on function public.rebind_weekly_digest_preflight_override()
  from public, anon, authenticated, service_role;

create or replace function public.guard_social_content_approval()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  -- Cover/story replacement remaps artifactId only; copy approval must stay.
  if current_setting('app.weekly_digest_social_asset_relink', true) = 'allowed' then
    if old.status in ('publishing', 'posted') then
      raise exception 'A publishing or posted variant is immutable';
    end if;
    return new;
  end if;
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

create or replace function public.create_service_weekly_digest_revision(
  p_weekly_digest_id uuid,
  p_title_en text,
  p_title_uk text,
  p_intro_en text,
  p_intro_uk text,
  p_editor_note_en text,
  p_editor_note_uk text,
  p_key_takeaways_en jsonb,
  p_key_takeaways_uk jsonb,
  p_items jsonb,
  p_reason text default 'composer_editorial_draft'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_current_revision public.weekly_digest_revisions;
  v_revision_id uuid;
  v_revision_number integer;
  v_content_hash text;
  v_carried jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title_en, ''))) = 0
     or char_length(btrim(coalesce(p_title_uk, ''))) = 0
     or char_length(btrim(coalesce(p_editor_note_en, ''))) = 0
     or char_length(btrim(coalesce(p_editor_note_uk, ''))) = 0 then
    raise exception 'Bilingual titles and editor notes are required';
  end if;
  if jsonb_typeof(coalesce(p_key_takeaways_en, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_key_takeaways_uk, '[]'::jsonb)) <> 'array' then
    raise exception 'Bilingual key takeaways must be non-empty text arrays';
  end if;
  if jsonb_array_length(coalesce(p_key_takeaways_en, '[]'::jsonb)) = 0
     or jsonb_array_length(coalesce(p_key_takeaways_uk, '[]'::jsonb)) = 0
     or exists (
       select 1
       from jsonb_array_elements(coalesce(p_key_takeaways_en, '[]'::jsonb)) takeaway(value)
       where jsonb_typeof(takeaway.value) <> 'string'
          or char_length(btrim(takeaway.value #>> '{}')) = 0
     )
     or exists (
       select 1
       from jsonb_array_elements(coalesce(p_key_takeaways_uk, '[]'::jsonb)) takeaway(value)
       where jsonb_typeof(takeaway.value) <> 'string'
          or char_length(btrim(takeaway.value #>> '{}')) = 0
     ) then
    raise exception 'Bilingual key takeaways must be non-empty text arrays';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' then
    raise exception 'A weekly digest revision must contain 3 to 7 stories';
  end if;
  if jsonb_array_length(p_items) not between 3 and 7 then
    raise exception 'A weekly digest revision must contain 3 to 7 stories';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) entry(item)
    where jsonb_typeof(entry.item) <> 'object'
       or char_length(btrim(coalesce(entry.item ->> 'brief_item_id', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'title_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'title_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'summary_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'summary_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'body_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'body_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'practical_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'practical_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'takeaway_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'takeaway_uk', ''))) = 0
       or jsonb_typeof(coalesce(entry.item -> 'sources', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(entry.item -> 'source_snapshot', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Every story requires complete bilingual editorial content';
  end if;
  if (
    select count(*) <> count(distinct entry.item ->> 'brief_item_id')
    from jsonb_array_elements(p_items) entry(item)
  ) then
    raise exception 'A weekly digest revision cannot contain duplicate source stories';
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
    raise exception 'An initialized active revision is required';
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
    into v_current_revision
  from public.weekly_digest_revisions revision
  where revision.id = v_digest.active_revision_id;
  if v_current_revision.id is null then
    raise exception 'The active Weekly Digest revision was not found';
  end if;

  v_content_hash := md5(jsonb_build_object(
    'schema', 'weekly-revision-v1',
    'title_en', btrim(p_title_en),
    'title_uk', btrim(p_title_uk),
    'intro_en', nullif(btrim(coalesce(p_intro_en, '')), ''),
    'intro_uk', nullif(btrim(coalesce(p_intro_uk, '')), ''),
    'editor_note_en', btrim(p_editor_note_en),
    'editor_note_uk', btrim(p_editor_note_uk),
    'key_takeaways_en', p_key_takeaways_en,
    'key_takeaways_uk', p_key_takeaways_uk,
    'items', p_items
  )::text);
  if v_current_revision.content_hash = v_content_hash then
    return v_current_revision.id;
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
    into v_revision_number
  from public.weekly_digest_revisions revision
  where revision.weekly_digest_id = p_weekly_digest_id;

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
    v_current_revision.selection_run_id,
    btrim(p_title_en),
    btrim(p_title_uk),
    nullif(btrim(coalesce(p_intro_en, '')), ''),
    nullif(btrim(coalesce(p_intro_uk, '')), ''),
    btrim(p_editor_note_en),
    btrim(p_editor_note_uk),
    p_key_takeaways_en,
    p_key_takeaways_uk,
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
    (entry.item ->> 'brief_item_id')::uuid,
    entry.ordinality::smallint,
    btrim(entry.item ->> 'title_en'),
    btrim(entry.item ->> 'title_uk'),
    btrim(entry.item ->> 'summary_en'),
    btrim(entry.item ->> 'summary_uk'),
    btrim(entry.item ->> 'body_en'),
    btrim(entry.item ->> 'body_uk'),
    nullif(btrim(coalesce(entry.item ->> 'why_en', '')), ''),
    nullif(btrim(coalesce(entry.item ->> 'why_uk', '')), ''),
    btrim(entry.item ->> 'practical_en'),
    btrim(entry.item ->> 'practical_uk'),
    btrim(entry.item ->> 'takeaway_en'),
    btrim(entry.item ->> 'takeaway_uk'),
    nullif(entry.item ->> 'event_date', '')::date,
    entry.item -> 'sources',
    entry.item -> 'source_snapshot'
  from jsonb_array_elements(p_items) with ordinality as entry(item, ordinality);

  v_carried := public.carry_forward_weekly_digest_revision_artifacts(
    v_current_revision.id,
    v_revision_id,
    auth.uid()
  );

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

  update public.weekly_digest_generation_jobs
  set status = 'cancelled',
      locked_at = null,
      finished_at = now(),
      last_error = 'Superseded by a newer immutable editorial revision.'
  where revision_id = v_current_revision.id
    and status in ('queued', 'failed');

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
      'reason', left(coalesce(nullif(btrim(p_reason), ''), 'composer_editorial_draft'), 120),
      'carried_artifact_count', coalesce((v_carried ->> 'carried_count')::integer, 0),
      'invalidated_slots', coalesce(v_carried -> 'invalidated_slots', '[]'::jsonb)
    )
  );
  return v_revision_id;
end;
$function$;

create or replace function public.create_service_weekly_digest_revision_with_visual_direction(
  p_weekly_digest_id uuid,
  p_title_en text,
  p_title_uk text,
  p_intro_en text,
  p_intro_uk text,
  p_editor_note_en text,
  p_editor_note_uk text,
  p_key_takeaways_en jsonb,
  p_key_takeaways_uk jsonb,
  p_items jsonb,
  p_display_title_en text,
  p_display_title_uk text,
  p_visual_thesis_en text,
  p_visual_thesis_uk text,
  p_reason text default 'composer_editorial_draft'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_current_revision public.weekly_digest_revisions;
  v_revision_id uuid;
  v_revision_number integer;
  v_content_hash text;
  v_carried jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title_en, ''))) = 0
     or char_length(btrim(coalesce(p_title_uk, ''))) = 0
     or char_length(btrim(coalesce(p_editor_note_en, ''))) = 0
     or char_length(btrim(coalesce(p_editor_note_uk, ''))) = 0 then
    raise exception 'Bilingual titles and editor notes are required';
  end if;
  if char_length(btrim(coalesce(p_display_title_en, ''))) not between 8 and 96
     or char_length(btrim(coalesce(p_display_title_uk, ''))) not between 8 and 96 then
    raise exception 'Both display titles must contain 8 to 96 characters';
  end if;
  if char_length(btrim(coalesce(p_visual_thesis_en, ''))) not between 16 and 360
     or char_length(btrim(coalesce(p_visual_thesis_uk, ''))) not between 16 and 360 then
    raise exception 'Both visual theses must contain 16 to 360 characters';
  end if;
  if jsonb_typeof(coalesce(p_key_takeaways_en, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_key_takeaways_uk, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_key_takeaways_en, '[]'::jsonb)) = 0
     or jsonb_array_length(coalesce(p_key_takeaways_uk, '[]'::jsonb)) = 0
     or exists (
       select 1
       from jsonb_array_elements(coalesce(p_key_takeaways_en, '[]'::jsonb)) takeaway(value)
       where jsonb_typeof(takeaway.value) <> 'string'
          or char_length(btrim(takeaway.value #>> '{}')) = 0
     )
     or exists (
       select 1
       from jsonb_array_elements(coalesce(p_key_takeaways_uk, '[]'::jsonb)) takeaway(value)
       where jsonb_typeof(takeaway.value) <> 'string'
          or char_length(btrim(takeaway.value #>> '{}')) = 0
     ) then
    raise exception 'Bilingual key takeaways must be non-empty text arrays';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) not between 3 and 7 then
    raise exception 'A weekly digest revision must contain 3 to 7 stories';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) entry(item)
    where jsonb_typeof(entry.item) <> 'object'
       or char_length(btrim(coalesce(entry.item ->> 'brief_item_id', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'title_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'title_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'summary_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'summary_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'body_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'body_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'practical_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'practical_uk', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'takeaway_en', ''))) = 0
       or char_length(btrim(coalesce(entry.item ->> 'takeaway_uk', ''))) = 0
       or jsonb_typeof(coalesce(entry.item -> 'sources', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(entry.item -> 'source_snapshot', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Every story requires complete bilingual editorial content';
  end if;
  if (
    select count(*) <> count(distinct entry.item ->> 'brief_item_id')
    from jsonb_array_elements(p_items) entry(item)
  ) then
    raise exception 'A weekly digest revision cannot contain duplicate source stories';
  end if;

  select digest.* into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null then
    raise exception 'Weekly digest was not found';
  end if;
  if v_digest.active_revision_id is null then
    raise exception 'An initialized active revision is required';
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

  select revision.* into v_current_revision
  from public.weekly_digest_revisions revision
  where revision.id = v_digest.active_revision_id;
  if v_current_revision.id is null then
    raise exception 'The active Weekly Digest revision was not found';
  end if;

  v_content_hash := md5(jsonb_build_object(
    'schema', 'weekly-revision-v2-visual-direction',
    'title_en', btrim(p_title_en),
    'title_uk', btrim(p_title_uk),
    'intro_en', nullif(btrim(coalesce(p_intro_en, '')), ''),
    'intro_uk', nullif(btrim(coalesce(p_intro_uk, '')), ''),
    'editor_note_en', btrim(p_editor_note_en),
    'editor_note_uk', btrim(p_editor_note_uk),
    'key_takeaways_en', p_key_takeaways_en,
    'key_takeaways_uk', p_key_takeaways_uk,
    'items', p_items,
    'visual_direction', jsonb_build_object(
      'display_title_en', btrim(p_display_title_en),
      'display_title_uk', btrim(p_display_title_uk),
      'visual_thesis_en', btrim(p_visual_thesis_en),
      'visual_thesis_uk', btrim(p_visual_thesis_uk)
    )
  )::text);
  if v_current_revision.content_hash = v_content_hash then
    return v_current_revision.id;
  end if;

  perform set_config('app.weekly_digest_revision_write', 'allowed', true);
  select coalesce(max(revision.revision_number), 0) + 1 into v_revision_number
  from public.weekly_digest_revisions revision
  where revision.weekly_digest_id = p_weekly_digest_id;

  insert into public.weekly_digest_revisions (
    weekly_digest_id, revision_number, selection_run_id, title_en, title_uk,
    display_title_en, display_title_uk, visual_thesis_en, visual_thesis_uk,
    intro_en, intro_uk, editor_note_en, editor_note_uk,
    key_takeaways_en, key_takeaways_uk, content_hash, created_by
  ) values (
    p_weekly_digest_id, v_revision_number, v_current_revision.selection_run_id,
    btrim(p_title_en), btrim(p_title_uk),
    btrim(p_display_title_en), btrim(p_display_title_uk),
    btrim(p_visual_thesis_en), btrim(p_visual_thesis_uk),
    nullif(btrim(coalesce(p_intro_en, '')), ''),
    nullif(btrim(coalesce(p_intro_uk, '')), ''),
    btrim(p_editor_note_en), btrim(p_editor_note_uk),
    p_key_takeaways_en, p_key_takeaways_uk, v_content_hash, auth.uid()
  ) returning id into v_revision_id;

  insert into public.weekly_digest_revision_items (
    revision_id, brief_item_id, rank, title_en, title_uk, summary_en, summary_uk,
    body_en, body_uk, why_en, why_uk, practical_en, practical_uk,
    takeaway_en, takeaway_uk, event_date, sources, source_snapshot
  )
  select
    v_revision_id,
    (entry.item ->> 'brief_item_id')::uuid,
    entry.ordinality::smallint,
    btrim(entry.item ->> 'title_en'), btrim(entry.item ->> 'title_uk'),
    btrim(entry.item ->> 'summary_en'), btrim(entry.item ->> 'summary_uk'),
    btrim(entry.item ->> 'body_en'), btrim(entry.item ->> 'body_uk'),
    nullif(btrim(coalesce(entry.item ->> 'why_en', '')), ''),
    nullif(btrim(coalesce(entry.item ->> 'why_uk', '')), ''),
    btrim(entry.item ->> 'practical_en'), btrim(entry.item ->> 'practical_uk'),
    btrim(entry.item ->> 'takeaway_en'), btrim(entry.item ->> 'takeaway_uk'),
    nullif(entry.item ->> 'event_date', '')::date,
    entry.item -> 'sources', entry.item -> 'source_snapshot'
  from jsonb_array_elements(p_items) with ordinality as entry(item, ordinality);

  v_carried := public.carry_forward_weekly_digest_revision_artifacts(
    v_current_revision.id,
    v_revision_id,
    auth.uid()
  );

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

  update public.weekly_digest_generation_jobs
  set status = 'cancelled',
      locked_at = null,
      finished_at = now(),
      last_error = 'Superseded by a newer immutable editorial revision.'
  where revision_id = v_current_revision.id
    and status in ('queued', 'failed');

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    p_weekly_digest_id, v_revision_id, auth.uid(), 'revision_created',
    jsonb_build_object(
      'revision_number', v_revision_number,
      'content_hash', v_content_hash,
      'reason', left(coalesce(nullif(btrim(p_reason), ''), 'composer_editorial_draft'), 120),
      'carried_artifact_count', coalesce((v_carried ->> 'carried_count')::integer, 0),
      'invalidated_slots', coalesce(v_carried -> 'invalidated_slots', '[]'::jsonb),
      'has_visual_direction', true
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
  v_previous_ids uuid[] := '{}';
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

  select coalesce(array_agg(artifact.id), '{}')
    into v_previous_ids
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = p_revision_id
    and artifact.slot_key = p_slot_key
    and artifact.is_current;

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

  -- Stage 0 / A2: visual replacement must not revoke social *copy* approval.
  -- Cover/story_image/social_asset still stale-mark pixel dependents (PDF, social
  -- crops) via the CTE above. Text stays approved; attached artifactIds are
  -- remapped onto the new current row so Ship does not require a full re-approve.
  if p_artifact_type in ('cover', 'story_image', 'social_asset')
     and cardinality(v_previous_ids) > 0 then
    perform set_config('app.weekly_digest_social_asset_relink', 'allowed', true);
    perform set_config('app.weekly_digest_social_action', 'allowed', true);
    update public.social_posts post
    set asset_urls = (
      select coalesce(jsonb_agg(
        case
          when coalesce(elem.value ->> 'artifactId', '') ~ '^[0-9a-fA-F-]{36}$'
           and (elem.value ->> 'artifactId')::uuid = any (v_previous_ids)
          then jsonb_set(elem.value, '{artifactId}', to_jsonb(v_artifact_id::text), true)
          else elem.value
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(coalesce(post.asset_urls, '[]'::jsonb)) elem
    )
    where post.package_id in (
      select pkg.id
      from public.social_packages pkg
      where pkg.weekly_digest_id = p_weekly_digest_id
    )
    and exists (
      select 1
      from jsonb_array_elements(coalesce(post.asset_urls, '[]'::jsonb)) elem
      where coalesce(elem.value ->> 'artifactId', '') ~ '^[0-9a-fA-F-]{36}$'
        and (elem.value ->> 'artifactId')::uuid = any (v_previous_ids)
    );
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

-- Service-role inventory of applied schema migrations. Used by
-- `npm run migrations:check` so a committed-but-undeployed migration
-- (the 2026-08-28 ship_weekly_digest incident) fails locally/CI.
create or replace function public.list_applied_schema_migrations()
returns table (version text)
language sql
stable
security definer
set search_path = public, supabase_migrations
as $function$
  select migrations.version
  from supabase_migrations.schema_migrations as migrations
  order by migrations.version;
$function$;

revoke all on function public.list_applied_schema_migrations()
  from public, anon, authenticated;
grant execute on function public.list_applied_schema_migrations() to service_role;

commit;
