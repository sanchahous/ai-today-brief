-- Phase 3 of the SEO closure: prepare every brief item for cross-posting
-- to X / LinkedIn / a future YouTube channel. The pipeline generates the
-- copy at the same time as the deep_dive so we never have to write it by
-- hand — and once the YouTube channel exists, video descriptions can link
-- back to the canonical /:date/:slug page on our domain (reverse SEO).
--
-- All columns nullable so legacy briefs still render. New summarize runs
-- populate every field.

ALTER TABLE public.brief_items
  -- Punchy 200-220 char one-liner ready to paste into X. The leading line
  -- of the LinkedIn / Threads post too.
  ADD COLUMN IF NOT EXISTS social_hook_en  text,
  ADD COLUMN IF NOT EXISTS social_hook_uk  text,
  -- Short-form video script structured as { hook, context, insight,
  -- takeaway } — ~60-90 seconds total. JSONB so we can evolve the shape
  -- without another migration.
  ADD COLUMN IF NOT EXISTS video_script_en jsonb,
  ADD COLUMN IF NOT EXISTS video_script_uk jsonb,
  -- Set manually after a video lands on YouTube. Renders a "Watch on
  -- YouTube" button on the item page and feeds VideoObject schema.
  ADD COLUMN IF NOT EXISTS youtube_url     text;
