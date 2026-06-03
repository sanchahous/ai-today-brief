-- Add translated headlines per brief item so the UI can show a Ukrainian
-- title in the UK locale (previously only article.title was rendered, which
-- is always the original English source title).
--
-- summarize.ts will populate these for each top-10 article in the daily run.
-- Both columns are nullable: legacy rows keep showing article.title as fallback.

ALTER TABLE public.brief_items
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_uk text;
