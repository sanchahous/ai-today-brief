'use server';

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

/** Creates or updates one llm_providers row. Never touches the secret -- see storeLlmProviderSecretAction. */
export async function upsertLlmProviderAction(formData: FormData) {
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
  const { error: deleteError } = await admin.from('llm_provider_models').delete().eq('provider_id', id);
  if (deleteError) throw new Error(deleteError.message);
  if (modelIds.length > 0) {
    const { error: insertError } = await admin.from('llm_provider_models').insert(
      modelIds.map((modelId, index) => ({ provider_id: id, model_id: modelId, rank: index })),
    );
    if (insertError) throw new Error(insertError.message);
  }
  revalidateProvidersAdmin();
}

export async function deleteLlmProviderAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner'] });
  const id = requiredString(formData, 'id');
  const { error } = await getSupabaseAdmin().from('llm_providers').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidateProvidersAdmin();
}

/**
 * Pastes a new API key into Vault for an HTTP provider (store_llm_provider_secret,
 * service_role only) -- the raw key is never written to a plain table column and
 * never round-trips back to the browser once saved.
 */
export async function storeLlmProviderSecretAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true });
  const providerId = requiredString(formData, 'provider_id');
  const secret = requiredString(formData, 'secret');
  const { error } = await getSupabaseAdmin().rpc('store_llm_provider_secret', {
    p_provider_id: providerId,
    p_secret: secret,
  });
  if (error) throw new Error(error.message);
  revalidateProvidersAdmin();
}

/**
 * Replaces the ordered provider chain for one role. `chain_text` is one
 * `kind:id` pair per line, e.g. `cli:claude-cli` then `http:openrouter`.
 */
export async function updateLlmRoleChainAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const role = requiredString(formData, 'role') as ProviderRole;
  if (!PROVIDER_ROLES.includes(role)) throw new Error('Unknown provider role.');

  const chain: ProviderChainEntry[] = linesOf(formData, 'chain_text').map((line) => {
    const [kind, id] = line.split(':').map((part) => part.trim());
    if ((kind !== 'gemini' && kind !== 'http' && kind !== 'cli') || !id) {
      throw new Error(`Invalid chain entry "${line}" -- expected "kind:id", e.g. "http:openrouter".`);
    }
    return { kind, id };
  });

  const { error } = await getSupabaseAdmin()
    .from('llm_role_chains')
    .upsert({ role, chain: chain as unknown as Json });
  if (error) throw new Error(error.message);
  revalidateProvidersAdmin();
}
