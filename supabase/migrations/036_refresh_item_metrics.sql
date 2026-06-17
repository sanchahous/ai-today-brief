-- ============================================================================
-- 036 — refresh_item_metrics(): roll item_events up into item_metrics
--
-- Recomputes the per-item engagement rollup from the raw append-only item_events:
-- human ua_class only, keyed on brief_item_id (events that carry only a slug are
-- not rolled up — the client sends the id for published items). Idempotent;
-- recomputes the whole table each call. Called on a schedule by the daily
-- pipeline (a step in .github/workflows/pipeline.yml — no separate cron).
--
-- SECURITY INVOKER (default): only the service role (pipeline) calls it; execute
-- is revoked from anon/authenticated so it is not exposed via the REST API.
-- ============================================================================

begin;

create or replace function public.refresh_item_metrics()
returns void
language sql
as $$
  insert into public.item_metrics as m (
    brief_item_id, views, expands, scroll50, scroll90,
    saves, outbound, shares, dwell_ms_p50, updated_at
  )
  select
    e.brief_item_id,
    count(*) filter (where e.event_type = 'view'),
    count(*) filter (where e.event_type = 'post_expand'),
    count(*) filter (where e.event_type = 'scroll_50'),
    count(*) filter (where e.event_type = 'scroll_90'),
    count(*) filter (where e.event_type = 'save_toggle' and e.value = 1),
    count(*) filter (where e.event_type = 'outbound_click'),
    count(*) filter (where e.event_type = 'share'),
    (percentile_disc(0.5) within group (order by e.value)
       filter (where e.event_type = 'dwell' and e.value is not null))::int,
    now()
  from public.item_events e
  where e.brief_item_id is not null
    and e.ua_class = 'human'
  group by e.brief_item_id
  on conflict (brief_item_id) do update set
    views        = excluded.views,
    expands      = excluded.expands,
    scroll50     = excluded.scroll50,
    scroll90     = excluded.scroll90,
    saves        = excluded.saves,
    outbound     = excluded.outbound,
    shares       = excluded.shares,
    dwell_ms_p50 = excluded.dwell_ms_p50,
    updated_at   = now();
$$;

revoke execute on function public.refresh_item_metrics() from anon, authenticated;

commit;
