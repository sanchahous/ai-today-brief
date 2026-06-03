-- Categories are the navigation backbone for the upcoming /discover page
-- and sidebar filters. One canonical category per brief item — keep the
-- mental model simple. tools_mentioned remains as secondary tags.
--
-- Why a separate table rather than a CHECK constraint: future migrations
-- will likely add colours, descriptions and translated names without
-- another ALTER. Concept hub pages will eventually grow a category
-- pointer too.

CREATE TABLE IF NOT EXISTS public.categories (
  slug            text PRIMARY KEY,
  name_en         text NOT NULL,
  name_uk         text NOT NULL,
  description_en  text,
  description_uk  text,
  -- Hex colour for the badge — kept here so the UI doesn't carry a
  -- hardcoded map and so future additions don't require frontend code.
  color           text,
  -- Display sort order. Lower = earlier in lists.
  position        integer NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read"
  ON public.categories
  FOR SELECT
  USING (true);

-- Add the FK column to brief_items. Nullable so legacy rows still render;
-- summarize.ts populates it for every new item.
ALTER TABLE public.brief_items
  ADD COLUMN IF NOT EXISTS category_slug text REFERENCES public.categories(slug)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- Index for /discover filter queries: WHERE category_slug = $1 ORDER BY date DESC.
CREATE INDEX IF NOT EXISTS brief_items_category_idx
  ON public.brief_items (category_slug);
