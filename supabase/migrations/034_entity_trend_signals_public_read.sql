-- ============================================================================
-- 034 — Public read on entity_trend_signals (trend-index v0)
--
-- The homepage "Trending topics" block re-ranks topics by the GDELT rising
-- signal (the trend-index). It reads via the anon client, so the append-only
-- signal rows need an anon SELECT policy. The data is non-sensitive — a public
-- per-entity news-volume trend score; only the pipeline (service role) writes.
-- ============================================================================

begin;

drop policy if exists "entity_trend_signals public read" on public.entity_trend_signals;
create policy "entity_trend_signals public read"
  on public.entity_trend_signals
  for select
  to anon, authenticated
  using (true);

commit;
