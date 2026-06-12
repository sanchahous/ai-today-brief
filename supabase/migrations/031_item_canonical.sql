-- ============================================================================
-- 031 — Cross-day duplicate cleanup: canonical_item_id on brief_items
--
-- Before the semantic dedup went live (2026-06-05), the pipeline re-published
-- the same article on consecutive days — one story shipped 7 times between
-- 2026-05-26 and 2026-06-04. Near-duplicate pages dilute the site's quality
-- signal while Google is still deciding whether to crawl the long tail
-- ("Discovered – currently not indexed").
--
-- Later copies get canonical_item_id → the earliest copy of the same
-- article_id; the app 308-redirects them to the primary and drops them from
-- both sitemaps. New duplicates are prevented upstream (exact URL guard +
-- semantic dedup), so the backfill below is a one-time repair.
-- ============================================================================

begin;

alter table public.brief_items
  add column if not exists canonical_item_id uuid references public.brief_items(id) on delete set null;

comment on column public.brief_items.canonical_item_id is
  'Set on a later re-publication of the same story: points at the earliest item. The app permanently redirects to it and excludes this row from sitemaps.';

-- One-time repair: for every article_id used by more than one published item,
-- the earliest (by brief date, then rank) stays canonical, the rest point at it.
with pub as (
  select bi.id, bi.article_id, b.date, bi.rank
  from public.brief_items bi
  join public.briefs b on b.id = bi.brief_id
  where b.status = 'published' and bi.article_id is not null
),
ranked as (
  select id,
         row_number() over (partition by article_id order by date asc, rank asc, id asc) as rn,
         first_value(id) over (partition by article_id order by date asc, rank asc, id asc) as primary_id
  from pub
)
update public.brief_items bi
set canonical_item_id = r.primary_id
from ranked r
where bi.id = r.id and r.rn > 1;

commit;
