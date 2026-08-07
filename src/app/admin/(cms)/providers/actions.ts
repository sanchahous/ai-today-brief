'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { Json } from '@/lib/database.types';
import {
  PROVIDER_ROLES,
  type ProviderChainEntry,
  type ProviderRole,
} from '../../../../../pipeline/providers/registry';

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function linesOf(formData: FormData, key: string) {
  return optionalString(formData, key)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function revalidateProvidersAdmin() {
  revalidatePath('/admin');
  revalidatePath('/admin/providers');
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

function redirectProvidersError(message: string): never {
  redirect(`/admin/providers?error=${encodeURIComponent(message.slice(0, 500))}`);
}

/**
 * Runs a providers Server Action body, redirecting any thrown Error's
 * message to `/admin/providers?error=...` instead of letting Next.js
 * replace it with a generic "An error occurred" digest. Next's own
 * redirect()/notFound() control-flow throws (including the ones
 * requireSocialAdmin issues on auth failure) are re-thrown untouched.
 */
async function withProvidersErrorRedirect(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectProvidersError(error instanceof Error ? error.message : 'Something went wrong.');
  }
}

/** Creates or updates one llm_providers row. Never touches the secret -- see storeLlmProviderSecretAction. */
export async function upsertLlmProviderAction(formData: FormData) {
  await withProvidersErrorRedirect(async () => {
    await requireSocialAdmin({ roles: ['owner', 'editor'] });
    const id = requiredString(formData, 'id');
    const kind = requiredString(formData, 'kind');
    if (!['gemini', 'http', 'cli'].includes(kind)) throw new Error('Unsupported provider kind.');
    const baseUrl = optionalString(formData, 'base_url');
    const binaryName = optionalString(formData, 'binary_name');
    const authEnvVar = optionalString(formData, 'auth_env_var');
    if (kind === 'http' && !baseUrl) throw new Error('HTTP providers require a base URL.');
    if (kind === 'cli' && (!binaryName || !authEnvVar)) {
      throw new Error('CLI providers require a binary name and an auth env var.');
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('llm_providers').upsert({
      id,
      kind,
      enabled: formData.get('enabled') === 'on',
      base_url: kind === 'http' ? baseUrl : null,
      reports_cost: formData.get('reports_cost') === 'on',
      binary_name: kind === 'cli' ? binaryName : null,
      auth_env_var: kind === 'cli' ? authEnvVar : null,
      notes: optionalString(formData, 'notes') || null,
    });
    if (error) throw new Error(error.message);

    const modelIds = linesOf(formData, 'model_ids');
    // Atomic replace (single RPC) rather than a separate delete + insert --
    // a failure between two round trips used to be able to leave a provider
    // with zero models. See 20260807120000_llm_provider_registry_fixes.sql.
    const { error: modelsError } = await admin.rpc('replace_llm_provider_models', {
      p_provider_id: id,
      p_model_ids: modelIds,
    });
    if (modelsError) throw new Error(modelsError.message);
    revalidateProvidersAdmin();
  });
}

export async function deleteLlmProviderAction(formData: FormData) {
  await withProvidersErrorRedirect(async () => {
    await requireSocialAdmin({ roles: ['owner'] });
    const id = requiredString(formData, 'id');
    const admin = getSupabaseAdmin();
    // Clean up the Vault secret first: read_llm_provider_secret/
    // store_llm_provider_secret both look a secret up by the deterministic
    // name `llm_provider_<id>`, so leaving it behind means re-adding a
    // provider with the same id would silently inherit the old key.
    const { error: secretError } = await admin.rpc('delete_llm_provider_secret', {
      p_provider_id: id,
    });
    if (secretError) throw new Error(secretError.message);
    const { error } = await admin.from('llm_providers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidateProvidersAdmin();
  });
}

/**
 * Pastes a new API key into Vault for an HTTP provider (store_llm_provider_secret,
 * service_role only) -- the raw key is never written to a plain table column and
 * never round-trips back to the browser once saved.
 */
export async function storeLlmProviderSecretAction(formData: FormData) {
  await withProvidersErrorRedirect(async () => {
    await requireSocialAdmin({ aal2: true });
    const providerId = requiredString(formData, 'provider_id');
    const secret = requiredString(formData, 'secret');
    const { error } = await getSupabaseAdmin().rpc('store_llm_provider_secret', {
      p_provider_id: providerId,
      p_secret: secret,
    });
    if (error) throw new Error(error.message);
    revalidateProvidersAdmin();
  });
}

/**
 * Replaces the ordered provider chain for one role. `chain_text` is one
 * `kind:id` pair per line, e.g. `cli:claude-cli` then `http:openrouter`.
 */
export async function updateLlmRoleChainAction(formData: FormData) {
  await withProvidersErrorRedirect(async () => {
    await requireSocialAdmin({ roles: ['owner', 'editor'] });
    const role = requiredString(formData, 'role') as ProviderRole;
    if (!PROVIDER_ROLES.includes(role)) throw new Error('Unknown provider role.');

    const admin = getSupabaseAdmin();
    const { data: knownProviders } = await admin.from('llm_providers').select('id');
    const knownIds = new Set((knownProviders ?? []).map((row) => row.id));

    const chain: ProviderChainEntry[] = linesOf(formData, 'chain_text').map((line) => {
      const [kind, id] = line.split(':').map((part) => part.trim());
      if ((kind !== 'gemini' && kind !== 'http' && kind !== 'cli') || !id) {
        throw new Error(`Invalid chain entry "${line}" -- expected "kind:id", e.g. "http:openrouter".`);
      }
      if (!knownIds.has(id)) {
        throw new Error(`Invalid chain entry "${line}" -- no provider with id "${id}" exists yet. Add it above first.`);
      }
      return { kind, id };
    });

    const { error } = await admin.from('llm_role_chains').upsert({ role, chain: chain as unknown as Json });
    if (error) throw new Error(error.message);
    revalidateProvidersAdmin();
  });
}
