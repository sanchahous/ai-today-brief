-- ============================================================================
-- 037 — harden refresh_item_metrics(): pin search_path (clears advisor 0011)
--
-- 036 created refresh_item_metrics() without an explicit search_path, which the
-- Supabase linter flags as `function_search_path_mutable` (0011): a function
-- with a role-mutable search_path can resolve unqualified object names against a
-- caller-controlled path. The body already fully schema-qualifies every object
-- (public.item_events / public.item_metrics), so behaviour is unchanged — this
-- migration only pins `search_path = ''` (empty) to satisfy the linter and make
-- name resolution deterministic. SECURITY INVOKER is preserved (036): only the
-- service role (the daily GitHub Actions pipeline) calls it.
--
-- Idempotent: create-or-replace, no data touched. NB: percentile_disc /
-- count(*) are pg_catalog builtins, always on the path even when search_path=''.
-- ============================================================================

begin;

create or replace function public.refresh_item_metrics()
returns void
language sql
security invoker
set search_path = ''
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
