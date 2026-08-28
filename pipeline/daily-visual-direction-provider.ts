import { ProviderUnavailableError, type ProviderCallResult } from './providers/types';

const OPENROUTER_DIRECTION_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DAILY_VISUAL_DIRECTION_OPENROUTER_MODEL = 'google/gemini-2.5-flash';
export const DAILY_VISUAL_DIRECTION_GEMINI_MODEL = 'gemini-2.5-flash';
export const DAILY_VISUAL_DIRECTION_MAX_OUTPUT_TOKENS = 900;

type OpenRouterDirectionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
};

type GeminiDirectionResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

function openRouterKey(env: Record<string, string | undefined>): string | undefined {
  return env.OPEN_ROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim() || undefined;
}

function boundedText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Daily visual direction provider returned empty text.');
  }
  return value.trim();
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(
      `Daily visual direction provider returned invalid JSON (HTTP ${response.status}).`,
    );
  }
}

async function openRouterDirection(
  prompt: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<ProviderCallResult> {
  const response = await fetchImpl(OPENROUTER_DIRECTION_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://aitodaybrief.com',
      'X-Title': 'AI Today Brief Daily Visual',
    },
    body: JSON.stringify({
      model: DAILY_VISUAL_DIRECTION_OPENROUTER_MODEL,
      temperature: 0.2,
      max_tokens: DAILY_VISUAL_DIRECTION_MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      usage: { include: true },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const raw = (await readJson(response)) as OpenRouterDirectionResponse;
  if (!response.ok) {
    throw new Error(`OpenRouter daily visual direction HTTP ${response.status}.`);
  }
  return {
    text: boundedText(raw.choices?.[0]?.message?.content),
    provider: 'openrouter',
    model: raw.model ?? DAILY_VISUAL_DIRECTION_OPENROUTER_MODEL,
    usage: {
      promptTokens: raw.usage?.prompt_tokens ?? null,
      outputTokens: raw.usage?.completion_tokens ?? null,
      costUsd: typeof raw.usage?.cost === 'number' ? raw.usage.cost : null,
      costSource: typeof raw.usage?.cost === 'number' ? 'reported' : 'estimated',
    },
  };
}

async function geminiDirection(
  prompt: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<ProviderCallResult> {
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${DAILY_VISUAL_DIRECTION_GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          maxOutputTokens: DAILY_VISUAL_DIRECTION_MAX_OUTPUT_TOKENS,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  const raw = (await readJson(response)) as GeminiDirectionResponse;
  if (!response.ok) {
    throw new Error(`Gemini daily visual direction HTTP ${response.status}.`);
  }
  return {
    text: boundedText(raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')),
    provider: 'gemini',
    model: DAILY_VISUAL_DIRECTION_GEMINI_MODEL,
    usage: {
      promptTokens: raw.usageMetadata?.promptTokenCount ?? null,
      outputTokens: raw.usageMetadata?.candidatesTokenCount ?? null,
      costUsd: null,
      costSource: 'estimated',
    },
  };
}

/**
 * One deliberate paid direction request, never a registry/provider/model
 * ladder. OpenRouter is preferred because it reports usage.cost; Gemini is a
 * single-request fallback only when OpenRouter is not configured, never after
 * an attempted provider call.
 */
export async function generateDailyVisualDirectionSingleAttempt(
  prompt: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderCallResult> {
  const routerKey = openRouterKey(env);
  if (routerKey) return openRouterDirection(prompt, routerKey, fetchImpl);
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) return geminiDirection(prompt, geminiKey, fetchImpl);
  throw new ProviderUnavailableError(
    'daily-visual-direction',
    'OPEN_ROUTER_API_KEY/OPENROUTER_API_KEY or GEMINI_API_KEY is not set',
  );
}
