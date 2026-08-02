/**
 * OpenRouter chat completions for bilingual brief JSON.
 * Uses adaptive streaming (idle / first-token timeouts) by default.
 * Called by summarize.ts as a fallback when all Gemini retries are exhausted.
 */

import { logError, logEvent, serializeErrorDetails } from './log';
import { resolveOpenRouterModelQueue } from './openrouter-models';
import {
  OpenRouterStallError,
  resolveOpenRouterAdaptiveTimeouts,
  streamOpenRouterCompletion,
  type OpenRouterUsage,
} from './openrouter-adaptive';
import {
  isOpenRouterLimitError,
  resolveOpenRouterLimitBackoffMs,
  summarizeLimitFailureHint,
  toOpenRouterLimitError,
} from './openrouter-errors';
import {
  isOpenRouterIncompleteJsonError,
  validateOpenRouterBriefJson,
  type OpenRouterResponseValidator,
} from './openrouter-brief-json';

export type OpenRouterSummarizeResult = {
  text: string;
  provider: 'openrouter';
  model: string;
  /** Real billed cost from OpenRouter, when the provider reported it. */
  usage: OpenRouterUsage | null;
};

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function resolveOpenRouterApiKey(
  env: { OPEN_ROUTER_API_KEY?: string; OPENROUTER_API_KEY?: string; [key: string]: string | undefined } = process.env,
): string | null {
  const key = env.OPEN_ROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

const SYSTEM_JSON =
  'You are a precise JSON generator for a bilingual news brief. Reply with one valid JSON object only — no markdown fences, no commentary.';

export function resolveOpenRouterMaxTokens(
  env: { OPENROUTER_MAX_TOKENS?: string; [key: string]: string | undefined } = process.env,
) {
  const parsed = Number.parseInt(env.OPENROUTER_MAX_TOKENS ?? '32768', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 32768;
}

function buildChatBody(prompt: string): Record<string, unknown> {
  return {
    messages: [
      { role: 'system', content: SYSTEM_JSON },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.35,
    max_tokens: resolveOpenRouterMaxTokens(),
    usage: { include: true },
  };
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: unknown;
  error?: { message?: string; code?: unknown };
};

export function parseChatCompletionUsage(raw: unknown): OpenRouterUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const usage = raw as Record<string, unknown>;
  if (typeof usage.cost !== 'number') return null;
  return {
    promptTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
    completionTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
    totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : 0,
    costUsd: usage.cost,
  };
}

/* v8 ignore start -- live network: chain logic is unit-tested via injected deps */

/** Non-streaming fallback when provider rejects stream. */
export async function callOpenRouterJson(
  apiKey: string,
  modelId: string,
  prompt: string,
  timeoutMs: number,
  fetchFn: typeof fetch = fetch,
  validateResponse: OpenRouterResponseValidator = validateOpenRouterBriefJson,
  onUsage?: (usage: OpenRouterUsage) => void,
): Promise<string> {
  const started = Date.now();
  const body = { ...buildChatBody(prompt), model: modelId };

  const res = await fetchFn(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aitodaybrief.com',
      'X-Title': 'AI Today Brief Pipeline',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await res.text();
  let json: ChatCompletionResponse;
  try {
    json = JSON.parse(raw) as ChatCompletionResponse;
  } catch {
    throw new Error(`[openrouter] Non-JSON HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }

  if (!res.ok) {
    const apiMsg = json.error?.message ?? raw.slice(0, 300);
    const limitErr = toOpenRouterLimitError(modelId, {
      httpStatus: res.status,
      message: apiMsg,
      code: json.error?.code,
    });
    if (limitErr) throw limitErr;
    throw new Error(`[openrouter] HTTP ${res.status} (${modelId}): ${apiMsg}`);
  }

  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error(`[openrouter] Empty completion from ${modelId}`);
  }

  const usage = parseChatCompletionUsage(json.usage);
  if (usage) onUsage?.(usage);

  logEvent('info', 'summarize', 'OpenRouter non-stream completion ok', {
    model: modelId,
    response_chars: text.length,
    duration_ms: Date.now() - started,
  });

  return validateResponse(modelId, text, null);
}

/** Adaptive stream; stall → non-stream fallback on the same model; then next model. */
export async function callOpenRouterAdaptive(
  apiKey: string,
  modelId: string,
  prompt: string,
  validateResponse: OpenRouterResponseValidator = validateOpenRouterBriefJson,
  onUsage?: (usage: OpenRouterUsage) => void,
): Promise<string> {
  const timeouts = resolveOpenRouterAdaptiveTimeouts();
  const body = buildChatBody(prompt);

  try {
    return await streamOpenRouterCompletion(
      apiKey,
      modelId,
      body,
      timeouts,
      fetch,
      validateResponse,
      onUsage,
    );
  } catch (streamError) {
    if (streamError instanceof OpenRouterStallError) {
      throw streamError;
    }
    const msg = streamError instanceof Error ? streamError.message.toLowerCase() : '';
    const streamUnsupported =
      msg.includes('stream') &&
      (msg.includes('not support') || msg.includes('unsupported') || msg.includes('invalid'));
    if (!streamUnsupported) {
      logError('summarize', 'OpenRouter adaptive stream failed', streamError, { model: modelId });
      throw streamError;
    }
    logEvent('warn', 'summarize', 'OpenRouter stream unsupported — non-stream fallback', {
      model: modelId,
    });
    return callOpenRouterJson(
      apiKey,
      modelId,
      prompt,
      timeouts.absoluteCeilingMs,
      fetch,
      validateResponse,
      onUsage,
    );
  }
}

/* v8 ignore end */

/** Try ranked OpenRouter models until one returns valid JSON text. */
export async function generateWithOpenRouterChain(
  prompt: string,
  options: {
    apiKey?: string;
    modelQueue?: string[];
    resolveQueue?: (key: string) => Promise<string[]>;
    callModel?: (key: string, modelId: string, p: string) => Promise<string>;
    validateResponse?: OpenRouterResponseValidator;
  } = {},
): Promise<OpenRouterSummarizeResult> {
  const apiKey = options.apiKey ?? resolveOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('[openrouter] OPEN_ROUTER_API_KEY is not set');
  }

  const queue =
    options.modelQueue ??
    (await (options.resolveQueue ?? ((key) => resolveOpenRouterModelQueue(key)))(apiKey));

  const validateResponse = options.validateResponse ?? validateOpenRouterBriefJson;
  let lastUsage: OpenRouterUsage | null;
  const callModel =
    options.callModel ??
    /* v8 ignore next */
    ((key, modelId, p) =>
      callOpenRouterAdaptive(key, modelId, p, validateResponse, (usage) => {
        lastUsage = usage;
      }));

  const attemptErrors: Array<Record<string, unknown>> = [];
  let lastError: unknown;
  const limitBackoffMs = resolveOpenRouterLimitBackoffMs();

  for (let i = 0; i < queue.length; i++) {
    const modelId = queue[i]!;
    logEvent('info', 'summarize', 'OpenRouter trying model', {
      model: modelId,
      attempt: i + 1,
      queue_length: queue.length,
      prompt_chars: prompt.length,
    });
    try {
      lastUsage = null;
      const text = await callModel(apiKey, modelId, prompt);
      return { text, provider: 'openrouter', model: modelId, usage: lastUsage };
    } catch (error) {
      lastError = error;
      const limitKind = isOpenRouterLimitError(error) ? error.kind : undefined;
      const incomplete = isOpenRouterIncompleteJsonError(error);
      const entry: Record<string, unknown> = {
        index: i + 1,
        model: modelId,
        stall: error instanceof OpenRouterStallError ? error.reason : undefined,
        limit_kind: limitKind,
        incomplete_json: incomplete,
        action: limitKind || incomplete ? 'skip_try_next_model' : undefined,
        ...serializeErrorDetails(error),
      };
      if (isOpenRouterLimitError(error)) {
        entry.http_status = error.httpStatus;
        entry.provider_code = error.providerCode;
      }
      attemptErrors.push(entry);

      if (isOpenRouterIncompleteJsonError(error)) {
        logEvent('warn', 'summarize', 'OpenRouter incomplete JSON — trying next model', {
          model: modelId,
          index: i + 1,
          queue_length: queue.length,
          response_chars: error.responseChars,
          parse_detail: error.parseDetail,
          finish_reason: error.finishReason,
        });
        continue;
      }

      if (isOpenRouterLimitError(error)) {
        logEvent('warn', 'summarize', 'OpenRouter model hit limit — trying next', {
          model: modelId,
          index: i + 1,
          queue_length: queue.length,
          limit_kind: error.kind,
          http_status: error.httpStatus,
          backoff_ms: i < queue.length - 1 ? limitBackoffMs : 0,
        });
        if (i < queue.length - 1 && limitBackoffMs > 0) {
          await sleep(limitBackoffMs);
        }
        continue;
      }

      logEvent('warn', 'summarize', 'OpenRouter model failed, trying next', {
        model: modelId,
        index: i + 1,
        queue_length: queue.length,
        stall: error instanceof OpenRouterStallError ? error.reason : undefined,
      });
    }
  }

  const limitHint = summarizeLimitFailureHint(
    attemptErrors as Array<{ limit_kind?: string }>,
  );

  logError('summarize', 'OpenRouter exhausted all models', lastError, {
    models_tried: queue.length,
    attempt_history: attemptErrors,
    limit_hint: limitHint,
  });

  const base =
    lastError instanceof Error ? lastError.message : '[openrouter] all models failed';
  throw new Error(limitHint ? `${base} — ${limitHint}` : base);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
