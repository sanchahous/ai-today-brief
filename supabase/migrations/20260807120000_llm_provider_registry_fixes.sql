begin;

-- Follow-up to 20260806160000_llm_provider_registry.sql, found during a
-- post-merge review of PR #190:
--
-- 1. deleteLlmProviderAction only deleted the llm_providers row -- the Vault
--    secret named `llm_provider_<id>` was never cleaned up. read/store both
--    look the secret up by that name, so re-adding a provider with the same
--    id would silently inherit the old, orphaned key instead of the new one
--    the owner just pasted (or the UI would just show "no key stored" while
--    the orphaned secret sits in Vault forever).
-- 2. upsertLlmProviderAction replaced llm_provider_models with a separate
--    delete-then-insert (two round trips, not atomic -- a failure between
--    them leaves the provider with zero models).

create or replace function public.delete_llm_provider_secret(p_provider_id text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  -- Plain DML against vault.secrets (a real table, transparently encrypted
  -- via pgsodium) rather than a vault.delete_secret() helper -- unlike
  -- insert/update, removing a row needs no nonce/key handling, and this
  -- avoids depending on a convenience function whose signature isn't
  -- exercised anywhere else in this codebase.
  delete from vault.secrets where name = 'llm_provider_' || p_provider_id;
end;
$$;

revoke all on function public.delete_llm_provider_secret(text) from public;
grant execute on function public.delete_llm_provider_secret(text) to service_role;

-- Atomic replace of one provider's ordered model list. Not security definer:
-- callers already go through getSupabaseAdmin() (service_role, bypasses
-- RLS), same as every other write in this file's actions -- this only needs
-- to be one transaction, not a privilege boundary.
create or replace function public.replace_llm_provider_models(
  p_provider_id text,
  p_model_ids text[]
)
returns void
language plpgsql
as $$
begin
  delete from public.llm_provider_models where provider_id = p_provider_id;
  if p_model_ids is not null and array_length(p_model_ids, 1) > 0 then
    insert into public.llm_provider_models (provider_id, model_id, rank)
    select p_provider_id, model_id, ord - 1
    from unnest(p_model_ids) with ordinality as t(model_id, ord);
  end if;
end;
$$;

revoke all on function public.replace_llm_provider_models(text, text[]) from public;
grant execute on function public.replace_llm_provider_models(text, text[]) to service_role;

commit;
