/**
 * Thin adapter over the existing Gemini client (resolveGeminiModelQueue +
 * generateWithModelQueue, both in pipeline/gemini-models.ts / summarize.ts)
 * so it can be dispatched through the same ProviderCallResult shape as the
 * HTTP and CLI adapters. Gemini uses Google's own SDK, not raw HTTP -- it
 * does not fit the generic OpenAI-compatible shape and always needs this
 * special-cased client regardless of registry design. See
 * wiki/pipeline/llm-providers.md.
 */

import { resolveGeminiModelQueue } from '../gemini-models';
import { generateWithModelQueue, type GeminiResponseSchema } from '../summarize';
import { ProviderUnavailableError, type ProviderCallResult } from './types';

export interface GeminiProviderConfig {
  apiKey: string;
  maxModelAttempts?: number;
  schema?: GeminiResponseSchema;
}

export async function generateWithGemini(
  prompt: string,
  cfg: GeminiProviderConfig,
): Promise<ProviderCallResult> {
  if (!cfg.apiKey) throw new ProviderUnavailableError('gemini', 'GEMINI_API_KEY is not set');

  const modelQueue = await resolveGeminiModelQueue(cfg.apiKey);
  const result = await generateWithModelQueue(
    prompt,
    cfg.apiKey,
    modelQueue,
    cfg.maxModelAttempts ?? 2,
    undefined,
    undefined,
    cfg.schema,
  );
  return {
    text: result.text,
    provider: 'gemini',
    model: result.model,
    usage: {
      promptTokens: result.usage?.promptTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      costUsd: null,
      costSource: 'estimated',
    },
  };
}
