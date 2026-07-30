-- ============================================================================
-- 20260730110000 — Revert the retroactive dedup-scan job
--
-- Owner call: cleaning up already-published near-duplicates after the fact
-- (delete or 308-redirect) is the wrong place to fight this — it's safer and
-- simpler to just tighten the EXISTING pre-publish gate (pipeline/config.ts
-- `maxEmbedDistance` + `match_relevant_item`, 026/039) so fewer duplicates
-- get published in the first place. The dedup-scan job (20260730100000) is
-- removed; its RPC is dropped and `pipeline_runs.stage` no longer allows
-- `dedup_scan`.
--
-- NOT reverted (still correct, independent of the dedup-scan job):
--   - `canonical_item_id` itself (031) and the `redone` item_reviews action
--     (20260730100000) — the redo-audit fix is unrelated to dedup-scan.
--   - 20260730100500's public-read fixes (search_brief_items/search_facets/
--     get_concept_items excluding canonical_item_id, search_facets' missing
--     review_status='approved' filter) — legitimate correctness fixes for
--     031's original one-time backfill data, regardless of whether anything
--     writes new canonical_item_id values going forward.
-- ============================================================================

begin;

drop function if exists public.find_duplicate_item_pairs(double precision, integer, integer, integer);

alter table public.pipeline_runs
  drop constraint if exists pipeline_runs_stage_check;

alter table public.pipeline_runs
  add constraint pipeline_runs_stage_check
  check (stage in (
    'fetch', 'rank', 'summarize', 'publish', 'dedup', 'enrich', 'verify',
    'auto_publish'
  ));

commit;
