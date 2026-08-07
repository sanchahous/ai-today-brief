begin;

-- LLM provider registry (Phase 1b of wiki/pipeline/llm-providers.md): lets the
-- owner add/remove/reorder LLM providers (an OpenAI-compatible HTTP endpoint
-- like NVIDIA NIM, or a CLI subscription tool) through an admin page instead
-- of editing Vercel/GitHub secrets and redeploying. Empty tables are a
-- complete no-op -- pipeline/providers/registry.ts's loadProviderRegistry
-- falls back to its built-in env-only default chain whenever a role has no
-- row here, so shipping this migration changes zero runtime behavior on its
-- own.

create table if not exists public.llm_providers (
  id               text primary key,
  kind             text not null check (kind in ('gemini', 'http', 'cli')),
  enabled          boolean not null default true,
  -- http kind only.
  base_url         text,
  -- Vault secret name (see store_llm_provider_secret below) — never the raw key.
  secret_reference text,
  extra_headers    jsonb not null default '{}'::jsonb,
  -- Whether this provider reports real per-call USD cost (OpenRouter does; a
  -- bare OpenAI-compatible endpoint like NIM does not — see http-provider.ts).
  reports_cost     boolean not null default false,
  -- cli kind only.
  binary_name      text,
  auth_env_var     text,
  notes            text,
  updated_by       uuid references auth.users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  check (jsonb_typeof(extra_headers) = 'object'),
  check (kind <> 'http' or base_url is not null),
  check (kind <> 'cli' or (binary_name is not null and auth_env_var is not null))
);

create table if not exists public.llm_provider_models (
  provider_id text not null references public.llm_providers(id) on delete cascade,
  model_id    text not null,
  -- Lower = tried first. No live-ranked catalog assumption for http/cli
  -- providers without one (see pipeline/openrouter-models.ts's doc on why
  -- OpenRouter's own live-fetch-and-rank approach doesn't generalize).
  rank        smallint not null default 0,
  enabled     boolean not null default true,
  primary key (provider_id, model_id)
);

create table if not exists public.llm_role_chains (
  -- Matches pipeline/providers/registry.ts's ProviderRole union, e.g.
  -- 'weekly.master_writer', 'social.critic', 'daily.summarize'.
  role       text primary key,
  -- Ordered [{kind, id}, ...] — see registry.ts's ProviderChainEntry.
  chain      jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(chain) = 'array')
);

alter table public.llm_providers enable row level security;
alter table public.llm_provider_models enable row level security;
alter table public.llm_role_chains enable row level security;

-- Same admin-read + AAL2-write pattern as the social CMS tables
-- (040_social_cms.sql) — reuses is_social_admin()/has_social_aal2() as-is.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['llm_providers', 'llm_provider_models', 'llm_role_chains']
  loop
    execute format('drop policy if exists "llm registry: admin read" on public.%I', table_name);
    execute format(
      'create policy "llm registry: admin read" on public.%I for select to authenticated using (public.is_social_admin())',
      table_name
    );
    execute format('drop policy if exists "llm registry: aal2 write" on public.%I', table_name);
    execute format(
      'create policy "llm registry: aal2 write" on public.%I for all to authenticated using (public.is_social_admin() and public.has_social_aal2()) with check (public.is_social_admin() and public.has_social_aal2())',
      table_name
    );
  end loop;
end $$;

-- Vault-backed secret storage for owner-added HTTP providers, the same
-- pattern as store_social_oauth_secret/read_social_oauth_secret
-- (040_social_cms.sql) — service_role only; the table only ever holds a
-- secret *name*, never the raw key.
create or replace function public.store_llm_provider_secret(
  p_provider_id text,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_name text := 'llm_provider_' || p_provider_id;
  secret_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.llm_providers where id = p_provider_id) then
    raise exception 'Unknown provider id';
  end if;
  select id into secret_id from vault.secrets where name = secret_name limit 1;
  if secret_id is null then
    perform vault.create_secret(p_secret, secret_name, 'LLM provider API key');
  else
    perform vault.update_secret(secret_id, p_secret, secret_name, 'LLM provider API key');
  end if;
  update public.llm_providers
  set secret_reference = secret_name, updated_at = now()
  where id = p_provider_id;
end;
$$;

create or replace function public.read_llm_provider_secret(p_provider_id text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where name = 'llm_provider_' || p_provider_id
  limit 1;
  return secret_value;
end;
$$;

revoke all on function public.store_llm_provider_secret(text, text) from public;
revoke all on function public.read_llm_provider_secret(text) from public;
grant execute on function public.store_llm_provider_secret(text, text) to service_role;
grant execute on function public.read_llm_provider_secret(text) to service_role;

drop trigger if exists llm_providers_set_updated_at on public.llm_providers;
create trigger llm_providers_set_updated_at before update on public.llm_providers
  for each row execute function extensions.moddatetime(updated_at);
drop trigger if exists llm_role_chains_set_updated_at on public.llm_role_chains;
create trigger llm_role_chains_set_updated_at before update on public.llm_role_chains
  for each row execute function extensions.moddatetime(updated_at);

commit;
