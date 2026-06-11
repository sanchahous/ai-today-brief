-- ============================================================================
-- 029 — Null out generic hero images on brief_items (data cleanup)
-- ============================================================================
-- The enrich stage used to store any og:image it found; platform logos and
-- auto-generated cards (arXiv logo, GitHub opengraph repo cards) made articles
-- look like stock feeds. The pipeline now filters these at fetch time
-- (`isGenericOgImage` in pipeline/enrich.ts) — this migration cleans the rows
-- written before the filter existed. NULL image_url falls back to the branded
-- OG card (social) and category placeholders (site), both already shipped.
-- Custom repo banners (repository-images.githubusercontent.com) are kept.

UPDATE public.brief_items
SET image_url = NULL
WHERE image_url ~* '^https?://(static\.arxiv\.org|arxiv\.org/static|opengraph\.githubassets\.com|avatars\.githubusercontent\.com|github\.githubassets\.com|news\.ycombinator\.com|(www\.)?redditstatic\.com)/';
