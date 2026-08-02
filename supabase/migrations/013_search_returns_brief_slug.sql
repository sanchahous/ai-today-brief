-- After the brief-slug migration, /news rows need to link to /:lang/:slug
-- — not /:lang/:date. Cheapest fix: extend the search RPC return type to
-- include the slug so the client doesn't need a second round-trip.
--
-- Keeps every other behaviour from 011_search_prefix_match.sql identical.

-- PostgreSQL cannot replace a function when its OUT row type changes.
-- Drop the previous signature first so the full migration chain can be
-- replayed against a fresh staging database.
DROP FUNCTION IF EXISTS public.search_brief_items(text, text, text[], date, date, int, int);

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
      SELECT to_tsquery(
        ts_config,
        string_agg(word || ':*', ' & ')
      )
      FROM (
        SELECT word
        FROM regexp_split_to_table(cleaned, ' ') AS word
        WHERE length(word) > 0
      ) tokens
    );
  END IF;

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
    f.rank_score DESC,
    f.brief_date DESC,
    f.rank ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$func$;
