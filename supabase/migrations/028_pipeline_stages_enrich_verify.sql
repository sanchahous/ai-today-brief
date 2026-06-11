-- ============================================================================
-- 028 — pipeline_runs: allow the new 'enrich' and 'verify' stages (Phase 1)
-- ============================================================================

begin;

alter table public.pipeline_runs
  drop constraint if exists pipeline_runs_stage_check;

alter table public.pipeline_runs
  add constraint pipeline_runs_stage_check
  check (stage in ('fetch', 'rank', 'summarize', 'publish', 'dedup', 'enrich', 'verify'));

commit;
