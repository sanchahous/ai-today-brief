begin;

-- A failed master quality gate today discards the entire generated bundle --
-- article, video script, everything -- because create_service_weekly_digest_revision
-- always makes the new revision active, resetting approvals on whatever the
-- editor already had in review. This sibling function creates the exact same
-- immutable revision + items, but never touches weekly_digests.active_revision_id
-- (or the approval/schedule fields that go with it) and never cancels jobs on
-- the currently active revision, since it isn't being superseded. The result
-- is a normal, inactive weekly_digest_revisions row: it already shows up in
-- Overview -> "Editorial versions" (that query has no active filter) and can
-- be promoted with the existing revert_weekly_digest_revision RPC, unchanged.
create or replace function public.create_service_weekly_digest_revision_draft(
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
  p_reason text default 'editorial_master_quality_gate_draft'
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
  -- Unlike the activating function, a hash match against the *active*
  -- revision here is not a meaningful no-op -- a rejected draft that happens
  -- to match today's live content isn't worth a row. Return it as-is rather
  -- than inserting a pointless duplicate.
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

  -- Deliberately no update to weekly_digests (active_revision_id / status /
  -- approved_* / schedule) and no cancellation of jobs on v_current_revision
  -- -- that revision is still the live one and this draft does not touch it.

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
    'draft_revision_created',
    jsonb_build_object(
      'revision_number', v_revision_number,
      'content_hash', v_content_hash,
      'reason', left(coalesce(nullif(btrim(p_reason), ''), 'editorial_master_quality_gate_draft'), 120),
      'superseded_revision_id', null
    )
  );
  return v_revision_id;
end;
$function$;

revoke all on function public.create_service_weekly_digest_revision_draft(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_service_weekly_digest_revision_draft(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text
) to service_role;

commit;
