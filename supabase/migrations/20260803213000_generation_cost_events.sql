-- Ledger for LLM + image generation spend (admin /admin/costs).
-- Service role writes; authenticated social admins may read.

create table if not exists public.generation_cost_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scope text not null
    check (scope in ('weekly', 'daily', 'social', 'image')),
  kind text not null
    check (kind in ('llm', 'image')),
  provider text not null,
  model text not null,
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  cost_source text not null
    check (cost_source in ('reported', 'estimated', 'subscription')),
  prompt_tokens integer null check (prompt_tokens is null or prompt_tokens >= 0),
  output_tokens integer null check (output_tokens is null or output_tokens >= 0),
  weekly_digest_id uuid null references public.weekly_digests (id) on delete set null,
  revision_id uuid null references public.weekly_digest_revisions (id) on delete set null,
  job_id uuid null,
  artifact_id uuid null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists generation_cost_events_created_at_idx
  on public.generation_cost_events (created_at desc);

create index if not exists generation_cost_events_digest_created_idx
  on public.generation_cost_events (weekly_digest_id, created_at desc);

create index if not exists generation_cost_events_scope_created_idx
  on public.generation_cost_events (scope, created_at desc);

alter table public.generation_cost_events enable row level security;

drop policy if exists "generation cost events: admin read"
  on public.generation_cost_events;
create policy "generation cost events: admin read"
  on public.generation_cost_events for select to authenticated
  using (public.is_social_admin());

revoke all on table public.generation_cost_events from public, anon, authenticated;
grant select on table public.generation_cost_events to authenticated;
grant all on table public.generation_cost_events to service_role;
