-- search_brief_items joins articles for source_name; 016 revoked anon SELECT on articles.
-- Run search RPCs as definer with a fixed search_path (published brief_items only).

ALTER FUNCTION public.search_brief_items(text, text, text[], date, date, text, int, int)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

ALTER FUNCTION public.search_facets(text, text, date, date)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
