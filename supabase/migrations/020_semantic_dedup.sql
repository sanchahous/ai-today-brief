-- ============================================================================
-- 020 — Semantic cross-day dedup (pgvector)
--
-- Stores one embedding per published brief_item so the daily pipeline can
-- filter candidates that are the same story, however re-worded, before the
-- LLM editor call. Model: gemini-embedding-001 → 768 dimensions.
--
-- Also extends the pipeline_runs stage constraint to include 'dedup' so the
-- new dedup stage can be logged without a DB error.
-- ============================================================================

begin;

-- ── pgvector extension ───────────────────────────────────────────────────────
-- Supabase projects have the extension available in the `extensions` schema.
create extension if not exists vector with schema extensions;

-- ── brief_item_embeddings ────────────────────────────────────────────────────
-- One embedding per brief_item (1-1 via PK = FK). Separate table keeps
-- brief_items lean and lets us add/replace embeddings without touching the
-- editorial content row.
create table if not exists public.brief_item_embeddings (
  brief_item_id uuid primary key
    references public.brief_items (id) on delete cascade,
  embedding     extensions.vector(768) not null,
  model         text not null default 'gemini-embedding-001',
  created_at    timestamptz not null default now()
);

-- HNSW index for fast approximate nearest-neighbour at query time.
create index if not exists brief_item_embeddings_hnsw
  on public.brief_item_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- RLS: service_role only (pipeline writes; never exposed publicly).
alter table public.brief_item_embeddings enable row level security;
drop policy if exists brief_item_embeddings_no_anon on public.brief_item_embeddings;
create policy brief_item_embeddings_no_anon
  on public.brief_item_embeddings
  for all to anon, authenticated
  using (false) with check (false);

-- ── match_published_item RPC ─────────────────────────────────────────────────
-- Returns the single nearest published brief_item embedding within max_distance
-- (cosine), or no rows if nothing is close enough. Called by the pipeline dedup
-- step once per pool candidate.
create or replace function public.match_published_item(
  query_embedding extensions.vector(768),
  max_distance    double precision
)
returns table (brief_item_id uuid, distance double precision)
language sql stable
set search_path = public, extensions
as $$
  select bie.brief_item_id,
         (bie.embedding <=> query_embedding) as distance
  from   public.brief_item_embeddings bie
  join   public.brief_items            bi  on bi.id    = bie.brief_item_id
  join   public.briefs                 b   on b.id     = bi.brief_id
  where  b.status = 'published'
    and  (bie.embedding <=> query_embedding) <= max_distance
  order  by bie.embedding <=> query_embedding
  limit  1;
$$;

-- ── pipeline_runs: extend stage constraint ───────────────────────────────────
-- Drop and recreate the inline check so 'dedup' becomes a valid stage.
do $$
declare
  cname text;
begin
  select constraint_name into cname
  from   information_schema.table_constraints
  where  table_schema    = 'public'
    and  table_name      = 'pipeline_runs'
    and  constraint_type = 'CHECK'
    and  constraint_name ilike '%stage%';
  if cname is not null then
    execute format('alter table public.pipeline_runs drop constraint %I', cname);
  end if;
end $$;

alter table public.pipeline_runs
  add constraint pipeline_runs_stage_check
  check (stage in ('fetch', 'rank', 'summarize', 'publish', 'dedup'));

commit;
