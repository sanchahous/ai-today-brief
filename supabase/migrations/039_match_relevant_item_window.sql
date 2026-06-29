-- ============================================================================
-- 039 — Bound semantic dedup to a recency window
--
-- 026's match_relevant_item compares a candidate against EVERY published
-- brief_item ever (plus today's pack). As the archive grows the 768-dim vector
-- space saturates: in this narrow AI/dev niche almost every fresh item lands
-- within cosine 0.12–0.20 of *something* already published, so the dedup's
-- false-positive rate climbs over time and would force MAX_EMBED_DISTANCE ever
-- lower. A week of prod logs showed the old 0.20 ceiling already auto-dropping
-- ~89% genuinely-new stories (distinct tools, models, events).
--
-- Fix: only dedup against items published in the last `recency_days` (default
-- 30) — long enough to catch a story that resurfaces across days/weeks, but
-- bounded so the comparison set never grows without limit (the saturation cause).
-- Today's pack stays UNBOUNDED (a story the editor rejected this morning must not
-- return this afternoon). The exact-URL guard (dropKnownUrls, 30 days) still
-- blocks literal re-posts beyond the window.
--
-- recency_days has a DEFAULT so the existing 3-arg caller (pipeline/db.ts
-- matchRelevantItem) keeps resolving to this function unchanged, before and after
-- this migration — no deploy-ordering hazard. Pass a 4th arg to override.
-- ============================================================================

begin;

-- Replace the 3-arg signature with a 4-arg one (added param ⇒ Postgres treats it
-- as a new overload, so drop the old to avoid an ambiguous resolution).
drop function if exists public.match_relevant_item(extensions.vector(768), double precision, date);

create or replace function public.match_relevant_item(
  query_embedding extensions.vector(768),
  max_distance    double precision,
  same_day        date,
  recency_days    integer default 30
)
returns table (brief_item_id uuid, distance double precision)
language sql stable
set search_path = public, extensions
as $$
  select bie.brief_item_id,
         (bie.embedding <=> query_embedding) as distance
  from   public.brief_item_embeddings bie
  join   public.brief_items            bi  on bi.id    = bie.brief_item_id
  join   public.briefs                 b   on b.id     = bi.brief_id
  where  (
           (b.status = 'published' and b.date >= same_day - recency_days)
           or b.date = same_day
         )
    and  (bie.embedding <=> query_embedding) <= max_distance
  order  by bie.embedding <=> query_embedding
  limit  1;
$$;

commit;
