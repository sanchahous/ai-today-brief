-- Polish pass on /news:
--   1) Sort selector — Relevance / Newest / Oldest. Default = relevance
--      when q is non-empty, otherwise newest.
--   2) Facet counts — how many items match each category under the
--      current (q + date range) filter, so the sidebar can render
--      "Tools & releases (12)" next to every checkbox.
--
-- Both are additive to search_brief_items + a new RPC. The previous
-- search RPC stays compatible: the new sort parameter has a default.

-- ── search_brief_items: add sort ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.search_brief_items(text, text, text[], date, date, int, int);

CREATE OR REPLACE FUNCTION public.search_brief_items(
  p_query        text,
  p_lang         text DEFAULT 'en',
  p_categories   text[] DEFAULT NULL,
  p_from_date    date   DEFAULT NULL,
  p_to_date      date   DEFAULT NULL,
  p_sort         text   DEFAULT 'auto',  -- 'auto' | 'relevance' | 'newest' | 'oldest'
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
  brief_slug     text,
  source_name    text,
  rank_score     real,
  total_count    bigint
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  q tsquery;
  ts_config regconfig;
  cleaned   text;
  sort_mode text;
BEGIN
  ts_config := CASE WHEN p_lang = 'uk' THEN 'simple'::regconfig
                                       ELSE 'english'::regconfig END;

  cleaned := lower(trim(coalesce(p_query, '')));
  cleaned := regexp_replace(cleaned, '[^a-zа-яії0-9\s\-]', ' ', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  IF cleaned = '' THEN
    q := NULL;
  ELSE
    q := (
      SELECT to_tsquery(ts_config, string_agg(word || ':*', ' & '))
      FROM (SELECT word FROM regexp_split_to_table(cleaned, ' ') AS word
            WHERE length(word) > 0) tokens
    );
  END IF;

  -- "auto" = relevance when q present, newest otherwise — the conventional
  -- search-engine default. Explicit values from the client win.
  sort_mode := CASE
    WHEN p_sort IN ('relevance', 'newest', 'oldest') THEN p_sort
    WHEN q IS NULL THEN 'newest'
    ELSE 'relevance'
  END;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      bi.*,
      b.date AS brief_date,
      b.slug AS brief_slug,
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
    f.brief_date, f.brief_slug, f.source_name, f.rank_score,
    c.total
  FROM filtered f, counted c
  ORDER BY
    CASE WHEN sort_mode = 'relevance' THEN f.rank_score ELSE 0 END DESC,
    CASE WHEN sort_mode = 'oldest'    THEN f.brief_date END ASC,
    CASE WHEN sort_mode IN ('newest', 'relevance') THEN f.brief_date END DESC,
    f.rank ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.search_brief_items(text, text, text[], date, date, text, int, int)
  TO anon, authenticated;

-- ── search_facets: per-category counts ───────────────────────────────────
-- Sidebar counts must reflect the OTHER filters (q + date range) but NOT
-- the category filter itself — that's the conventional faceted-search
-- behaviour (Algolia, GitHub Search). Categories that have no matches
-- under the current q/date are omitted from the result so the client can
-- decide whether to dim them or hide them.

CREATE OR REPLACE FUNCTION public.search_facets(
  p_query     text,
  p_lang      text DEFAULT 'en',
  p_from_date date DEFAULT NULL,
  p_to_date   date DEFAULT NULL
)
RETURNS TABLE (
  category_slug text,
  count         bigint
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  q tsquery;
  ts_config regconfig;
  cleaned   text;
BEGIN
  ts_config := CASE WHEN p_lang = 'uk' THEN 'simple'::regconfig
                                       ELSE 'english'::regconfig END;

  cleaned := lower(trim(coalesce(p_query, '')));
  cleaned := regexp_replace(cleaned, '[^a-zа-яії0-9\s\-]', ' ', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  IF cleaned = '' THEN
    q := NULL;
  ELSE
    q := (
      SELECT to_tsquery(ts_config, string_agg(word || ':*', ' & '))
      FROM (SELECT word FROM regexp_split_to_table(cleaned, ' ') AS word
            WHERE length(word) > 0) tokens
    );
  END IF;

  RETURN QUERY
  SELECT
    bi.category_slug,
    COUNT(*) AS count
  FROM public.brief_items bi
  JOIN public.briefs b ON b.id = bi.brief_id
  WHERE b.status = 'published'
    AND bi.category_slug IS NOT NULL
    AND (
      q IS NULL
      OR (p_lang = 'uk' AND bi.search_tsv_uk @@ q)
      OR (p_lang <> 'uk' AND bi.search_tsv_en @@ q)
    )
    AND (p_from_date IS NULL OR b.date >= p_from_date)
    AND (p_to_date   IS NULL OR b.date <= p_to_date)
  GROUP BY bi.category_slug
  ORDER BY count DESC;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.search_facets(text, text, date, date)
  TO anon, authenticated;
