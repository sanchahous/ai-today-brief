/**
 * Shared Gemini→OpenRouter JSON-completion lane. Originally lived inside
 * verify.ts; dedup-scan.ts and auto-publish.ts need the exact same
 * fallback behaviour for their own JSON-shaped LLM calls, so it moved here.
 * Gemini's model queue is tried first; on exhaustion, the OpenRouter `:free`
 * chain takes over. `stage` labels the fallback log line with the caller's
 * pipeline stage.
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

/* v8 ignore start -- thin provider plumbing; callers are integration-covered */
/** Gemini queue first; on exhaustion, the OpenRouter `:free` chain. */
export async function generateJsonWithFallback(
  stage: string,
  prompt: string,
  apiKey: string,
  geminiMaxAttempts: number,
  schema: GeminiResponseSchema,
  openRouterApiKey?: string,
): Promise<{ text: string; model: string | null; usage: LlmUsage | null }> {
  const modelQueue = await resolveGeminiModelQueue(apiKey);
  try {
    return await generateWithModelQueue(
      prompt,
      apiKey,
      modelQueue,
      geminiMaxAttempts,
      undefined,
      undefined,
      schema,
    );
  } catch (geminiError) {
    if (!openRouterApiKey) throw geminiError;
    logEvent('warn', stage, 'Gemini queue exhausted — OpenRouter fallback', {
      ...serializeErrorDetails(geminiError),
    });
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
  }
}
/* v8 ignore end */
