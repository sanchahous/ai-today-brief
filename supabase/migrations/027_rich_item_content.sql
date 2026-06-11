-- ============================================================================
-- 027 — Rich item content (Phase 1: enrich → summarize v2 → verify)
--
-- The summarizer now reads the FULL source text (enrich stage), so items can
-- carry a structured value stack instead of a thin headline rewrite:
--   body_md_*            markdown body with ### subheadings (renders Phase 2)
--   facts_*              [{label, value}] — prices, limits, dates, benchmarks
--   code_snippet         {language, code} — "try it in 2 minutes"
--   when_to_use_* /
--   when_not_to_use_*    string[] — honest applicability bullets
--   community_reactions  [{author, quote, url}] — top HN voices (EN originals)
--   citations            [{title, url, source_name}] — primary sources block
--   image_url            og:image of the source article (hero, Phase 2)
--   editor_take          human verdict added via Telegram — never generated
--
-- All nullable: items of different calibre fill different subsets, and the
-- frontend renders blocks conditionally. deep_dive_* stays for back-compat.
-- anon visibility inherits the existing brief_items RLS policies.
-- ============================================================================

begin;

alter table public.brief_items
  add column if not exists body_md_en          text,
  add column if not exists body_md_uk          text,
  add column if not exists facts_en            jsonb,
  add column if not exists facts_uk            jsonb,
  add column if not exists code_snippet        jsonb,
  add column if not exists when_to_use_en      jsonb,
  add column if not exists when_to_use_uk      jsonb,
  add column if not exists when_not_to_use_en  jsonb,
  add column if not exists when_not_to_use_uk  jsonb,
  add column if not exists community_reactions jsonb,
  add column if not exists citations           jsonb,
  add column if not exists image_url           text,
  add column if not exists editor_take         text;

commit;
