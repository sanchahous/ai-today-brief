-- ============================================================================
-- 032 — Per-article ranking telemetry (the weight-tuning dataset)
--
-- Today the pipeline persists only `composite_score` + `mentions_count`, and only
-- for the lead url of each cluster, and only on publish runs — so the score lands
-- on ~8% of fetched articles, the six component signals are thrown away, and the
-- stored scores are a mix of the old un-normalized scale (values > 1) and the new
-- normalized [0,1] one. That is not a dataset you can calibrate weights against.
--
-- This adds the full breakdown so EVERY ranked article (every cluster member, every
-- run) can carry its six components + a formula version + a stable cluster id +
-- the timestamp it was scored as-of. `score_version` keeps mixed code generations
-- separable (v1 = pre-normalization, excluded from training; v2 = normalized).
-- `scored_as_of` is required for a faithful historical backfill: recency/velocity
-- must be computed as-of fetch time, not now(), or every old row collapses to
-- recency ≈ 0.
--
-- Write-only telemetry: no RLS/policy change, no app read path. Columns are
-- nullable so existing rows and the backfill coexist.
-- ============================================================================

begin;

alter table public.articles
  add column if not exists score_velocity     numeric,
  add column if not exists score_cross_source numeric,
  add column if not exists score_authority    numeric,
  add column if not exists score_recency      numeric,
  add column if not exists score_inbrief      numeric,
  add column if not exists score_breadth      numeric,
  add column if not exists score_version      smallint,
  add column if not exists cluster_id         text,
  add column if not exists scored_as_of       timestamptz;

comment on column public.articles.score_version is
  'Rank-formula generation (pipeline rank.ts SCORE_VERSION). v1 = pre-normalization (scores can exceed 1; exclude from training); v2 = normalized [0,1].';
comment on column public.articles.cluster_id is
  'Stable id (sha1 of the cluster''s sorted member urls) so non-lead members of the same same-event cluster share one group key.';
comment on column public.articles.scored_as_of is
  'Timestamp the score was computed as-of (run time live; the article''s fetched_at on a historical backfill) — recency/velocity are relative to this.';

-- Index for "all rows scored under the current formula" reads (backtests, monitoring).
create index if not exists idx_articles_score_version on public.articles(score_version);

commit;
