-- Phase 1 of "close the SEO loop on our own domain":
-- each brief_item gets a stable slug and a long-form deep_dive plus
-- structured takeaways and a tools_mentioned list. The UI uses these to
-- render a full /brief/:date/:slug page so users never need to leave the
-- domain to read the story.
--
-- All columns are nullable so legacy briefs (created before this migration)
-- keep rendering with the existing summary fields as a fallback. New runs of
-- the summarize stage populate every field.

ALTER TABLE public.brief_items
  ADD COLUMN IF NOT EXISTS slug             text,
  ADD COLUMN IF NOT EXISTS deep_dive_en     text,
  ADD COLUMN IF NOT EXISTS deep_dive_uk     text,
  ADD COLUMN IF NOT EXISTS takeaways_en     jsonb,
  ADD COLUMN IF NOT EXISTS takeaways_uk     jsonb,
  ADD COLUMN IF NOT EXISTS tools_mentioned  jsonb;

-- Unique slug per brief — multiple briefs may share a slug across dates
-- (e.g. "cursor-2-0-update" can appear on different days) but within a
-- single brief each item must be addressable by a distinct URL segment.
-- Partial index ignores legacy rows where slug is still NULL.
CREATE UNIQUE INDEX IF NOT EXISTS brief_items_brief_slug_uniq
  ON public.brief_items (brief_id, slug)
  WHERE slug IS NOT NULL;
