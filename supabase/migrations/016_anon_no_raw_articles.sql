-- RLS audit (07a §5): raw ingest is pipeline-only; public reads published brief_items.
drop policy if exists "public_read_articles" on public.articles;
