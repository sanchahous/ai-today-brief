begin;

-- After 20260824110000 revoked table-wide SELECT on weekly_digest_revisions and
-- re-granted only public columns (excluding visual_thesis_* and later
-- visual_refresh_source_revision_id), every authenticated call to
-- save_weekly_digest_artifact failed inside weekly_digest_artifact_input_hash:
-- `select revision.* into v_revision` still requires privilege on every column
-- of the composite type → 42501 permission denied for table
-- weekly_digest_revisions. Reproduced 2026-08-26 with
-- `set local role authenticated` on digest 71af784b-3c89-47f8-bc38-e3eae4def2a7.
--
-- Fix: security definer (same pattern as create_weekly_digest_revision after
-- 20260810160000) plus an explicit column list so future private columns cannot
-- silently break the hash again. Payload / md5 identity is unchanged: thesis
-- text still never enters the hash, only content_hash when any direction field
-- is present.

create or replace function public.weekly_digest_artifact_input_hash(
  p_revision_id uuid,
  p_artifact_type text,
  p_locale text,
  p_revision_item_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_revision_id uuid;
  v_title_en text;
  v_title_uk text;
  v_intro_en text;
  v_intro_uk text;
  v_editor_note_en text;
  v_editor_note_uk text;
  v_key_takeaways_en jsonb;
  v_key_takeaways_uk jsonb;
  v_content_hash text;
  v_has_visual_direction boolean;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb := null;
  v_dependencies jsonb := '[]'::jsonb;
  v_payload jsonb;
begin
  select
    revision.id,
    revision.title_en,
    revision.title_uk,
    revision.intro_en,
    revision.intro_uk,
    revision.editor_note_en,
    revision.editor_note_uk,
    revision.key_takeaways_en,
    revision.key_takeaways_uk,
    revision.content_hash,
    (
      revision.display_title_en is not null
      or revision.display_title_uk is not null
      or revision.visual_thesis_en is not null
      or revision.visual_thesis_uk is not null
    )
  into
    v_revision_id,
    v_title_en,
    v_title_uk,
    v_intro_en,
    v_intro_uk,
    v_editor_note_en,
    v_editor_note_uk,
    v_key_takeaways_en,
    v_key_takeaways_uk,
    v_content_hash,
    v_has_visual_direction
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id;
  if v_revision_id is null then
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
      'title', case when p_locale = 'uk' then v_title_uk else v_title_en end,
      'intro', case when p_locale = 'uk' then v_intro_uk else v_intro_en end,
      'editor_note', case when p_locale = 'uk' then v_editor_note_uk else v_editor_note_en end,
      'takeaways', case when p_locale = 'uk' then v_key_takeaways_uk else v_key_takeaways_en end,
      'items', v_items
    );
  elsif p_artifact_type in (
    'video_script', 'video_manifest', 'video_preview', 'video_final', 'heygen_preview', 'graphics_preview'
  ) then
    v_payload := v_payload || jsonb_build_object(
      'title', v_title_en,
      'intro', v_intro_en,
      'items', v_items
    );
  else
    v_payload := v_payload || jsonb_build_object(
      'title_en', v_title_en,
      'title_uk', v_title_uk,
      'intro_en', v_intro_en,
      'intro_uk', v_intro_uk,
      'takeaways_en', v_key_takeaways_en,
      'takeaways_uk', v_key_takeaways_uk,
      'items', v_items
    );
  end if;

  -- Preserve hashes for historical revisions with no direction.  Once a
  -- complete direction exists, a visual derivative or its prompt set cannot
  -- silently be carried from a revision with another visual thesis.
  if p_artifact_type in ('cover', 'pdf', 'social_asset', 'story_prompt_set')
     and v_has_visual_direction then
    -- Do not feed private thesis text through this utility:
    -- `content_hash` already changes with the complete direction and is the
    -- public-safe dependency fingerprint carried by the revision itself.
    v_payload := v_payload || jsonb_build_object(
      'visual_direction_revision_hash', v_content_hash
    );
  end if;

  return md5(v_payload::text);
end;
$function$;

revoke all on function public.weekly_digest_artifact_input_hash(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.weekly_digest_artifact_input_hash(uuid, text, text, uuid)
  to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'weekly_digest_artifact_input_hash'
      and p.prosecdef
  ) then
    raise exception 'weekly_digest_artifact_input_hash must be security definer';
  end if;
end;
$$;

-- Smoke: authenticated can hash without SELECT on private visual_thesis_*.
-- Skip when the database has no revisions yet (fresh local bootstrap).
do $$
declare
  v_revision_id uuid;
  v_service_hash text;
  v_auth_hash text;
begin
  select revision.id
    into v_revision_id
  from public.weekly_digest_revisions revision
  order by revision.created_at desc
  limit 1;
  if v_revision_id is null then
    return;
  end if;

  select public.weekly_digest_artifact_input_hash(
    v_revision_id, 'story_image', 'neutral', null
  ) into v_service_hash;

  execute 'set local role authenticated';
  select public.weekly_digest_artifact_input_hash(
    v_revision_id, 'story_image', 'neutral', null
  ) into v_auth_hash;
  execute 'reset role';

  if v_auth_hash is distinct from v_service_hash
     or v_auth_hash is null
     or char_length(v_auth_hash) <> 32 then
    raise exception 'weekly_digest_artifact_input_hash authenticated smoke failed';
  end if;
end;
$$;

commit;
