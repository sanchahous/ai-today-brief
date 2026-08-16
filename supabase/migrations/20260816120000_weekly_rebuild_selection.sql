begin;

-- Rebuild the story selection of a weekly digest that already has an active
-- revision.
--
-- Neither existing path can do this. `initialize_weekly_digest_revision_from_legacy`
-- refuses once `active_revision_id` is set (it is the first-run initializer),
-- and `create_service_weekly_digest_revision` is the master-writer contract: it
-- demands a finished bilingual article — editor note, key takeaways, and a
-- non-empty practical example and takeaway on every story. A freshly rebuilt
-- selection is seed-stage material, so those fields are legitimately empty
-- until the owner (or Content Studio) writes them.
--
-- Same immutability rule as everywhere else: never mutate revision rows, mint a
-- new revision and point the digest at it.
create or replace function public.rebuild_weekly_digest_selection(
  p_weekly_digest_id uuid,
  p_items jsonb,
  p_selection_run_id uuid default null,
  p_reason text default 'selection_rebuild'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision_id uuid;
  v_revision_number integer;
  v_content_hash text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) not between 3 and 7 then
    raise exception 'A weekly digest revision must contain 3 to 7 stories';
  end if;
  -- Seed stage: title/summary/body must exist (body is seeded from the daily
  -- item), practical/takeaway may still be empty.
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
       or jsonb_typeof(coalesce(entry.item -> 'sources', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(entry.item -> 'source_snapshot', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Every story requires a headline, summary and body in both languages';
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
  -- Mirrors create_service_weekly_digest_revision: once the preflight gate has
  -- closed on a scheduled release, the owner must pause it before editing.
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; the owner must pause the release before editing'
      using errcode = '55000';
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
    into v_revision_number
  from public.weekly_digest_revisions revision
  where revision.weekly_digest_id = p_weekly_digest_id;

  v_content_hash := md5(
    jsonb_build_object(
      'title_en', v_digest.title_en,
      'title_uk', v_digest.title_uk,
      'intro_en', v_digest.intro_en,
      'intro_uk', v_digest.intro_uk,
      'items', p_items
    )::text
  );

  insert into public.weekly_digest_revisions (
    weekly_digest_id,
    revision_number,
    selection_run_id,
    title_en,
    title_uk,
    intro_en,
    intro_uk,
    content_hash,
    created_by
  ) values (
    p_weekly_digest_id,
    v_revision_number,
    coalesce(
      p_selection_run_id,
      (
        select run.id
        from public.weekly_digest_selection_runs run
        where run.weekly_digest_id = p_weekly_digest_id
        order by run.created_at desc, run.id desc
        limit 1
      )
    ),
    v_digest.title_en,
    v_digest.title_uk,
    v_digest.intro_en,
    v_digest.intro_uk,
    v_content_hash,
    null
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
    coalesce((entry.item ->> 'rank')::integer, entry.ordinality::integer),
    entry.item ->> 'title_en',
    entry.item ->> 'title_uk',
    entry.item ->> 'summary_en',
    entry.item ->> 'summary_uk',
    entry.item ->> 'body_en',
    entry.item ->> 'body_uk',
    nullif(entry.item ->> 'why_en', ''),
    nullif(entry.item ->> 'why_uk', ''),
    nullif(entry.item ->> 'practical_en', ''),
    nullif(entry.item ->> 'practical_uk', ''),
    nullif(entry.item ->> 'takeaway_en', ''),
    nullif(entry.item ->> 'takeaway_uk', ''),
    nullif(entry.item ->> 'event_date', '')::date,
    coalesce(entry.item -> 'sources', '[]'::jsonb),
    coalesce(entry.item -> 'source_snapshot', '{}'::jsonb)
  from jsonb_array_elements(p_items) with ordinality as entry(item, ordinality);

  -- A rebuilt selection invalidates every downstream approval: different
  -- stories mean the research packs, article, images and social copy attached
  -- to the previous revision no longer describe this digest.
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

  insert into public.weekly_digest_release_events (
    weekly_digest_id,
    revision_id,
    event_type,
    payload
  ) values (
    p_weekly_digest_id,
    v_revision_id,
    'revision_created',
    jsonb_build_object(
      'revision_number', v_revision_number,
      'content_hash', v_content_hash,
      'source', 'selection_rebuild',
      'reason', p_reason
    )
  );

  return v_revision_id;
end;
$function$;

revoke all on function public.rebuild_weekly_digest_selection(uuid, jsonb, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.rebuild_weekly_digest_selection(uuid, jsonb, uuid, text)
  to service_role;

commit;
