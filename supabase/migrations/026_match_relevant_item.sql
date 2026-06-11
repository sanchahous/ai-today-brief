-- ============================================================================
-- 026 — Intra-day semantic dedup: match_relevant_item RPC
--
-- match_published_item (020) only looks at published briefs, so the six daily
-- progóns could re-propose a story already sitting in today's draft pack — or
-- one the editor explicitly rejected this morning. This variant matches
-- against published items (any day) PLUS everything in today's packs
-- regardless of brief status or review_status. The pipeline calls this one;
-- match_published_item is kept for back-compat.
--
-- Editorial semantics: ❌ reject keeps the row (and its embedding), so the
-- story stays suppressed for the day BY DESIGN. When only the rendition is bad
-- (e.g. garbled Ukrainian), the reviewer uses 🔁 redo instead — it deletes the
-- pending row, the embedding cascades away (020), and the next progón
-- re-proposes the story fresh.
-- ============================================================================

begin;

create or replace function public.match_relevant_item(
  query_embedding extensions.vector(768),
  max_distance    double precision,
  same_day        date
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
  where  (b.status = 'published' or b.date = same_day)
    and  (bie.embedding <=> query_embedding) <= max_distance
  order  by bie.embedding <=> query_embedding
  limit  1;
$$;

commit;
