/**
 * Provider registry: resolves a named call-site "role" (which text-gen call
 * this is — daily summarize, weekly master writer, social critic, ...) to an
 * ordered chain of provider adapters, and walks that chain until one
 * succeeds. This is Phase 1 of the plan in wiki/pipeline/llm-providers.md —
 * nothing in the app calls generateWithRegistry yet; later phases migrate
 * one existing call site at a time onto it.
 *
 * `db` (Phase 1b) points at the `llm_providers`/`llm_provider_models`/
 * `llm_role_chains` tables an owner edits through /admin/providers — when
 * given, a role with a saved chain there overrides the env-only default.
 * DB-driven resolution is complete for `http` and `gemini` chain entries; a
 * `cli` entry in a DB-saved chain is honestly unresolvable from the DB alone
 * (see resolveKnownCliProvider below) and is skipped with a log line, not
 * silently pretended to work — a DB row can name a CLI tool's ordering, but
 * can't supply the real argv-builder/envelope-parser code every CLI tool
 * needs (see cli-provider.ts's module doc).
 */

import {
  generateWithHttpProviderChain,
  OPENROUTER_HTTP_DEFAULTS,
  NIM_HTTP_DEFAULTS,
  type HttpProviderConfig,
} from './http-provider';
import { generateWithCliProvider, type CliProviderConfig } from './cli-provider';
import { CODEX_CLI_CONFIG } from './cli/codex';
import { generateWithGemini, type GeminiProviderConfig } from './gemini-provider';
import { ProviderUnavailableError, type ProviderCallResult } from './types';
import type { OpenRouterResponseValidator } from '../openrouter-brief-json';
import { resolveOpenRouterModelQueue } from '../openrouter-models';
import { logEvent } from '../log';
import type { PipelineDb } from '../db';

/** ProviderRole is derived from this array, so the two can never drift apart. */
export const PROVIDER_ROLES = [
  'daily.summarize',
  'daily.verify',
  'daily.auto_publish_judge',
  'daily.card_image_scene',
  'weekly.master_writer',
  'weekly.master_critic',
  'weekly.card_image_scene',
  'social.writer',
  'social.critic',
  'custom_research',
] as const;

export type ProviderRole = (typeof PROVIDER_ROLES)[number];

export interface ProviderChainEntry {
  kind: 'gemini' | 'http' | 'cli';
  id: string;
}

export interface ResolvedProvider {
  entry: ProviderChainEntry;
  http?: HttpProviderConfig;
  cli?: CliProviderConfig;
  gemini?: GeminiProviderConfig;
}

export interface ProviderRegistry {
  chainForRole(role: ProviderRole): ResolvedProvider[];
}

export interface ProviderAttempt {
  provider: string;
  model?: string;
  status: 'success' | 'failed' | 'unconfigured';
  reason?: string;
}

export class RegistryExhaustedError extends Error {
  constructor(
    readonly role: ProviderRole,
    readonly attempts: ProviderAttempt[],
  ) {
    super(
      `[registry] every provider failed for role '${role}' -- ${attempts
        .map((a) => `${a.provider}${a.model ? `/${a.model}` : ''}: ${a.status}${a.reason ? ` (${a.reason})` : ''}`)
        .join(' | ')}`,
    );
    this.name = 'RegistryExhaustedError';
  }
}

/** Env vars this module knows how to turn into provider configs. Extend as new HTTP providers are added. */
export interface RegistryEnv {
  GEMINI_API_KEY?: string;
  OPEN_ROUTER_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  [key: string]: string | undefined;
}

function resolveOpenRouterKey(env: RegistryEnv): string | undefined {
  return env.OPEN_ROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim() || undefined;
}

/**
 * Walks `registry.chainForRole(role)` in order, skipping any adapter that
 * throws ProviderUnavailableError (no key / no binary — a fast, expected
 * skip, not a retry-worthy failure), returning the first success. Throws
 * RegistryExhaustedError with a full attempt log if every entry fails.
 */
export async function generateWithRegistry(
  role: ProviderRole,
  prompt: string,
  registry: ProviderRegistry,
  options?: {
    validateResponse?: OpenRouterResponseValidator;
    jsonSchema?: Record<string, unknown>;
    onAttempt?: (attempt: ProviderAttempt) => void;
  },
): Promise<ProviderCallResult> {
  const chain = registry.chainForRole(role);
  const attempts: ProviderAttempt[] = [];

  for (const resolved of chain) {
    try {
      const result = await dispatch(resolved, prompt, options);
      const attempt: ProviderAttempt = { provider: resolved.entry.id, model: result.model, status: 'success' };
      attempts.push(attempt);
      options?.onAttempt?.(attempt);
      return result;
    } catch (error) {
      const attempt: ProviderAttempt =
        error instanceof ProviderUnavailableError
          ? { provider: resolved.entry.id, status: 'unconfigured', reason: error.message }
          : {
              provider: resolved.entry.id,
              status: 'failed',
              reason: error instanceof Error ? error.message : String(error),
            };
      attempts.push(attempt);
      options?.onAttempt?.(attempt);
    }
  }

  throw new RegistryExhaustedError(role, attempts);
}

async function dispatch(
  resolved: ResolvedProvider,
  prompt: string,
  options?: {
    validateResponse?: OpenRouterResponseValidator;
    jsonSchema?: Record<string, unknown>;
  },
): Promise<ProviderCallResult> {
  switch (resolved.entry.kind) {
    case 'http':
      if (!resolved.http) throw new Error(`[registry] http entry '${resolved.entry.id}' has no config`);
      return generateWithHttpProviderChain(prompt, resolved.http, {
        validateResponse: options?.validateResponse,
      });
    case 'cli':
      if (!resolved.cli) throw new Error(`[registry] cli entry '${resolved.entry.id}' has no config`);
      return generateWithCliProvider(prompt, resolved.cli, { jsonSchema: options?.jsonSchema });
    case 'gemini':
      if (!resolved.gemini) throw new Error(`[registry] gemini entry has no config`);
      return generateWithGemini(prompt, resolved.gemini);
    /* v8 ignore next */
    default:
      throw new Error(`[registry] unknown provider kind`);
  }
}

/** Builds a ResolvedProvider for NVIDIA NIM if NVIDIA_API_KEY is set — the model list must be supplied by the caller (no live catalog for NIM, see http-provider.ts). */
export function nimProvider(
  modelQueue: string[],
  env: RegistryEnv = process.env,
): ResolvedProvider | null {
  const apiKey = env.NVIDIA_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    entry: { kind: 'http', id: 'nim' },
    http: { id: 'nim', apiKey, modelQueue, ...NIM_HTTP_DEFAULTS },
  };
}

/**
 * Registered here as new CLI tools get real code (buildArgs/parseEnvelope) --
 * see cli-provider.ts's module doc for why this can't be config-driven. A DB
 * chain entry naming a CLI provider id not registered here is skipped, not
 * silently mis-resolved. `claude-cli` is deliberately still absent:
 * claude-cli.ts wasn't refactored onto cli-provider.ts's shape (no second
 * consumer existed to justify the risk on weekly's only $0-cost path before
 * Phase 7 -- and there still isn't one now, Codex is a genuinely separate
 * tool, not a claude-cli.ts replacement). Adding 'codex-cli' here only makes
 * it *resolvable* from a DB-saved chain via /admin/providers -- it joins no
 * role's chain on its own; the owner opts it in explicitly once CODEX_API_KEY
 * is set on the runner (see wiki/pipeline/llm-providers.md, Phase 7).
 */
const KNOWN_CLI_PROVIDERS: Record<string, Omit<CliProviderConfig, 'id'>> = {
  'codex-cli': CODEX_CLI_CONFIG,
};

function resolveKnownCliProvider(id: string): CliProviderConfig | null {
  const known = KNOWN_CLI_PROVIDERS[id];
  return known ? { id, ...known } : null;
}

/** Builds one ResolvedProvider from a DB row, or null if it can't be resolved (missing key, disabled, unknown CLI tool). */
async function resolveDbProvider(
  db: PipelineDb,
  providerRow: { id: string; kind: string; base_url: string | null; extra_headers: unknown; reports_cost: boolean },
  modelQueue: string[],
  geminiKey: string | undefined,
): Promise<ResolvedProvider | null> {
  if (providerRow.kind === 'http') {
    if (!providerRow.base_url || modelQueue.length === 0) return null;
    const { data: secret } = await db.rpc('read_llm_provider_secret', { p_provider_id: providerRow.id });
    if (!secret) return null;
    const extraHeaders =
      providerRow.extra_headers && typeof providerRow.extra_headers === 'object' && !Array.isArray(providerRow.extra_headers)
        ? (providerRow.extra_headers as Record<string, string>)
        : undefined;
    return {
      entry: { kind: 'http', id: providerRow.id },
      http: {
        id: providerRow.id,
        apiKey: secret,
        baseUrl: providerRow.base_url,
        modelQueue,
        extraHeaders,
        reportsCost: providerRow.reports_cost,
      },
    };
  }
  if (providerRow.kind === 'gemini') {
    if (!geminiKey) return null;
    return { entry: { kind: 'gemini', id: providerRow.id }, gemini: { apiKey: geminiKey } };
  }
  if (providerRow.kind === 'cli') {
    const cli = resolveKnownCliProvider(providerRow.id);
    if (!cli) {
      logEvent('warn', 'llm-providers', 'DB role chain references an unregistered CLI provider id -- skipped', {
        provider_id: providerRow.id,
      });
      return null;
    }
    return { entry: { kind: 'cli', id: providerRow.id }, cli };
  }
  return null;
}

/** Reads llm_role_chains + llm_providers + llm_provider_models and resolves each saved chain into ResolvedProvider[]. */
async function loadDbRoleChains(
  db: PipelineDb,
  env: RegistryEnv,
): Promise<Map<ProviderRole, ResolvedProvider[]>> {
  const [{ data: chains }, { data: providers }, { data: models }] = await Promise.all([
    db.from('llm_role_chains').select('*'),
    db.from('llm_providers').select('*').eq('enabled', true),
    db.from('llm_provider_models').select('*').eq('enabled', true).order('rank'),
  ]);

  const modelsByProvider = new Map<string, string[]>();
  for (const model of models ?? []) {
    const list = modelsByProvider.get(model.provider_id) ?? [];
    list.push(model.model_id);
    modelsByProvider.set(model.provider_id, list);
  }
  const providerById = new Map((providers ?? []).map((row) => [row.id, row]));
  const geminiKey = env.GEMINI_API_KEY?.trim();

  const result = new Map<ProviderRole, ResolvedProvider[]>();
  for (const row of chains ?? []) {
    if (!(PROVIDER_ROLES as readonly string[]).includes(row.role)) continue;
    const rawEntries = Array.isArray(row.chain) ? row.chain : [];
    const resolved: ResolvedProvider[] = [];
    for (const rawEntry of rawEntries) {
      if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
      const id = (rawEntry as Record<string, unknown>).id;
      if (typeof id !== 'string') continue;
      const providerRow = providerById.get(id);
      if (!providerRow) continue;
      const provider = await resolveDbProvider(
        db,
        providerRow,
        modelsByProvider.get(id) ?? [],
        geminiKey,
      );
      if (provider) resolved.push(provider);
    }
    // A saved chain that resolves to zero usable providers (missing secret,
    // disabled provider, unregistered CLI id) must NOT shadow defaultChain --
    // `chainForRole`'s `dbChains?.get(role) ?? defaultChain` treats a present
    // (even empty) Map entry as an explicit override that wins over `??`, so
    // storing `[]` here would turn one misconfigured DB row into a total
    // outage for a role that's otherwise perfectly servable by env keys. An
    // empty `rawEntries` (owner cleared the chain on purpose) is a silent
    // no-op; a non-empty one that still resolved to nothing is almost
    // certainly a mistake (e.g. key not pasted yet) worth a log line.
    if (resolved.length === 0) {
      if (rawEntries.length > 0) {
        logEvent(
          'warn',
          'llm-providers',
          'DB role chain resolved to zero usable providers -- falling back to the default chain',
          { role: row.role },
        );
      }
      continue;
    }
    result.set(row.role as ProviderRole, resolved);
  }
  return result;
}

/**
 * Builds whichever provider configs the environment actually has keys for,
 * and resolves every role to the same `defaultChain` unless `roleOverrides`
 * or a saved `db` row supplies a role-specific one (`db` wins over the
 * built-in default, `roleOverrides` wins over `db` -- a caller-supplied
 * override is always the most specific signal). Each later migration phase
 * (2-6 in the plan) passes the real chain that call site needs, informed by
 * that call site's own requirements -- the registry itself has no opinion on
 * what belongs in a chain.
 *
 * Async because the OpenRouter entry in `defaultChain` needs a real,
 * live-fetched model queue -- `HttpProviderConfig.modelQueue` must be
 * non-empty (an empty array is a valid-but-empty queue to
 * generateWithOpenRouterChain, not "please live-rank one"), so this resolves
 * one via resolveOpenRouterModelQueue rather than leaving that footgun for
 * callers who don't supply their own roleOverrides chain.
 */
export async function loadProviderRegistry(
  env: RegistryEnv = process.env,
  roleOverrides: Partial<Record<ProviderRole, ResolvedProvider[]>> = {},
  db?: PipelineDb,
): Promise<ProviderRegistry> {
  const openRouterKey = resolveOpenRouterKey(env);
  const geminiKey = env.GEMINI_API_KEY?.trim();

  const defaultChain: ResolvedProvider[] = [];
  if (openRouterKey) {
    // A transient catalog outage (rate limit, network blip) must not take
    // down the whole registry -- every role that also has Gemini, or a DB
    // chain, should still work. Treat it the same as "OpenRouter
    // unconfigured" for defaultChain purposes: log and move on.
    try {
      const modelQueue = await resolveOpenRouterModelQueue(openRouterKey, env);
      if (modelQueue.length > 0) {
        defaultChain.push({
          entry: { kind: 'http', id: 'openrouter' },
          http: { id: 'openrouter', apiKey: openRouterKey, modelQueue, ...OPENROUTER_HTTP_DEFAULTS },
        });
      }
    } catch (error) {
      logEvent(
        'warn',
        'llm-providers',
        'OpenRouter model catalog fetch failed -- continuing without OpenRouter in the default chain',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }
  if (geminiKey) {
    defaultChain.push({ entry: { kind: 'gemini', id: 'gemini' }, gemini: { apiKey: geminiKey } });
  }

  // Same reasoning as above: a DB read failure (network blip against
  // Supabase) should degrade to "no DB override this call", not crash
  // registry construction and every role that would otherwise resolve fine
  // from defaultChain alone.
  let dbChains: Map<ProviderRole, ResolvedProvider[]> | null = null;
  if (db) {
    try {
      dbChains = await loadDbRoleChains(db, env);
    } catch (error) {
      logEvent(
        'warn',
        'llm-providers',
        'Loading DB-configured role chains failed -- continuing with the env-only default chain',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  return {
    chainForRole(role) {
      return roleOverrides[role] ?? dbChains?.get(role) ?? defaultChain;
    },
  };
}
