-- ============================================================================
-- 023 — get_concept_items: SECURITY DEFINER + approved-only public filter
--
-- 016 revoked anon SELECT on articles; get_concept_items joins articles for
-- source_name as SECURITY INVOKER, so anon callers saw zero rows on concept
-- hubs despite a populated brief_item_concepts junction table.
-- Mirror search_brief_items (017/019): definer + published + approved only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_concept_items(
  p_concept_slug text,
  p_lang         text DEFAULT 'en',
  p_limit        int  DEFAULT 80
)
RETURNS TABLE (
  id              uuid,
  rank            int,
  slug            text,
  category_slug   text,
  title_en        text,
  title_uk        text,
  summary_en      text,
  summary_uk      text,
  why_en          text,
  why_uk          text,
  has_video       boolean,
  tools_mentioned jsonb,
  brief_slug      text,
  brief_date      date,
  source_name     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
  SELECT
    bi.id,
    bi.rank,
    bi.slug,
    bi.category_slug,
    bi.title_en,
    bi.title_uk,
    bi.summary_en,
    bi.summary_uk,
    bi.why_matters_en,
    bi.why_matters_uk,
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
    AND bi.review_status = 'approved'
  ORDER BY b.date DESC, bi.rank ASC
  LIMIT p_limit;
$func$;

GRANT EXECUTE ON FUNCTION public.get_concept_items(text, text, int)
  TO anon, authenticated;
