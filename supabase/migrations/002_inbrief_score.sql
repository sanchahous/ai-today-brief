-- =========================================================
-- ai-news-scrapper: add inbrief_score column
-- =========================================================
-- InBrief editorial importance score (0–100).
-- Fetched from InBrief's Supabase RPC (get_archive_articles).

alter table articles add column if not exists inbrief_score int;

create index if not exists articles_inbrief_score_idx on articles (inbrief_score desc);
