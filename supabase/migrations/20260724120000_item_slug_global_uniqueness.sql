-- Item URLs move from pack-scoped nesting (/:lang/:packSlug/:itemSlug) to
-- category-scoped nesting (/:lang/news/:categorySlug/:itemSlug) — see the
-- 2026-07-24 URL/breadcrumb audit. The new route looks an item up by its own
-- slug alone (globally), then verifies the category segment, so the slug of
-- every *canonical* item (canonical_item_id IS NULL — the one row that
-- actually renders at its slug; re-publications redirect to it) must be
-- unique across the whole table, not just within one brief/pack.
--
-- Scoped to canonical_item_id IS NULL rather than a bare `slug` unique index:
-- 7 pre-2026-06-12 rows (before cross-day dedup existed) share a slug with
-- their own canonical primary under canonical_item_id, e.g. 3 old copies of
-- "codegraph-slashes-agent-tool-calls" alongside the 1 real primary. Checked
-- before writing this migration: 0 collisions among canonical rows (369
-- published items), so the swap is a no-op there. Going forward,
-- pipeline/db.ts's syncBriefItemsUpsert qualifies any new slug that would
-- collide with an existing canonical row, mirroring resolveBriefSlug's
-- pattern — re-publications keep sharing slugs freely, same as before.
DROP INDEX IF EXISTS public.brief_items_brief_slug_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS brief_items_slug_uniq
  ON public.brief_items (slug)
  WHERE slug IS NOT NULL AND canonical_item_id IS NULL;
