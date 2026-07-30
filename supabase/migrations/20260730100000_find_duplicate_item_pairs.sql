-- ============================================================================
-- 20260730100000 — find_duplicate_item_pairs RPC + dedup-scan/auto-publish
-- pipeline stages + 'redone' item_reviews action
--
-- Cross-day semantic dedup (026/039) only rejects a *new* candidate against
-- what is already published — it never revisits stories already sitting in
-- the archive. MAX_EMBED_DISTANCE is deliberately held at 0.12 (pipeline/
-- config.ts) so the live gate does not kill genuinely new stories; the same
-- event re-told days apart in different words can still land in the
-- 0.12–0.25 band and get published twice. `find_duplicate_item_pairs` is the
-- retroactive scan: it surfaces candidate pairs for `pipeline/dedup-scan.ts`
-- to LLM-confirm before writing canonical_item_id (031's redirect pattern —
-- no hard deletes).
--
-- Also extends pipeline_runs.stage with 'dedup_scan' and 'auto_publish' (the
-- two new scheduled jobs) and item_reviews.action with 'redone' (closes the
-- audit gap: the 🔁 redo button currently hard-deletes the pending row with
-- no item_reviews trace).
-- ============================================================================

begin;

-- ── find_duplicate_item_pairs ────────────────────────────────────────────────
-- Self-join of published+approved, not-yet-canonicalized items with a title
-- embedding, within `window_days` of today. Pairs are ordered so `earlier`
-- (by date, then edition, then rank, then id) is the canonical-in-waiting —
-- the same "earliest copy wins" rule as 031's backfill. Only cross-brief
-- pairs are considered (a story cannot duplicate itself within one pack).
--
-- `recent_days` bounds the steady-state scan to pairs whose LATER side
-- published recently (default 3) — without a "pairs already seen" table,
-- this is what keeps the daily job from re-asking the LLM about the same old
-- pairs forever. Pass `recent_days => 0` for a one-time backfill across the
-- whole window.
--
-- `same_article` pairs (identical article_id — the pipeline re-ran on the
-- same source) are flagged so the caller can merge them without an LLM call.
create or replace function public.find_duplicate_item_pairs(
  max_distance double precision default 0.30,
  window_days  integer default 45,
  recent_days  integer default 3,
  max_pairs    integer default 200
)
returns table (
  earlier_id   uuid,
  later_id     uuid,
  distance     double precision,
  same_article boolean
)
language sql stable
set search_path = public, extensions
as $$
  with eligible as (
    select
      bi.id         as id,
      bi.article_id as article_id,
      bi.rank       as rank,
      bi.brief_id   as brief_id,
      b.date        as date,
      b.edition     as edition,
      bie.embedding as embedding
    from public.brief_items bi
    join public.briefs b on b.id = bi.brief_id
    join public.brief_item_embeddings bie on bie.brief_item_id = bi.id
    where b.status = 'published'
      and bi.review_status = 'approved'
      and bi.canonical_item_id is null
      and b.date >= current_date - window_days
  )
  select
    e.id as earlier_id,
    l.id as later_id,
    (e.embedding <=> l.embedding) as distance,
    (e.article_id is not null and e.article_id = l.article_id) as same_article
  from eligible e
  join eligible l
    on l.brief_id <> e.brief_id
   and (e.date, e.edition, e.rank, e.id) < (l.date, l.edition, l.rank, l.id)
  where (recent_days <= 0 or l.date >= current_date - recent_days)
    and (e.embedding <=> l.embedding) <= max_distance
  order by distance
  limit max_pairs;
$$;

revoke execute on function public.find_duplicate_item_pairs(double precision, integer, integer, integer)
  from public, anon, authenticated;

-- ── pipeline_runs: allow the two new scheduled-job stages ───────────────────
alter table public.pipeline_runs
  drop constraint if exists pipeline_runs_stage_check;

alter table public.pipeline_runs
  add constraint pipeline_runs_stage_check
  check (stage in (
    'fetch', 'rank', 'summarize', 'publish', 'dedup', 'enrich', 'verify',
    'dedup_scan', 'auto_publish'
  ));

-- ── item_reviews: allow 'redone' (audit trail for the 🔁 redo button) ───────
do $$
declare
  cname text;
begin
  select constraint_name into cname
  from   information_schema.table_constraints
  where  table_schema    = 'public'
    and  table_name      = 'item_reviews'
    and  constraint_type = 'CHECK'
    and  constraint_name ilike '%action%';
  if cname is not null then
    execute format('alter table public.item_reviews drop constraint %I', cname);
  end if;
end $$;

alter table public.item_reviews
  add constraint item_reviews_action_check
  check (action in ('approved', 'rejected', 'redone'));

commit;
