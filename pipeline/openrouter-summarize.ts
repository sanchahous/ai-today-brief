/**
 * OpenRouter chat completions for bilingual brief JSON.
 * Uses adaptive streaming (idle / first-token timeouts) by default.
 * Called by summarize.ts as a fallback when all Gemini retries are exhausted.
 */

import { logError, logEvent, serializeErrorDetails } from './log';
import { isFreeOpenRouterModel, resolveOpenRouterModelQueue } from './openrouter-models';
import { consumeFreeModelSlot } from './openrouter-free-limiter';
import {
  OpenRouterStallError,
  resolveOpenRouterAdaptiveTimeouts,
  streamOpenRouterCompletion,
  type OpenRouterRequestConfig,
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
  /**
   * Billed usage from queue attempts whose output we threw away (rejected
   * JSON, truncation, stall, rate limit). OpenRouter charges for those tokens
   * exactly like a successful call, so leaving them out of the ledger is not
   * a rounding error: on 2026-08-28 OpenRouter billed 190 calls / $8.74 while
   * `generation_cost_events` recorded 35 / $0.65, because only the model that
   * finally answered was ever booked. Callers must add these to the ledger.
   *
   * Optional only so existing test doubles of this result stay valid — the
   * real chain below always sets it, empty array included.
   */
  discardedUsage?: OpenRouterUsage[];
};

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://aitodaybrief.com',
  'X-Title': 'AI Today Brief Pipeline',
};

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

function buildChatBody(prompt: string, extraBody?: Record<string, unknown>): Record<string, unknown> {
  return {
    messages: [
      { role: 'system', content: SYSTEM_JSON },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.35,
    max_tokens: resolveOpenRouterMaxTokens(),
    usage: { include: true },
    ...extraBody,
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
  extraBody?: Record<string, unknown>,
  requestConfig?: OpenRouterRequestConfig,
): Promise<string> {
  const started = Date.now();
  const body = { ...buildChatBody(prompt, extraBody), model: modelId };

  const res = await fetchFn(requestConfig?.url ?? OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(requestConfig?.url ? {} : DEFAULT_OPENROUTER_HEADERS),
      ...requestConfig?.headers,
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
  extraBody?: Record<string, unknown>,
  requestConfig?: OpenRouterRequestConfig,
): Promise<string> {
  const timeouts = resolveOpenRouterAdaptiveTimeouts();
  const body = buildChatBody(prompt, extraBody);

  try {
    return await streamOpenRouterCompletion(
      apiKey,
      modelId,
      body,
      timeouts,
      fetch,
      validateResponse,
      onUsage,
      requestConfig,
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
      extraBody,
      requestConfig,
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
    callModel?: (key: string, modelId: string, p: string, attempt?: number) => Promise<string>;
    validateResponse?: OpenRouterResponseValidator;
    /**
     * Per-model extra request-body fields (e.g. `{ reasoning: { effort: 'low' } }`).
     * `attempt` is 1 for a model's first try and 2 when `retryTruncatedOnce`
     * re-queues it after a cut-off answer, so the caller can widen its ceiling.
     */
    extraBodyForModel?: (modelId: string, attempt: number) => Record<string, unknown> | undefined;
    /**
     * When a model's answer is cut off by max_tokens, retry the SAME model once
     * before dropping to the next one.
     *
     * Truncation used to burn the cheap model and then escalate: on 2026-08-28
     * a writer call was cut off for $0.025 and the queue fell straight through
     * to a $10/M model that cost $0.34 for the same prompt. Re-asking the model
     * that was already working, with room to finish, is both cheaper and more
     * likely to return the shape the validator wants.
     */
    retryTruncatedOnce?: boolean;
    /**
     * Points this OpenAI-compatible client at a different provider (e.g.
     * NVIDIA NIM) instead of OpenRouter. Omit both for OpenRouter's exact
     * current behavior. See pipeline/providers/http-provider.ts.
     */
    requestConfig?: OpenRouterRequestConfig;
  } = {},
): Promise<OpenRouterSummarizeResult> {
  const apiKey = options.apiKey ?? resolveOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('[openrouter] OPEN_ROUTER_API_KEY is not set');
  }

  // Copied, never aliased: the truncation retry splices a repeat entry in and
  // must not mutate the caller's array.
  const queue = [
    ...(options.modelQueue ??
      (await (options.resolveQueue ?? ((key) => resolveOpenRouterModelQueue(key)))(apiKey))),
  ];

  const validateResponse = options.validateResponse ?? validateOpenRouterBriefJson;
  // Usage reported by the attempt currently in flight. Held in an array rather
  // than a `let` because the only writer is the onUsage callback below:
  // TypeScript cannot see a closure's assignment, so a plain `let` reset to
  // `null` before the call stays narrowed to `null` inside the catch.
  const attemptUsage: OpenRouterUsage[] = [];
  const callModel =
    options.callModel ??
    /* v8 ignore next */
    ((key, modelId, p, attempt = 1) =>
      callOpenRouterAdaptive(
        key,
        modelId,
        p,
        validateResponse,
        (usage) => {
          attemptUsage.push(usage);
        },
        options.extraBodyForModel?.(modelId, attempt),
        options.requestConfig,
      ));

  const attemptErrors: Array<Record<string, unknown>> = [];
  const discardedUsage: OpenRouterUsage[] = [];
  /** How many times each model id has been tried, for `extraBodyForModel`. */
  const modelAttempts = new Map<string, number>();
  let lastError: unknown;
  const limitBackoffMs = resolveOpenRouterLimitBackoffMs();

  for (let i = 0; i < queue.length; i++) {
    const modelId = queue[i]!;
    if (isFreeOpenRouterModel(modelId) && !consumeFreeModelSlot()) {
      logEvent('warn', 'summarize', 'OpenRouter free-model rate limit — skipping to next', {
        model: modelId,
        attempt: i + 1,
        queue_length: queue.length,
      });
      continue;
    }
    const modelAttempt = (modelAttempts.get(modelId) ?? 0) + 1;
    modelAttempts.set(modelId, modelAttempt);
    logEvent('info', 'summarize', 'OpenRouter trying model', {
      model: modelId,
      attempt: i + 1,
      model_attempt: modelAttempt,
      queue_length: queue.length,
      prompt_chars: prompt.length,
    });
    try {
      attemptUsage.length = 0;
      const text = await callModel(apiKey, modelId, prompt, modelAttempt);
      return {
        text,
        provider: 'openrouter',
        model: modelId,
        usage: attemptUsage.at(-1) ?? null,
        discardedUsage,
      };
    } catch (error) {
      lastError = error;
      // The call was billed even though we are throwing its answer away —
      // record it before the next attempt clears the slot.
      const billed = attemptUsage.at(-1);
      if (billed) {
        discardedUsage.push(billed);
        logEvent('warn', 'summarize', 'OpenRouter attempt billed but discarded', {
          model: modelId,
          index: i + 1,
          cost_usd: billed.costUsd,
          prompt_tokens: billed.promptTokens,
        });
      }
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

      // Checked before the generic incomplete-JSON branch below: a cut-off
      // answer means the model ran out of room, not that it is a bad model.
      if (
        options.retryTruncatedOnce &&
        modelAttempt === 1 &&
        isOpenRouterIncompleteJsonError(error) &&
        error.finishReason === 'length'
      ) {
        queue.splice(i + 1, 0, modelId);
        logEvent('warn', 'summarize', 'OpenRouter answer cut off — retrying same model wider', {
          model: modelId,
          index: i + 1,
          response_chars: error.responseChars,
        });
        continue;
      }

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
    // Nothing usable came back, but every attempt above still went on the bill.
    discarded_calls: discardedUsage.length,
    discarded_cost_usd: discardedUsage.reduce((sum, usage) => sum + (usage.costUsd ?? 0), 0),
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
