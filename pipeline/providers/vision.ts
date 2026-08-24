/**
 * Multimodal (vision) generation for content-sim image critics.
 * Prefer Gemini generateContent with inline image; fall back to OpenRouter
 * chat/completions with an image_url data URL. Kept outside registry's
 * text-only generateWithRegistry so existing call sites stay untouched.
 */

import { ProviderUnavailableError, type ProviderCallResult } from './types';
import type { ProviderRole } from './registry';

export const VISION_PROVIDER_ROLES = ['weekly.image_critic', 'daily.image_critic'] as const;
export type VisionProviderRole = (typeof VISION_PROVIDER_ROLES)[number];

export function isVisionProviderRole(role: ProviderRole | string): role is VisionProviderRole {
  return (VISION_PROVIDER_ROLES as readonly string[]).includes(role);
}

export interface VisionGenerateInput {
  prompt: string;
  imageBytes: Buffer;
  mimeType?: string;
  /** Prefer this Gemini model id when using Gemini. */
  geminiModel?: string;
  /** Prefer this OpenRouter model id when using OpenRouter. */
  openRouterModel?: string;
  /** A hard response ceiling for budgeted single-attempt callers. */
  maxOutputTokens?: number;
  timeoutMs?: number;
}

function resolveOpenRouterKey(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.OPEN_ROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim() || undefined;
}

async function generateGeminiVision(
  input: VisionGenerateInput,
  apiKey: string,
): Promise<ProviderCallResult> {
  const model =
    input.geminiModel?.trim() ||
    process.env.CONTENT_SIM_VISION_GEMINI_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    'gemini-2.5-flash';
  const mime = input.mimeType?.trim() || 'image/jpeg';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: input.prompt },
              {
                inline_data: {
                  mime_type: mime,
                  data: input.imageBytes.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          maxOutputTokens: input.maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini vision HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('Gemini vision returned empty text');
  return {
    text,
    provider: 'gemini',
    model,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
      costUsd: null,
      costSource: 'estimated',
    },
  };
}

async function generateOpenRouterVision(
  input: VisionGenerateInput,
  apiKey: string,
): Promise<ProviderCallResult> {
  const model =
    input.openRouterModel?.trim() ||
    process.env.CONTENT_SIM_VISION_OPENROUTER_MODEL?.trim() ||
    'google/gemini-2.5-flash';
  const mime = input.mimeType?.trim() || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${input.imageBytes.toString('base64')}`;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://aitodaybrief.com',
      'X-Title': 'AI Today Brief Content Sim',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: input.maxOutputTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: input.prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter vision HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  let text = '';
  if (typeof content === 'string') text = content;
  else if (Array.isArray(content)) {
    text = content.map((part) => (typeof part.text === 'string' ? part.text : '')).join('');
  }
  if (!text.trim()) throw new Error('OpenRouter vision returned empty text');
  return {
    text,
    provider: 'openrouter',
    model: data.model ?? model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
      costUsd: typeof data.usage?.cost === 'number' ? data.usage.cost : null,
      costSource: typeof data.usage?.cost === 'number' ? 'reported' : 'estimated',
    },
  };
}

/**
 * Walks Gemini → OpenRouter for a vision critique. Throws RegistryExhausted-style
 * Error if both are unconfigured or fail.
 */
export async function generateWithVision(
  _role: VisionProviderRole,
  input: VisionGenerateInput,
  env: Record<string, string | undefined> = process.env,
): Promise<ProviderCallResult> {
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openRouterKey = resolveOpenRouterKey(env);
  const errors: string[] = [];

  if (geminiKey) {
    try {
      return await generateGeminiVision(input, geminiKey);
    } catch (error) {
      errors.push(`gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    errors.push('gemini: GEMINI_API_KEY is not set');
  }

  if (openRouterKey) {
    try {
      return await generateOpenRouterVision(input, openRouterKey);
    } catch (error) {
      errors.push(`openrouter: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    errors.push('openrouter: OPEN_ROUTER_API_KEY is not set');
  }

  if (!geminiKey && !openRouterKey) {
    throw new ProviderUnavailableError('vision', errors.join(' | '));
  }
  throw new Error(`[vision] every provider failed for role '${_role}' -- ${errors.join(' | ')}`);
}

const DAILY_VISUAL_BUDGETED_VISION_GEMINI_MODEL = 'gemini-2.5-flash';
const DAILY_VISUAL_BUDGETED_VISION_OPENROUTER_MODEL = 'google/gemini-2.5-flash';
const DAILY_VISUAL_BUDGETED_VISION_MAX_OUTPUT_TOKENS = 900;

/**
 * Daily automatic publishing uses exactly one vision provider request per QA
 * stage. Unlike generateWithVision, this function never falls through from a
 * potentially billed failed Gemini request to OpenRouter (or vice versa).
 */
export async function generateWithVisionSingleAttempt(
  role: VisionProviderRole,
  input: VisionGenerateInput,
  env: Record<string, string | undefined> = process.env,
): Promise<ProviderCallResult> {
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openRouterKey = resolveOpenRouterKey(env);
  const boundedInput: VisionGenerateInput = {
    ...input,
    geminiModel: DAILY_VISUAL_BUDGETED_VISION_GEMINI_MODEL,
    openRouterModel: DAILY_VISUAL_BUDGETED_VISION_OPENROUTER_MODEL,
    maxOutputTokens: DAILY_VISUAL_BUDGETED_VISION_MAX_OUTPUT_TOKENS,
  };
  // OpenRouter is first only as a configuration choice: it reports usage.cost
  // when successful. A failure ends this stage; it is not a fallback ladder.
  if (openRouterKey) return generateOpenRouterVision(boundedInput, openRouterKey);
  if (geminiKey) return generateGeminiVision(boundedInput, geminiKey);
  throw new ProviderUnavailableError(
    `daily-single-vision:${role}`,
    'OPEN_ROUTER_API_KEY/OPENROUTER_API_KEY or GEMINI_API_KEY is not set',
  );
}
