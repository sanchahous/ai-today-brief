begin;

-- `display_title_*` is public presentation copy while `visual_thesis_*` is
-- private editorial direction.  A direction-bearing revision must be born
-- with all four values: updating an ordinary immutable revision after the
-- fact could carry a cover/PDF whose prompt no longer describes it.

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
      ) order by item.rank
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
      ) order by item.rank
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
    ) order by dependency.artifact_type, dependency.slot_key
  ), '[]'::jsonb)
    into v_dependencies
  from public.weekly_digest_artifacts dependency
  where dependency.revision_id = p_revision_id
    and dependency.is_current
    and (
      (p_artifact_type = 'cover' and dependency.artifact_type = 'story_image')
      or (p_artifact_type = 'pdf' and dependency.artifact_type in ('cover', 'story_image', 'video_final'))
      or (p_artifact_type = 'social_asset' and dependency.artifact_type in ('cover', 'story_image'))
      or (p_artifact_type = 'video_manifest' and dependency.artifact_type in ('video_script', 'story_image'))
      or (p_artifact_type in ('video_preview', 'video_final', 'heygen_preview', 'graphics_preview')
        and dependency.artifact_type in ('video_script', 'video_manifest', 'story_image'))
      or (p_artifact_type in ('captions', 'thumbnail')
        and dependency.artifact_type in ('video_script', 'video_manifest', 'video_final'))
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
      'editor_note', case when p_locale = 'uk' then v_revision.editor_note_uk else v_revision.editor_note_en end,
      'takeaways', case when p_locale = 'uk' then v_revision.key_takeaways_uk else v_revision.key_takeaways_en end,
      'items', v_items
    );
  elsif p_artifact_type in (
    'video_script', 'video_manifest', 'video_preview', 'video_final', 'heygen_preview', 'graphics_preview'
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

  -- Preserve hashes for historical revisions with no direction.  Once a
  -- complete direction exists, a visual derivative or its prompt set cannot
  -- silently be carried from a revision with another visual thesis.
  if p_artifact_type in ('cover', 'pdf', 'social_asset', 'story_prompt_set')
     and (
       v_revision.display_title_en is not null
       or v_revision.display_title_uk is not null
       or v_revision.visual_thesis_en is not null
       or v_revision.visual_thesis_uk is not null
     ) then
    -- Do not feed private thesis text through this authenticated utility:
    -- `content_hash` already changes with the complete direction and is the
    -- public-safe dependency fingerprint carried by the revision itself.
    v_payload := v_payload || jsonb_build_object(
      'visual_direction_revision_hash', v_revision.content_hash
    );
  end if;

  return md5(v_payload::text);
end;
$function$;

-- The server-side master composer uses the same contract as a manual editor,
-- but its authorization is the service role rather than an interactive JWT.
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
      'carried_artifact_count', 0,
      'invalidated_slots', '[]'::jsonb,
      'has_visual_direction', true
    )
  );
  return v_revision_id;
end;
$function$;

-- Ordinary editorial revisions remain append-only. The only update exception
-- is the four direction fields on the active private visual-refresh draft;
-- the dedicated RPC below proves its published provenance before setting this
-- transaction-local capability.
create or replace function public.reject_weekly_digest_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_table_name = 'weekly_digest_revisions'
     and tg_op = 'UPDATE'
     and current_setting('app.weekly_visual_refresh_direction_write', true) = 'allowed'
     and (
       to_jsonb(new) - array[
         'display_title_en',
         'display_title_uk',
         'visual_thesis_en',
         'visual_thesis_uk',
         'content_hash'
       ]
     ) is not distinct from (
       to_jsonb(old) - array[
         'display_title_en',
         'display_title_uk',
         'visual_thesis_en',
         'visual_thesis_uk',
         'content_hash'
       ]
     ) then
    return new;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$function$;

create or replace function public.update_weekly_visual_refresh_direction(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_display_title_en text,
  p_display_title_uk text,
  p_visual_thesis_en text,
  p_visual_thesis_uk text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision public.weekly_digest_revisions;
  v_source public.weekly_digest_revisions;
  v_item public.weekly_digest_revision_items;
  v_content_hash text;
  v_regeneration_token text := gen_random_uuid()::text;
begin
  if not public.has_social_role(array['owner']) or not public.has_social_aal2() then
    raise exception 'An AAL2 owner session is required for a visual refresh' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_display_title_en, ''))) not between 8 and 96
     or char_length(btrim(coalesce(p_display_title_uk, ''))) not between 8 and 96 then
    raise exception 'Both display titles must contain 8 to 96 characters';
  end if;
  if char_length(btrim(coalesce(p_visual_thesis_en, ''))) not between 16 and 360
     or char_length(btrim(coalesce(p_visual_thesis_uk, ''))) not between 16 and 360 then
    raise exception 'Both visual theses must contain 16 to 360 characters';
  end if;

  select digest.* into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null
     or v_digest.status <> 'published'
     or v_digest.published_revision_id is null
     or v_digest.active_revision_id is distinct from p_revision_id then
    raise exception 'An active private visual-refresh revision of this published digest is required';
  end if;

  select revision.* into v_revision
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id
  for update;
  if v_revision.id is null
     or v_revision.visual_refresh_source_revision_id is distinct from v_digest.published_revision_id then
    raise exception 'Only the active private visual-refresh revision may change direction';
  end if;

  select source.* into v_source
  from public.weekly_digest_revisions source
  where source.id = v_digest.published_revision_id
    and source.weekly_digest_id = p_weekly_digest_id;
  if v_source.id is null then
    raise exception 'Published weekly revision was not found';
  end if;

  v_content_hash := md5(jsonb_build_object(
    'schema', 'weekly-visual-refresh-v1',
    'source_revision_id', v_source.id,
    'source_content_hash', v_source.content_hash,
    'display_title_en', btrim(p_display_title_en),
    'display_title_uk', btrim(p_display_title_uk),
    'visual_thesis_en', btrim(p_visual_thesis_en),
    'visual_thesis_uk', btrim(p_visual_thesis_uk)
  )::text);

  perform set_config('app.weekly_visual_refresh_direction_write', 'allowed', true);
  update public.weekly_digest_revisions
  set display_title_en = btrim(p_display_title_en),
      display_title_uk = btrim(p_display_title_uk),
      visual_thesis_en = btrim(p_visual_thesis_en),
      visual_thesis_uk = btrim(p_visual_thesis_uk),
      content_hash = v_content_hash
  where id = p_revision_id
    and weekly_digest_id = p_weekly_digest_id
    and visual_refresh_source_revision_id = v_digest.published_revision_id;

  -- A claimed worker is fenced by the revision content hash when it tries to
  -- persist. Cancel every runnable predecessor, including a dispatched GitHub
  -- job and a Vercel retry, before queuing the replacement.
  with cancelled_jobs as (
    update public.weekly_digest_generation_jobs
    set status = 'cancelled',
        locked_at = null,
        next_attempt_at = null,
        finished_at = now(),
        failure_code = 'superseded_visual_direction',
        status_reason = 'Superseded by updated visual direction.',
        last_error = 'Superseded by updated visual direction.'
    where weekly_digest_id = p_weekly_digest_id
      and revision_id = p_revision_id
      and job_type in ('cover', 'story_image')
      and status in ('waiting', 'queued', 'dispatching', 'running', 'retry_scheduled', 'failed')
    returning id, current_attempt_id
  ), cancelled_attempts as (
    update public.weekly_digest_generation_attempts attempt
    set status = 'cancelled',
        finished_at = coalesce(attempt.finished_at, now()),
        heartbeat_at = now(),
        error_code = 'superseded_visual_direction',
        error_message = 'Superseded by updated visual direction.'
    from cancelled_jobs job
    where attempt.id = job.current_attempt_id
      and attempt.status = 'running'
    returning attempt.job_id, attempt.id
  )
  insert into public.weekly_digest_generation_events (
    job_id, attempt_id, event_type, level, message, metadata
  )
  select
    job.id,
    attempt.id,
    'job_cancelled',
    'warning',
    'Superseded by updated visual direction.',
    jsonb_build_object('failure_code', 'superseded_visual_direction')
  from cancelled_jobs job
  left join cancelled_attempts attempt on attempt.job_id = job.id;

  -- Do not leave a previously generated prompt set looking current after its
  -- governing direction changed. The replacement worker writes the new current
  -- version after the direction-hash fence below has accepted it.
  update public.weekly_digest_artifacts
  set is_current = false,
      review_status = case when review_status = 'approved' then 'stale' else review_status end
  where weekly_digest_id = p_weekly_digest_id
    and revision_id = p_revision_id
    and artifact_type = 'story_prompt_set'
    and coalesce(metadata ->> 'visual_refresh', 'false') = 'true'
    and is_current;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    p_weekly_digest_id,
    p_revision_id,
    auth.uid(),
    'visual_refresh_direction_updated',
    jsonb_build_object(
      'visual_refresh_source_revision_id', v_digest.published_revision_id,
      'direction_hash', v_content_hash,
      'regeneration_token', v_regeneration_token,
      'prompt_only', true,
      'published_revision_id_unchanged', v_digest.published_revision_id
    )
  );

  perform public.queue_weekly_visual_refresh_prompt_job(
    p_weekly_digest_id,
    p_revision_id,
    'cover',
    null,
    'weekly:visual-refresh:' || p_revision_id::text || ':direction:' || v_content_hash
      || ':regen:' || v_regeneration_token || ':cover'
  );
  for v_item in
    select item.*
    from public.weekly_digest_revision_items item
    where item.revision_id = p_revision_id
    order by item.rank
  loop
    perform public.queue_weekly_visual_refresh_prompt_job(
      p_weekly_digest_id,
      p_revision_id,
      'story_image',
      v_item.id,
      'weekly:visual-refresh:' || p_revision_id::text || ':direction:' || v_content_hash
        || ':regen:' || v_regeneration_token || ':story:' || v_item.id::text
    );
  end loop;

  return p_revision_id;
end;
$function$;

create or replace function public.create_weekly_digest_revision_with_visual_direction(
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
  p_visual_thesis_uk text
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
  if char_length(btrim(coalesce(p_display_title_en, ''))) not between 8 and 96
     or char_length(btrim(coalesce(p_display_title_uk, ''))) not between 8 and 96 then
    raise exception 'Both display titles must contain 8 to 96 characters';
  end if;
  if char_length(btrim(coalesce(p_visual_thesis_en, ''))) not between 16 and 360
     or char_length(btrim(coalesce(p_visual_thesis_uk, ''))) not between 16 and 360 then
    raise exception 'Both visual theses must contain 16 to 360 characters';
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
      or (item ? 'sources' and jsonb_typeof(item -> 'sources') <> 'array')
  ) then
    raise exception 'Every story requires bilingual title/summary and an optional sources array';
  end if;

  select digest.* into v_digest
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
    'schema', 'weekly-revision-v2-visual-direction',
    'title_en', btrim(p_title_en),
    'title_uk', btrim(p_title_uk),
    'intro_en', nullif(btrim(coalesce(p_intro_en, '')), ''),
    'intro_uk', nullif(btrim(coalesce(p_intro_uk, '')), ''),
    'editor_note_en', nullif(btrim(coalesce(p_editor_note_en, '')), ''),
    'editor_note_uk', nullif(btrim(coalesce(p_editor_note_uk, '')), ''),
    'key_takeaways_en', coalesce(p_key_takeaways_en, '[]'::jsonb),
    'key_takeaways_uk', coalesce(p_key_takeaways_uk, '[]'::jsonb),
    'items', p_items,
    'visual_direction', jsonb_build_object(
      'display_title_en', btrim(p_display_title_en),
      'display_title_uk', btrim(p_display_title_uk),
      'visual_thesis_en', btrim(p_visual_thesis_en),
      'visual_thesis_uk', btrim(p_visual_thesis_uk)
    )
  )::text);

  if v_digest.active_revision_id is not null then
    select revision.* into v_current_revision
    from public.weekly_digest_revisions revision
    where revision.id = v_digest.active_revision_id;
    if v_current_revision.id is not null and v_current_revision.content_hash = v_content_hash then
      return v_current_revision.id;
    end if;
  end if;

  perform set_config('app.weekly_digest_revision_write', 'allowed', true);
  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);
  v_previous_revision_id := v_digest.active_revision_id;

  if v_previous_revision_id is not null then
    update public.weekly_digest_generation_jobs
    set status = 'cancelled',
        locked_at = null,
        finished_at = now(),
        last_error = 'Superseded by a newer immutable editorial revision.'
    where revision_id = v_previous_revision_id
      and status in ('queued', 'failed');
  end if;

  select coalesce(max(revision.revision_number), 0) + 1 into v_revision_number
  from public.weekly_digest_revisions revision
  where revision.weekly_digest_id = p_weekly_digest_id;

  select run.id into v_selection_run_id
  from public.weekly_digest_selection_runs run
  where run.weekly_digest_id = p_weekly_digest_id
  order by run.created_at desc, run.id desc
  limit 1;

  insert into public.weekly_digest_revisions (
    weekly_digest_id, revision_number, selection_run_id, title_en, title_uk,
    display_title_en, display_title_uk, visual_thesis_en, visual_thesis_uk,
    intro_en, intro_uk, editor_note_en, editor_note_uk,
    key_takeaways_en, key_takeaways_uk, content_hash, created_by
  ) values (
    p_weekly_digest_id, v_revision_number, v_selection_run_id,
    btrim(p_title_en), btrim(p_title_uk),
    btrim(p_display_title_en), btrim(p_display_title_uk),
    btrim(p_visual_thesis_en), btrim(p_visual_thesis_uk),
    nullif(btrim(coalesce(p_intro_en, '')), ''),
    nullif(btrim(coalesce(p_intro_uk, '')), ''),
    nullif(btrim(coalesce(p_editor_note_en, '')), ''),
    nullif(btrim(coalesce(p_editor_note_uk, '')), ''),
    coalesce(p_key_takeaways_en, '[]'::jsonb),
    coalesce(p_key_takeaways_uk, '[]'::jsonb),
    v_content_hash, auth.uid()
  ) returning id into v_revision_id;

  insert into public.weekly_digest_revision_items (
    revision_id, brief_item_id, rank, title_en, title_uk, summary_en, summary_uk,
    body_en, body_uk, why_en, why_uk, practical_en, practical_uk,
    takeaway_en, takeaway_uk, event_date, sources, source_snapshot
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
    case when jsonb_typeof(entry.item -> 'sources') = 'array' then entry.item -> 'sources' else '[]'::jsonb end,
    case when jsonb_typeof(entry.item -> 'source_snapshot') = 'object' then entry.item -> 'source_snapshot' else '{}'::jsonb end
  from jsonb_array_elements(p_items) with ordinality as entry(item, ordinality);

  if v_previous_revision_id is not null then
    insert into public.weekly_digest_artifacts (
      weekly_digest_id, revision_id, revision_item_id, artifact_type, locale, slot_key,
      version, is_current, generation_status, review_status, input_hash, content,
      storage_bucket, storage_path, external_url, provider, provider_id, mime_type,
      width, height, byte_size, duration_seconds, metadata, created_by
    )
    select
      artifact.weekly_digest_id, v_revision_id, new_item.id, artifact.artifact_type,
      artifact.locale, artifact.slot_key, artifact.version, true,
      artifact.generation_status, artifact.review_status, artifact.input_hash,
      artifact.content, artifact.storage_bucket, artifact.storage_path, artifact.external_url,
      artifact.provider, artifact.provider_id, artifact.mime_type, artifact.width,
      artifact.height, artifact.byte_size, artifact.duration_seconds,
      artifact.metadata || jsonb_build_object('carried_from_artifact_id', artifact.id), auth.uid()
    from public.weekly_digest_artifacts artifact
    left join public.weekly_digest_revision_items old_item on old_item.id = artifact.revision_item_id
    left join public.weekly_digest_revision_items new_item
      on new_item.revision_id = v_revision_id and new_item.brief_item_id = old_item.brief_item_id
    where artifact.revision_id = v_previous_revision_id
      and artifact.is_current
      and (artifact.revision_item_id is null or new_item.id is not null)
      and artifact.input_hash = public.weekly_digest_artifact_input_hash(
        v_revision_id, artifact.artifact_type, artifact.locale, new_item.id
      );
    get diagnostics v_carried_count = row_count;

    insert into public.weekly_digest_artifact_reviews (
      artifact_id, reviewer_id, action, note, artifact_snapshot
    )
    select
      artifact.id, null, 'carried_forward',
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
  set status = 'in_review', approval_version = null, approved_by = null,
      approved_at = null, retry_after = null
  where post.publish_enabled
    and post.status in ('draft', 'in_review', 'approved', 'scheduled', 'failed')
    and exists (
      select 1 from public.social_packages package
      where package.id = post.package_id and package.weekly_digest_id = p_weekly_digest_id
    );

  update public.social_packages
  set weekly_digest_revision_id = v_revision_id, status = 'in_review', updated_at = now()
  where weekly_digest_id = p_weekly_digest_id
    and status not in ('publishing', 'posted', 'cancelled');

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    p_weekly_digest_id, v_revision_id, auth.uid(), 'revision_created',
    jsonb_build_object(
      'revision_number', v_revision_number,
      'content_hash', v_content_hash,
      'carried_artifact_count', v_carried_count,
      'invalidated_slots', v_invalidated_slots,
      'has_visual_direction', true
    )
  );

  return v_revision_id;
end;
$function$;

-- Put the immutable revision hash in every refresh job. The worker returns it
-- when saving prompt text, so a job claimed before an owner changes direction
-- cannot overwrite the newer prompt set when it finally finishes.
create or replace function public.queue_weekly_visual_refresh_prompt_job(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_job_type text,
  p_revision_item_id uuid default null,
  p_idempotency_key text default null
)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision public.weekly_digest_revisions;
  v_job public.weekly_digest_generation_jobs;
  v_slot_key text;
  v_input jsonb;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
begin
  if not public.has_social_role(array['owner']) or not public.has_social_aal2() then
    raise exception 'An AAL2 owner session is required for a visual refresh' using errcode = '42501';
  end if;
  if p_job_type not in ('cover', 'story_image') then
    raise exception 'Visual refresh queues only cover and story prompt jobs';
  end if;
  if v_key is null or char_length(v_key) not between 8 and 250 then
    raise exception 'Idempotency key must contain 8 to 250 characters';
  end if;

  select digest.* into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
    and digest.active_revision_id = p_revision_id
  for update;
  if v_digest.id is null
     or v_digest.status <> 'published'
     or v_digest.published_revision_id is null then
    raise exception 'An active private visual-refresh revision of this published digest is required';
  end if;

  select revision.* into v_revision
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id
  for update;
  if v_revision.id is null
     or v_revision.visual_refresh_source_revision_id is distinct from v_digest.published_revision_id then
    raise exception 'An active private visual-refresh revision of this published digest is required';
  end if;

  if p_job_type = 'cover' then
    if p_revision_item_id is not null then
      raise exception 'Cover prompt jobs cannot target a story item';
    end if;
    v_slot_key := 'cover-prompt:neutral';
  else
    if p_revision_item_id is null or not exists (
      select 1
      from public.weekly_digest_revision_items item
      where item.id = p_revision_item_id
        and item.revision_id = p_revision_id
    ) then
      raise exception 'Story prompt jobs require a story from the active visual-refresh revision';
    end if;
    v_slot_key := 'story-prompt-set:' || p_revision_item_id::text;
  end if;

  v_input := jsonb_build_object(
    'prompt_only', true,
    'visual_refresh', true,
    'visual_refresh_source_revision_id', v_digest.published_revision_id,
    'visual_refresh_revision_hash', v_revision.content_hash,
    'locale', 'neutral',
    'slot_key', v_slot_key,
    'revision_item_id', p_revision_item_id
  );

  insert into public.weekly_digest_generation_jobs (
    weekly_digest_id, revision_id, job_type, idempotency_key, status, input, created_by, status_reason
  ) values (
    p_weekly_digest_id, p_revision_id, p_job_type, v_key, 'queued', v_input, auth.uid(),
    'Queued prompt-only visual refresh'
  )
  on conflict (idempotency_key) do update
  set status = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then 'queued'
        else public.weekly_digest_generation_jobs.status
      end,
      attempts = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then 0
        else public.weekly_digest_generation_jobs.attempts
      end,
      input = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then excluded.input
        else public.weekly_digest_generation_jobs.input
      end,
      output = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then '{}'::jsonb
        else public.weekly_digest_generation_jobs.output
      end,
      last_error = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then null
        else public.weekly_digest_generation_jobs.last_error
      end,
      locked_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then null
        else public.weekly_digest_generation_jobs.locked_at
      end,
      started_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then null
        else public.weekly_digest_generation_jobs.started_at
      end,
      finished_at = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled') then null
        else public.weekly_digest_generation_jobs.finished_at
      end,
      status_reason = case
        when public.weekly_digest_generation_jobs.status in ('failed', 'cancelled')
          then 'Queued prompt-only visual refresh'
        else public.weekly_digest_generation_jobs.status_reason
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
    v_job.weekly_digest_id, v_job.revision_id, auth.uid(), 'generation_queued',
    jsonb_build_object(
      'job_id', v_job.id,
      'job_type', v_job.job_type,
      'status', v_job.status,
      'idempotency_key', v_job.idempotency_key,
      'visual_refresh', true,
      'prompt_only', true,
      'visual_refresh_revision_hash', v_revision.content_hash
    )
  );
  return v_job;
end;
$function$;

-- This strict service-only wrapper fences an in-flight worker against a
-- direction update before it delegates to the original prompt-only writer.
create or replace function public.save_weekly_visual_refresh_prompt_artifact_with_direction_hash(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_revision_item_id uuid,
  p_slot_key text,
  p_visual_refresh_revision_hash text,
  p_content jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_current_hash text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  -- Take locks in the same digest-then-revision order as the direction updater
  -- and hold them through the nested writer. A stale worker must therefore
  -- either persist before the new direction transaction (which invalidates its
  -- prompt set above) or observe the new hash and be rejected.
  select digest.* into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
    and digest.active_revision_id = p_revision_id
    and digest.status = 'published'
  for update;
  if v_digest.id is null or v_digest.published_revision_id is null then
    raise exception 'Active private visual-refresh revision of a published digest is required';
  end if;
  select revision.content_hash into v_current_hash
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id
    and revision.visual_refresh_source_revision_id = v_digest.published_revision_id
  for update;
  if v_current_hash is null then
    raise exception 'Active private visual-refresh revision of a published digest is required';
  end if;
  if btrim(coalesce(p_visual_refresh_revision_hash, '')) <> v_current_hash then
    raise exception 'Visual direction changed while this prompt job was running' using errcode = '55000';
  end if;
  return public.save_weekly_visual_refresh_prompt_artifact(
    p_weekly_digest_id => p_weekly_digest_id,
    p_revision_id => p_revision_id,
    p_revision_item_id => p_revision_item_id,
    p_slot_key => p_slot_key,
    p_content => p_content,
    p_metadata => coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'visual_refresh_revision_hash', v_current_hash
    )
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
    'visual_refresh_direction_updated', 'job_cancelled'
  ]::text[]));

revoke all on function public.create_weekly_digest_revision_with_visual_direction(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_weekly_digest_revision_with_visual_direction(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text
) to authenticated, service_role;

revoke all on function public.create_service_weekly_digest_revision_with_visual_direction(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_service_weekly_digest_revision_with_visual_direction(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text
) to service_role;

revoke all on function public.update_weekly_visual_refresh_direction(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_weekly_visual_refresh_direction(
  uuid, uuid, text, text, text, text
) to authenticated;

revoke all on function public.queue_weekly_visual_refresh_prompt_job(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.queue_weekly_visual_refresh_prompt_job(
  uuid, uuid, text, uuid, text
) to authenticated;

revoke all on function public.save_weekly_visual_refresh_prompt_artifact_with_direction_hash(
  uuid, uuid, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.save_weekly_visual_refresh_prompt_artifact_with_direction_hash(
  uuid, uuid, uuid, text, text, jsonb, jsonb
) to service_role;

commit;
