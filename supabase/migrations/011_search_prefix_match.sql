-- Fixes "claud" -> "claude" partial match in /news search.
--
-- The previous version used websearch_to_tsquery which doesn't add the
-- prefix-marker `:*` automatically — so users typing "claud" got zero
-- matches against the lexeme "claude". We now build the tsquery manually:
-- every token is suffixed with ":*" and joined with " & ". A literal
-- empty query falls through to the no-filter path so category/date
-- filters keep working without a text query.

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
AS $func$
DECLARE
  q tsquery;
  ts_config regconfig;
  cleaned   text;
BEGIN
  -- Pick stemming config by locale. Supabase ships english out of the
  -- box; Ukrainian uses 'simple' which means token boundaries only,
  -- which is fine because most useful tokens (tool names) are English.
  ts_config := CASE WHEN p_lang = 'uk' THEN 'simple'::regconfig
                                       ELSE 'english'::regconfig END;

  -- Sanitise + tokenise: collapse whitespace, drop characters that would
  -- explode to_tsquery (we don't expose the parser to user input), then
  -- append ':*' to every token so a query for "claud cur" matches
  -- "claude" + "cursor" via prefix.
  cleaned := lower(trim(coalesce(p_query, '')));
  cleaned := regexp_replace(cleaned, '[^a-zа-яії0-9\\s\\-]', ' ', 'g');
  cleaned := regexp_replace(cleaned, '\\s+', ' ', 'g');

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
    f.rank_score DESC,
    f.brief_date DESC,
    f.rank ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$func$;
