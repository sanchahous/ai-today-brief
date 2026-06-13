-- ============================================================================
-- 033 — External entity trend signals (the standing "rising index")
--
-- The pipeline can't reconstruct its own engagement time-series (articles.url is
-- unique → one snapshot per story), so trend acceleration is sourced externally.
-- GDELT DOC 2.0 timelinevol gives a free, historical per-entity news-volume
-- timeline; the daily job turns its trailing trend into a [0,1] rising_score
-- (tempered by a lifecycle prior) and appends a row here. Append-only: the series
-- accumulates so we start owning our own history from day one.
--
-- Service-role writes only (the pipeline). RLS on, no anon policy.
-- ============================================================================

begin;

create table if not exists public.entity_trend_signals (
  id           uuid primary key default gen_random_uuid(),
  entity       text not null,
  source       text not null default 'gdelt',
  captured_at  timestamptz not null default now(),
  window_span  text,
  rising_score numeric,
  raw          jsonb
);

create index if not exists idx_entity_trend_signals_entity_time
  on public.entity_trend_signals(entity, captured_at);

comment on table public.entity_trend_signals is
  'Append-only external rising-index per entity (GDELT news-volume trend → [0,1] rising_score, tempered by a lifecycle prior). Substitutes for the unreconstructable own engagement time-series; feeds the trend-index.';

alter table public.entity_trend_signals enable row level security;

commit;
