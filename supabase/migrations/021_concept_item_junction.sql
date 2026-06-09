-- ============================================================================
-- 021 — Junction table: brief_item_concepts
--
-- Replaces unreliable full-text search for concept hub pages with a direct
-- many-to-many relationship. Concept pages can now reliably list all items
-- that mention a concept regardless of FTS tokenisation quirks.
--
-- Pipeline and backfill resolve brief_items.tools_mentioned against
-- concepts.name_en / name_uk / aliases to populate this table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brief_item_concepts (
  item_id       uuid   NOT NULL REFERENCES public.brief_items(id) ON DELETE CASCADE,
  concept_slug  text   NOT NULL REFERENCES public.concepts(slug) ON DELETE CASCADE,
  PRIMARY KEY (item_id, concept_slug)
);

CREATE INDEX IF NOT EXISTS bic_concept_slug_idx
  ON public.brief_item_concepts (concept_slug);

ALTER TABLE public.brief_item_concepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bic_public_read" ON public.brief_item_concepts;
CREATE POLICY "bic_public_read"
  ON public.brief_item_concepts
  FOR SELECT
  USING (true);

-- ============================================================================
-- Backfill: resolve existing tools_mentioned into the junction table.
-- Each brief_item.tools_mentioned is JSONB — either an array of strings or
-- an array of objects with a "name" field. We normalise both forms, match
-- against concepts by lower-cased name_en, name_uk, or any alias, and insert.
-- ============================================================================

INSERT INTO public.brief_item_concepts (item_id, concept_slug)
SELECT DISTINCT bi.id, c.slug
FROM public.brief_items bi
CROSS JOIN LATERAL (
  SELECT lower(trim(elem::text, '"')) AS tool_name
  FROM jsonb_array_elements(
    CASE jsonb_typeof(bi.tools_mentioned)
      WHEN 'array' THEN bi.tools_mentioned
      ELSE '[]'::jsonb
    END
  ) AS elem
  WHERE jsonb_typeof(elem) = 'string'
  UNION ALL
  SELECT lower(trim((elem ->> 'name')::text))
  FROM jsonb_array_elements(
    CASE jsonb_typeof(bi.tools_mentioned)
      WHEN 'array' THEN bi.tools_mentioned
      ELSE '[]'::jsonb
    END
  ) AS elem
  WHERE jsonb_typeof(elem) = 'object' AND elem ? 'name'
) AS tool_names
JOIN public.concepts c ON (
  lower(c.name_en) = tool_names.tool_name
  OR lower(c.name_uk) = tool_names.tool_name
  OR tool_names.tool_name = ANY (c.aliases)
)
WHERE bi.tools_mentioned IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RPC: get_concept_items — returns brief items for a concept hub page.
-- Used instead of FTS for reliable concept-to-items linking.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_concept_items(
  p_concept_slug text,
  p_lang         text DEFAULT 'en',
  p_limit        int  DEFAULT 80
)
RETURNS TABLE (
  id             uuid,
  rank           int,
  slug           text,
  category_slug  text,
  title_en       text,
  title_uk       text,
  summary_en     text,
  summary_uk     text,
  why_en         text,
  why_uk         text,
  has_video      boolean,
  tools_mentioned jsonb,
  brief_slug     text,
  brief_date     date,
  source_name    text
)
LANGUAGE sql STABLE
AS $func$
  SELECT
    bi.id, bi.rank, bi.slug, bi.category_slug,
    bi.title_en, bi.title_uk,
    bi.summary_en, bi.summary_uk,
    bi.why_matters_en, bi.why_matters_uk,
    (bi.youtube_url IS NOT NULL) AS has_video,
    bi.tools_mentioned,
    b.slug AS brief_slug,
    b.date AS brief_date,
    a.source_name
  FROM public.brief_item_concepts bic
  JOIN public.brief_items bi ON bi.id = bic.item_id
  JOIN public.briefs b        ON b.id = bi.brief_id
  JOIN public.articles a      ON a.id = bi.article_id
  WHERE bic.concept_slug = p_concept_slug
    AND b.status = 'published'
  ORDER BY b.date DESC, bi.rank ASC
  LIMIT p_limit;
$func$;
