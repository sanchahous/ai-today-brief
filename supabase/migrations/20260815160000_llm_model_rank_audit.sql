begin;

-- Daily OpenRouter quality/$ ranking (wiki/pipeline/weekly-illustration-plan.md F3).
-- Append-only: the job inserts one row per ProviderRole; it never updates or
-- deletes. applied=true means llm_provider_models for 'openrouter' was replaced
-- with that run's weekly.master_writer top-3. A quality_drop row is the silent-
-- degradation guard — admin shows it, the owner keeps the current queue.

create table if not exists public.llm_model_rank_audit (
  id                      bigint generated always as identity primary key,
  role                    text not null,
  model_id                text,
  score                   double precision,
  price_per_m             double precision,
  quality_index           double precision,
  axis                    text not null,
  ranked_at               timestamptz not null default now(),
  applied                 boolean not null default false,
  skip_reason             text,
  previous_model_id       text,
  previous_quality_index  double precision,
  -- apply_disabled: OPENROUTER_RERANK_APPLY=off. The run still ranks and still
  -- records the winner, but nothing was written to llm_provider_models -- so
  -- the row must NOT claim applied=true, or the next run's quality-drop guard
  -- baselines against a model that never entered the queue.
  check (skip_reason is null or skip_reason in ('quality_drop', 'no_candidate', 'apply_disabled')),
  check (applied = false or skip_reason is null),
  check (applied = false or model_id is not null),
  check (
    (skip_reason = 'no_candidate' and model_id is null)
    or (skip_reason is distinct from 'no_candidate')
  )
);

create index if not exists llm_model_rank_audit_role_ranked_at_idx
  on public.llm_model_rank_audit (role, ranked_at desc);

alter table public.llm_model_rank_audit enable row level security;

drop policy if exists "llm registry: admin read" on public.llm_model_rank_audit;
create policy "llm registry: admin read"
  on public.llm_model_rank_audit
  for select
  to authenticated
  using (public.is_social_admin());

drop policy if exists "llm registry: aal2 write" on public.llm_model_rank_audit;
create policy "llm registry: aal2 write"
  on public.llm_model_rank_audit
  for all
  to authenticated
  using (public.is_social_admin() and public.has_social_aal2())
  with check (public.is_social_admin() and public.has_social_aal2());

commit;
