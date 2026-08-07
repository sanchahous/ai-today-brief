/**
 * Shared JSON-completion lane for the daily pipeline — verify.ts's fact-check
 * and revise passes, plus auto-publish.ts's judge. Originally a hand-rolled
 * Gemini→OpenRouter fallback that lived inside verify.ts.
 *
 * LLM provider registry migration: Phase 6a (2026-08-06) moved verify.ts onto
 * pipeline/providers/registry.ts, Phase 6b (2026-08-07) moved auto-publish.ts.
 * With no caller left on the old path, this lane is now registry-only and the
 * temporary `primaryProvider` toggle (`DAILY_LLM_PRIMARY_PROVIDER`, added in
 * Phase 0 so the owner could flip daily off Gemini before the registry
 * existed) is gone from here — exactly what its own comment promised. The
 * chain now comes from the registry: an owner-configured chain saved at
 * /admin/providers wins, otherwise the registry's default order (OpenRouter
 * first, matching the rest of the project since Phase 0).
 *
 * `config.primaryTextProvider` still exists for summarize.ts, the one daily
 * call site that cannot import the registry at all (circular dependency —
 * see summarize.ts / run-daily.ts's resolveDbHttpProvider).
 */

import type { PipelineDb } from './db';
import type { OpenRouterResponseValidator } from './openrouter-brief-json';
import { loadProviderRegistry, generateWithRegistry, type ProviderRegistry, type ProviderRole } from './providers/registry';
import type { GeminiResponseSchema, LlmUsage } from './summarize';

/* v8 ignore start -- thin provider plumbing; callers are integration-covered */
/**
 * Lenient validator for the HTTP lane: callers guard the parsed shape
 * downstream (their own result parsers), so syntactic JSON is enough here —
 * a parse failure advances the chain to the next model.
 */
const validateGenericJson: OpenRouterResponseValidator = (_modelId, rawText, finishReason) => {
  if (finishReason === 'length') throw new SyntaxError('[llm-json] truncated completion');
  const text = rawText.trim();
  JSON.parse(text);
  return text;
};

/** Per-call Gemini settings the registry's `dispatch()` has no channel for — they ride on the chain entry instead. */
export interface GeminiCallConfig {
  schema: GeminiResponseSchema;
  /**
   * Model-queue budget for this call. run-daily.ts widens it on the day's last
   * slot (geminiMaxAttemptsForSlot); omitted falls back to gemini-provider.ts's
   * own default.
   */
  maxModelAttempts?: number;
}

/**
 * Attaches `cfg` to any 'gemini' entry in `role`'s chain — same pattern as
 * custom-research.ts's withResearchSchema. Needed because a single role can
 * front calls with different schemas (`daily.verify` serves both VERIFY_SCHEMA
 * and GEMINI_SCHEMA), so the schema cannot live in the registry's own
 * resolution. Other roles' chains, and non-gemini entries, are untouched.
 */
export function withGeminiCallConfig(
  role: ProviderRole,
  cfg: GeminiCallConfig,
  registry: ProviderRegistry,
): ProviderRegistry {
  return {
    chainForRole(forRole) {
      const chain = registry.chainForRole(forRole);
      if (forRole !== role) return chain;
      return chain.map((resolved) =>
        resolved.entry.kind === 'gemini' && resolved.gemini
          ? {
              ...resolved,
              gemini: {
                ...resolved.gemini,
                schema: cfg.schema,
                maxModelAttempts: cfg.maxModelAttempts ?? resolved.gemini.maxModelAttempts,
              },
            }
          : resolved,
      );
    },
  };
}

export interface JsonRoleCallOptions {
  role: ProviderRole;
  prompt: string;
  schema: GeminiResponseSchema;
  geminiApiKey: string;
  geminiMaxAttempts?: number;
  openRouterApiKey?: string;
  /** Lets an owner-configured chain from /admin/providers override the default for this role. */
  db?: PipelineDb;
  /**
   * Pre-resolved registry, reused instead of building a fresh one. Pass it
   * when a single run fires this repeatedly (auto-publish sweeps a week of
   * drafts): loadProviderRegistry does a live OpenRouter catalog fetch plus
   * three Supabase reads, and neither is cached. See createRegistryLoader.
   */
  registry?: ProviderRegistry;
}

/**
 * Walks `role`'s provider chain until one returns parseable JSON. Throws
 * RegistryExhaustedError once every provider in the chain has failed —
 * callers read that as "the LLM is unavailable" (auto-publish.ts fails closed
 * on it and leaves its pending items untouched).
 */
export async function generateJsonWithFallback(
  options: JsonRoleCallOptions,
): Promise<{ text: string; model: string | null; usage: LlmUsage | null }> {
  const base =
    options.registry ??
    (await loadProviderRegistry(
      { GEMINI_API_KEY: options.geminiApiKey, OPEN_ROUTER_API_KEY: options.openRouterApiKey },
      {},
      options.db,
    ));
  const registry = withGeminiCallConfig(
    options.role,
    { schema: options.schema, maxModelAttempts: options.geminiMaxAttempts },
    base,
  );
  const result = await generateWithRegistry(options.role, options.prompt, registry, {
    validateResponse: validateGenericJson,
  });
  return {
    text: result.text,
    model: `${result.provider}:${result.model}`,
    usage: {
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
      estimated: result.usage.costSource !== 'reported',
    },
  };
}

/**
 * One registry per run for callers that make many role calls in a row.
 * Memoized including the rejection case on purpose: a catalog or Supabase
 * outage should be paid once, not once per draft.
 */
export function createRegistryLoader(
  env: { GEMINI_API_KEY?: string; OPEN_ROUTER_API_KEY?: string },
  db?: PipelineDb,
): () => Promise<ProviderRegistry> {
  let pending: Promise<ProviderRegistry> | null = null;
  return () => (pending ??= loadProviderRegistry(env, {}, db));
}
/* v8 ignore end */
