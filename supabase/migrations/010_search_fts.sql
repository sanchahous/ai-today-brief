-- Full-text search over brief items, separately for the EN and UK
-- locales. Two generated tsvector columns is the cheapest viable design:
-- no triggers to maintain, no manual reindex on backfill, and the
-- combined GIN index size for ~thousands of rows is negligible.
--
-- We index title (weight A), summary (B), and deep_dive (C) so an exact
-- title match outranks a deep_dive mention. Ukrainian uses the `simple`
-- config because Supabase's default install doesn't ship a Ukrainian
-- stemmer — that's fine for our domain where the bulk of useful tokens
-- are English brand names anyway.
--
-- pg_trgm covers fuzzy autocomplete ("clud" → "Claude") on titles.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.brief_items
  ADD COLUMN IF NOT EXISTS search_tsv_en tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title_en, '')),      'A') ||
      setweight(to_tsvector('english', coalesce(summary_en, '')),    'B') ||
      setweight(to_tsvector('english', coalesce(deep_dive_en, '')),  'C')
    ) STORED,
  ADD COLUMN IF NOT EXISTS search_tsv_uk tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple',  coalesce(title_uk, '')),      'A') ||
      setweight(to_tsvector('simple',  coalesce(summary_uk, '')),    'B') ||
      setweight(to_tsvector('simple',  coalesce(deep_dive_uk, '')),  'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS brief_items_tsv_en_idx ON public.brief_items USING GIN (search_tsv_en);
CREATE INDEX IF NOT EXISTS brief_items_tsv_uk_idx ON public.brief_items USING GIN (search_tsv_uk);

-- Trigram index on translated titles for fuzzy autocomplete in the
-- dropdown — handles typos and partial matches better than tsquery.
CREATE INDEX IF NOT EXISTS brief_items_title_en_trgm ON public.brief_items USING GIN (title_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS brief_items_title_uk_trgm ON public.brief_items USING GIN (title_uk gin_trgm_ops);

-- ── Search RPC ────────────────────────────────────────────────────────────
-- Single entry-point the frontend calls. Returns ranked items joined with
-- their brief (for the date label) and article (for the source name).
-- Categories and date range stay as filters so /discover and the dropdown
-- share the same backend.

CREATE OR REPLACE FUNCTION public.search_brief_items(
  p_query        text,
  p_lang         text DEFAULT 'en',
  p_categories   text[] DEFAULT NULL,
  p_from_date    date   DEFAULT NULL,
  p_to_date      date   DEFAULT NULL,
  p_limit        int    DEFAULT 20,
  p_offset       int    DEFAULT 0
)
RETURNS TABLE (
  id             uuid,
  brief_id       uuid,
  rank           int,
  slug           text,
  category_slug  text,
  title_en       text,
  title_uk       text,
  summary_en     text,
  summary_uk     text,
  brief_date     date,
  source_name    text,
  rank_score     real,
  total_count    bigint
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  q tsquery;
BEGIN
  -- websearch_to_tsquery accepts free-form Google-style input
  -- ("claude cache", quoted phrases, OR). Empty string → match everything
  -- so category/date filters still work without a text query.
  q := CASE
    WHEN coalesce(p_query, '') = ''
      THEN NULL
    WHEN p_lang = 'uk'
      THEN websearch_to_tsquery('simple',  p_query)
      ELSE websearch_to_tsquery('english', p_query)
  END;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      bi.*,
      b.date AS brief_date,
      a.source_name,
      CASE
        WHEN q IS NULL THEN 0::real
        WHEN p_lang = 'uk' THEN ts_rank_cd(bi.search_tsv_uk, q)
        ELSE                    ts_rank_cd(bi.search_tsv_en, q)
      END AS rank_score
    FROM public.brief_items bi
    JOIN public.briefs b   ON b.id = bi.brief_id
    JOIN public.articles a ON a.id = bi.article_id
    WHERE b.status = 'published'
      AND (
        q IS NULL
        OR (p_lang = 'uk' AND bi.search_tsv_uk @@ q)
        OR (p_lang <> 'uk' AND bi.search_tsv_en @@ q)
      )
      AND (p_categories IS NULL OR bi.category_slug = ANY (p_categories))
      AND (p_from_date  IS NULL OR b.date >= p_from_date)
      AND (p_to_date    IS NULL OR b.date <= p_to_date)
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered
  )
  SELECT
    f.id, f.brief_id, f.rank, f.slug, f.category_slug,
    f.title_en, f.title_uk, f.summary_en, f.summary_uk,
    f.brief_date, f.source_name, f.rank_score,
    c.total
  FROM filtered f, counted c
  ORDER BY
    -- text matches sort by relevance; recency breaks ties and also
    -- governs the no-query case (browse-by-filter).
    f.rank_score DESC,
    f.brief_date DESC,
    f.rank ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- Make the RPC reachable from the anon client (matches the read-only
-- pattern already used by the other public-read tables).
GRANT EXECUTE ON FUNCTION public.search_brief_items(text, text, text[], date, date, int, int)
  TO anon, authenticated;
