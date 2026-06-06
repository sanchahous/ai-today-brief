/**
 * OpenRouter quota / rate-limit detection.
 * When a model cannot finish due to limits, we skip it and try the next in queue.
 */

export const OpenRouterLimitKind = {
  rate_limit: 'rate_limit',
  insufficient_credits: 'insufficient_credits',
  quota: 'quota',
  provider_capacity: 'provider_capacity',
} as const;

export type OpenRouterLimitKind = (typeof OpenRouterLimitKind)[keyof typeof OpenRouterLimitKind];

export class OpenRouterLimitError extends Error {
  readonly kind: OpenRouterLimitKind;
  readonly modelId: string;
  readonly httpStatus?: number;
  readonly providerCode?: string;

  constructor(
    kind: OpenRouterLimitKind,
    modelId: string,
    message: string,
    options: { httpStatus?: number; providerCode?: string } = {},
  ) {
    super(`[openrouter] ${kind} (${modelId}): ${message}`);
    this.name = 'OpenRouterLimitError';
    this.kind = kind;
    this.modelId = modelId;
    this.httpStatus = options.httpStatus;
    this.providerCode = options.providerCode;
  }
}

export function isOpenRouterLimitError(error: unknown): error is OpenRouterLimitError {
  return error instanceof OpenRouterLimitError;
}

export type ClassifiedOpenRouterFailure = {
  isLimit: boolean;
  kind?: OpenRouterLimitKind;
};

/** Classify HTTP body / SSE error text from OpenRouter or upstream providers. */
export function classifyOpenRouterFailure(input: {
  httpStatus?: number;
  message?: string;
  code?: string;
}): ClassifiedOpenRouterFailure {
  const msg = (input.message ?? '').toLowerCase();
  const code = (input.code ?? '').toLowerCase();
  const status = input.httpStatus;

  if (
    status === 402 ||
    msg.includes('insufficient credit') ||
    msg.includes('insufficient balance') ||
    msg.includes('not enough credit') ||
    msg.includes('payment required') ||
    msg.includes('add credits') ||
    msg.includes('billing') ||
    code.includes('insufficient')
  ) {
    return { isLimit: true, kind: OpenRouterLimitKind.insufficient_credits };
  }

  if (
    status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests') ||
    msg.includes('requests per minute') ||
    msg.includes('rpm') ||
    code.includes('rate')
  ) {
    return { isLimit: true, kind: OpenRouterLimitKind.rate_limit };
  }

  if (
    msg.includes('quota') ||
    msg.includes('limit exceeded') ||
    msg.includes('usage limit') ||
    msg.includes('daily limit') ||
    code.includes('quota')
  ) {
    return { isLimit: true, kind: OpenRouterLimitKind.quota };
  }

  if (
    status === 503 ||
    msg.includes('overloaded') ||
    msg.includes('capacity') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('server busy')
  ) {
    return { isLimit: true, kind: OpenRouterLimitKind.provider_capacity };
  }

  return { isLimit: false };
}

export function toOpenRouterLimitError(
  modelId: string,
  input: { httpStatus?: number; message?: string; code?: string },
): OpenRouterLimitError | null {
  const classified = classifyOpenRouterFailure(input);
  if (!classified.isLimit || !classified.kind) return null;
  const detail = input.message?.trim() || classified.kind;
  return new OpenRouterLimitError(classified.kind, modelId, detail, {
    httpStatus: input.httpStatus,
    providerCode: input.code,
  });
}

export function resolveOpenRouterLimitBackoffMs(
  env: { OPENROUTER_LIMIT_BACKOFF_MS?: string; [key: string]: string | undefined } = process.env,
): number {
  const parsed = Number.parseInt(env.OPENROUTER_LIMIT_BACKOFF_MS ?? '4000', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 4000;
}

/** User-facing hint when every model failed due to account limits. */
export function summarizeLimitFailureHint(
  attemptErrors: Array<{ limit_kind?: string }>,
): string | undefined {
  const kinds = new Set(
    attemptErrors.map((e) => e.limit_kind).filter((k): k is string => Boolean(k)),
  );
  if (kinds.has(OpenRouterLimitKind.insufficient_credits)) {
    return 'OpenRouter account may be out of credits — top up at openrouter.ai/settings/credits';
  }
  if (kinds.has(OpenRouterLimitKind.rate_limit) || kinds.has(OpenRouterLimitKind.quota)) {
    return 'OpenRouter or upstream provider rate limits hit on all tried models — retry later or reduce OPENROUTER_MAX_MODEL_ATTEMPTS';
  }
  if (kinds.size > 0) {
    return 'All OpenRouter models hit provider limits — see attempt_history in pipeline_runs.meta';
  }
  return undefined;
}
