/**
 * Shared Gemini→OpenRouter JSON-completion lane. Originally lived inside
 * verify.ts; auto-publish.ts needs the exact same fallback behaviour for its
 * own JSON-shaped LLM calls, so it moved here. Gemini's model queue is tried
 * first; on exhaustion, the OpenRouter `:free` chain takes over. `stage`
 * labels the fallback log line with the caller's pipeline stage.
 *
 * LLM provider registry migration (Phase 6a, 2026-08-06): when a caller
 * passes `role`, this goes through pipeline/providers/registry.ts instead —
 * DB-driven (an owner-configured chain from /admin/providers wins), and the
 * registry's own default chain order (OpenRouter first, matching the rest of
 * the project since Phase 0) rather than this function's own primaryProvider
 * toggle. Callers that don't pass `role` (auto-publish.ts, not yet migrated —
 * Phase 6b) keep the exact old primaryProvider-driven behavior untouched.
 */

import type { PipelineDb } from './db';
import { resolveGeminiModelQueue } from './gemini-models';
import { logEvent, serializeErrorDetails } from './log';
import type { OpenRouterResponseValidator } from './openrouter-brief-json';
import { loadProviderRegistry, generateWithRegistry, type ProviderRegistry, type ProviderRole } from './providers/registry';
import {
  estimateUsage,
  generateWithModelQueue,
  type GeminiResponseSchema,
  type LlmUsage,
} from './summarize';

/* v8 ignore start -- thin provider plumbing; callers are integration-covered */
/**
 * Lenient validator for the OpenRouter lane: callers guard the parsed shape
 * downstream (their own result parsers), so syntactic JSON is enough here —
 * a parse failure advances the chain to the next model.
 */
const validateGenericJson: OpenRouterResponseValidator = (_modelId, rawText, finishReason) => {
  if (finishReason === 'length') throw new SyntaxError('[llm-json] truncated completion');
  const text = rawText.trim();
  JSON.parse(text);
  return text;
};

/** Attaches `schema` to any 'gemini' entry in `role`'s chain -- same pattern as custom-research.ts's withResearchSchema. */
export function withJsonSchema(role: ProviderRole, schema: GeminiResponseSchema, registry: ProviderRegistry): ProviderRegistry {
  return {
    chainForRole(forRole) {
      const chain = registry.chainForRole(forRole);
      if (forRole !== role) return chain;
      return chain.map((resolved) =>
        resolved.entry.kind === 'gemini' && resolved.gemini
          ? { ...resolved, gemini: { ...resolved.gemini, schema } }
          : resolved,
      );
    },
  };
}

async function generateJsonViaRegistry(
  prompt: string,
  schema: GeminiResponseSchema,
  role: ProviderRole,
  env: { GEMINI_API_KEY?: string; OPEN_ROUTER_API_KEY?: string },
  db: PipelineDb | undefined,
): Promise<{ text: string; model: string | null; usage: LlmUsage | null }> {
  const registry = withJsonSchema(role, schema, await loadProviderRegistry(env, {}, db));
  const result = await generateWithRegistry(role, prompt, registry, { validateResponse: validateGenericJson });
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

/** Gemini queue first; on exhaustion, the OpenRouter `:free` chain. */
export async function generateJsonWithFallback(
  stage: string,
  prompt: string,
  apiKey: string,
  geminiMaxAttempts: number,
  schema: GeminiResponseSchema,
  openRouterApiKey?: string,
  // Temporary scaffolding (2026-08-06) so the owner can flip daily off Gemini
  // without waiting on the project-wide provider-registry migration (see
  // wiki/pipeline/llm-providers.md) — deleted once that migration reaches
  // the daily lane. Default preserves today's Gemini-first behavior exactly.
  // Ignored once `role` is passed (see generateJsonViaRegistry above).
  primaryProvider: 'gemini' | 'openrouter' = 'gemini',
  role?: ProviderRole,
  db?: PipelineDb,
): Promise<{ text: string; model: string | null; usage: LlmUsage | null }> {
  if (role) {
    return generateJsonViaRegistry(
      prompt,
      schema,
      role,
      { GEMINI_API_KEY: apiKey, OPEN_ROUTER_API_KEY: openRouterApiKey },
      db,
    );
  }

  const runGemini = async () => {
    const modelQueue = await resolveGeminiModelQueue(apiKey);
    return generateWithModelQueue(prompt, apiKey, modelQueue, geminiMaxAttempts, undefined, undefined, schema);
  };
  const runOpenRouter = async () => {
    if (!openRouterApiKey) throw new Error('[llm-json] OpenRouter API key not configured');
    const { generateWithOpenRouterChain } = await import('./openrouter-summarize');
    const result = await generateWithOpenRouterChain(prompt, {
      apiKey: openRouterApiKey,
      validateResponse: validateGenericJson,
    });
    return {
      text: result.text,
      model: `openrouter:${result.model}`,
      usage: estimateUsage(prompt.length, result.text.length),
    };
  };

  if (primaryProvider === 'openrouter' && openRouterApiKey) {
    try {
      return await runOpenRouter();
    } catch (openRouterError) {
      logEvent('warn', stage, 'OpenRouter primary failed — Gemini fallback', {
        ...serializeErrorDetails(openRouterError),
      });
      return await runGemini();
    }
  }

  try {
    return await runGemini();
  } catch (geminiError) {
    if (!openRouterApiKey) throw geminiError;
    logEvent('warn', stage, 'Gemini queue exhausted — OpenRouter fallback', {
      ...serializeErrorDetails(geminiError),
    });
    return await runOpenRouter();
  }
}
/* v8 ignore end */
