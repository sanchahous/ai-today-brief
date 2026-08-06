/**
 * Provider registry: resolves a named call-site "role" (which text-gen call
 * this is — daily summarize, weekly master writer, social critic, ...) to an
 * ordered chain of provider adapters, and walks that chain until one
 * succeeds. This is Phase 1 of the plan in wiki/pipeline/llm-providers.md —
 * nothing in the app calls generateWithRegistry yet; later phases migrate
 * one existing call site at a time onto it.
 *
 * `loadProviderRegistry` is env-only for now (the `db` param is accepted and
 * reserved for Phase 1b's DB-backed llm_providers/llm_role_chains tables +
 * admin UI, not yet built). Per-role chain overrides can be passed directly
 * to `loadProviderRegistry` — each migration phase supplies the real chain
 * that call site needs (e.g. social's critic excluding the writer's vendor),
 * since that's a caller-side decision, not something the registry dictates.
 */

import {
  generateWithHttpProviderChain,
  OPENROUTER_HTTP_DEFAULTS,
  NIM_HTTP_DEFAULTS,
  type HttpProviderConfig,
} from './http-provider';
import { generateWithCliProvider, type CliProviderConfig } from './cli-provider';
import { generateWithGemini, type GeminiProviderConfig } from './gemini-provider';
import { ProviderUnavailableError, type ProviderCallResult } from './types';
import type { OpenRouterResponseValidator } from '../openrouter-brief-json';
import { resolveOpenRouterModelQueue } from '../openrouter-models';

export type ProviderRole =
  | 'daily.summarize'
  | 'daily.verify'
  | 'daily.auto_publish_judge'
  | 'daily.card_image_scene'
  | 'weekly.master_writer'
  | 'weekly.master_critic'
  | 'weekly.card_image_scene'
  | 'social.writer'
  | 'social.critic'
  | 'custom_research';

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
 * Env-only registry (Phase 1): builds whichever provider configs the
 * environment actually has keys for, and resolves every role to the same
 * `defaultChain` unless `roleOverrides` supplies a role-specific one. Each
 * later migration phase (2-6 in the plan) passes the real chain that call
 * site needs, informed by that call site's own requirements -- the registry
 * itself has no opinion on what belongs in a chain.
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
  // Reserved for Phase 1b (DB-backed llm_providers/llm_role_chains + admin UI). Unused today.
  _db?: unknown,
): Promise<ProviderRegistry> {
  const openRouterKey = resolveOpenRouterKey(env);
  const geminiKey = env.GEMINI_API_KEY?.trim();

  const defaultChain: ResolvedProvider[] = [];
  if (openRouterKey) {
    const modelQueue = await resolveOpenRouterModelQueue(openRouterKey, env);
    if (modelQueue.length > 0) {
      defaultChain.push({
        entry: { kind: 'http', id: 'openrouter' },
        http: { id: 'openrouter', apiKey: openRouterKey, modelQueue, ...OPENROUTER_HTTP_DEFAULTS },
      });
    }
  }
  if (geminiKey) {
    defaultChain.push({ entry: { kind: 'gemini', id: 'gemini' }, gemini: { apiKey: geminiKey } });
  }

  return {
    chainForRole(role) {
      return roleOverrides[role] ?? defaultChain;
    },
  };
}
