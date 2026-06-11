-- ============================================================================
-- 025 — Normalize article source names (one-time data fix)
--
-- InBrief passes upstream feed labels through verbatim, so the same outlet is
-- stored under several spellings ("HackerNews" vs "Hacker News", "x.com" vs
-- "X.com"). rank.ts SOURCE_TRUST and the site's source facets match on the
-- name, so variants fragment trust scoring and filter counts. The pipeline now
-- canonicalizes at the fetch boundary (pipeline/source-names.ts); this fixes
-- the rows written before that change. Keep the alias list in sync with
-- CANONICAL_BY_ALIAS there.
-- ============================================================================

begin;

update public.articles set source_name = 'Hacker News'
  where source_name = 'HackerNews';

update public.articles set source_name = 'X (Twitter)'
  where source_name in ('x.com', 'X.com', 'Twitter', 'twitter.com');

update public.articles set source_name = 'YouTube'
  where source_name in ('Youtube', 'youtube.com');

update public.articles set source_name = 'GitHub'
  where source_name in ('Github', 'github.com');

update public.articles set source_name = 'NVIDIA Blog'
  where source_name in ('Nvidia Blog', 'NVIDIA', 'Nvidia');

update public.articles set source_name = 'Hugging Face Blog'
  where source_name in ('HuggingFace', 'Hugging Face');

update public.articles set source_name = 'The Verge'
  where source_name in ('TheVerge AI', 'The Verge AI');

update public.articles set source_name = 'TechCrunch'
  where source_name = 'TechCrunch AI';

update public.articles set source_name = 'VentureBeat'
  where source_name = 'VentureBeat AI';

update public.articles set source_name = 'MIT Technology Review'
  where source_name in ('TechReview', 'MIT Tech Review AI');

update public.articles set source_name = 'DeepMind Blog'
  where source_name = 'Google Deepmind Blog';

update public.articles set source_name = 'AI News'
  where source_name = 'artificialintelligence-news.com';

commit;
