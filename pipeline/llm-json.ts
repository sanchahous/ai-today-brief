/**
 * Shared Gemini→OpenRouter JSON-completion lane. Originally lived inside
 * verify.ts; auto-publish.ts needs the exact same fallback behaviour for its
 * own JSON-shaped LLM calls, so it moved here. Gemini's model queue is tried
 * first; on exhaustion, the OpenRouter `:free` chain takes over. `stage`
 * labels the fallback log line with the caller's pipeline stage.
 */

import { resolveGeminiModelQueue } from './gemini-models';
import { logEvent, serializeErrorDetails } from './log';
import type { OpenRouterResponseValidator } from './openrouter-brief-json';
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
  primaryProvider: 'gemini' | 'openrouter' = 'gemini',
): Promise<{ text: string; model: string | null; usage: LlmUsage | null }> {
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
