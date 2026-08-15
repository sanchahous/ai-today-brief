begin;

-- Additive artifact type for copy-ready illustration prompts (weekly-illustration-plan P2).
-- Text only: never a public image. Input-hash dependency matches story_image (the revision item),
-- so a rewritten story invalidates the prompt set the same way it invalidates the illustration.
-- save_weekly_digest_artifact is unchanged: replacing prompts must not stale cover/pdf/social pixels.

alter table public.weekly_digest_artifacts
  drop constraint if exists weekly_digest_artifacts_artifact_type_check,
  add constraint weekly_digest_artifacts_artifact_type_check check (artifact_type in (
    'research_pack',
    'content_quality_report',
    'article',
    'pdf',
    'cover',
    'story_image',
    'story_prompt_set',
    'video_script',
    'video_manifest',
    'video_preview',
    'video_final',
    'captions',
    'thumbnail',
    'heygen_preview',
    'graphics_preview',
    'social_asset'
  ));

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
      )
      order by item.rank
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
      )
      order by item.rank
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
    )
    order by dependency.artifact_type, dependency.slot_key
  ), '[]'::jsonb)
    into v_dependencies
  from public.weekly_digest_artifacts dependency
  where dependency.revision_id = p_revision_id
    and dependency.is_current
    and (
      (p_artifact_type = 'cover'
        and dependency.artifact_type = 'story_image')
      or (p_artifact_type = 'pdf'
        and dependency.artifact_type in ('cover', 'story_image', 'video_final'))
      or (p_artifact_type = 'social_asset'
        and dependency.artifact_type in ('cover', 'story_image'))
      or (p_artifact_type = 'video_manifest'
        and dependency.artifact_type in ('video_script', 'story_image'))
      or (p_artifact_type in (
          'video_preview',
          'video_final',
          'heygen_preview',
          'graphics_preview'
        )
        and dependency.artifact_type in (
          'video_script',
          'video_manifest',
          'story_image'
        ))
      or (p_artifact_type in ('captions', 'thumbnail')
        and dependency.artifact_type in (
          'video_script',
          'video_manifest',
          'video_final'
        ))
    );

  v_payload := jsonb_build_object(
    'schema', 'weekly-artifact-input-v2',
    'artifact_type', p_artifact_type,
    'locale', p_locale,
    'revision_item', v_item,
    'dependencies', v_dependencies
  );

  if p_artifact_type in ('story_image', 'story_prompt_set') then
    v_payload := v_payload || jsonb_build_object('item', v_item);
  elsif p_artifact_type in ('article', 'pdf', 'captions') then
    v_payload := v_payload || jsonb_build_object(
      'title', case when p_locale = 'uk' then v_revision.title_uk else v_revision.title_en end,
      'intro', case when p_locale = 'uk' then v_revision.intro_uk else v_revision.intro_en end,
      'editor_note', case
        when p_locale = 'uk' then v_revision.editor_note_uk
        else v_revision.editor_note_en
      end,
      'takeaways', case
        when p_locale = 'uk' then v_revision.key_takeaways_uk
        else v_revision.key_takeaways_en
      end,
      'items', v_items
    );
  elsif p_artifact_type in (
    'video_script',
    'video_manifest',
    'video_preview',
    'video_final',
    'heygen_preview',
    'graphics_preview'
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

  return md5(v_payload::text);
end;
$function$;

commit;
