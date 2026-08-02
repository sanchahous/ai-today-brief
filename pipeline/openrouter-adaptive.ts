/**
 * OpenRouter streaming with idle / first-token / wall-clock guards.
 * Aborts stalled models early and moves to the next in queue.
 */

import { logError, logEvent } from './log';
import { isOpenRouterLimitError, toOpenRouterLimitError } from './openrouter-errors';
import {
  isOpenRouterIncompleteJsonError,
  tryAcceptStreamedJson,
  validateOpenRouterBriefJson,
  type OpenRouterResponseValidator,
} from './openrouter-brief-json';

export type OpenRouterAdaptiveTimeouts = {
  /** Max wait for first content chunk after request start. */
  firstTokenMs: number;
  /** Abort if no new content for this long (after first token). */
  idleMs: number;
  /**
   * Absolute ceiling while tokens still arrive (full brief JSON can take 8–12 min).
   * Does NOT cut off an active stream before idleMs silence.
   */
  absoluteCeilingMs: number;
  /** Log progress every N ms while streaming. */
  progressLogMs: number;
};

export function resolveOpenRouterAdaptiveTimeouts(
  env: {
    OPENROUTER_FIRST_TOKEN_MS?: string;
    OPENROUTER_IDLE_MS?: string;
    OPENROUTER_WALL_MS?: string;
    OPENROUTER_ABSOLUTE_CEILING_MS?: string;
    OPENROUTER_PROGRESS_LOG_MS?: string;
    [key: string]: string | undefined;
  } = process.env,
): OpenRouterAdaptiveTimeouts {
  const firstTokenMs = parsePositiveInt(env.OPENROUTER_FIRST_TOKEN_MS, 90_000);
  const idleMs = parsePositiveInt(env.OPENROUTER_IDLE_MS, 45_000);
  const absoluteCeilingMs = parsePositiveInt(
    env.OPENROUTER_ABSOLUTE_CEILING_MS ?? env.OPENROUTER_WALL_MS,
    720_000,
  );
  const progressLogMs = parsePositiveInt(env.OPENROUTER_PROGRESS_LOG_MS, 15_000);
  return { firstTokenMs, idleMs, absoluteCeilingMs, progressLogMs };
}

/** Log every N characters received (visible in CI when chunks arrive quickly). */
export const STREAM_CHARS_MILESTONE = 10_000;

export function logOpenRouterStreamProgress(
  modelId: string,
  progress: StreamProgress,
  started: number,
  extra?: Record<string, unknown>,
): void {
  const now = Date.now();
  logEvent('info', 'summarize', 'OpenRouter stream progress', {
    model: modelId,
    chars: progress.chars,
    first_token_ms: progress.firstTokenMs,
    idle_ms: now - progress.lastActivityMs,
    elapsed_ms: now - started,
    ...extra,
  });
}

export function shouldLogCharsMilestone(prevChars: number, nextChars: number): boolean {
  if (nextChars === 0) return false;
  const prevBucket = Math.floor(prevChars / STREAM_CHARS_MILESTONE);
  const nextBucket = Math.floor(nextChars / STREAM_CHARS_MILESTONE);
  return nextBucket > prevBucket;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export class OpenRouterStallError extends Error {
  readonly reason: 'first_token' | 'idle' | 'wall';

  constructor(reason: OpenRouterStallError['reason'], modelId: string, detail: string) {
    super(`[openrouter] ${reason} timeout (${modelId}): ${detail}`);
    this.name = 'OpenRouterStallError';
    this.reason = reason;
  }
}

type StreamChunk = { content?: string; finishReason?: string | null; usage?: OpenRouterUsage };

/**
 * Real billed cost/tokens reported by OpenRouter (requires `usage: {include: true}`
 * in the request body). Distinct from the pipeline's own char-count cost estimate,
 * which does not reflect actual per-model pricing.
 */
export type OpenRouterUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

function parseOpenRouterUsage(raw: unknown): OpenRouterUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const usage = raw as Record<string, unknown>;
  if (typeof usage.cost !== 'number') return undefined;
  return {
    promptTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
    completionTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
    totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : 0,
    costUsd: usage.cost,
  };
}

/** Append SSE `data:` lines; returns parsed text deltas from new input. */
export function parseOpenRouterSseChunk(
  buffer: string,
  incoming: string,
): { buffer: string; chunks: StreamChunk[] } {
  const combined = buffer + incoming;
  const lines = combined.split('\n');
  const remainder = lines.pop() ?? '';
  const chunks: StreamChunk[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const json = JSON.parse(payload) as {
        choices?: Array<{
          delta?: { content?: string };
          finish_reason?: string | null;
        }>;
        usage?: unknown;
        error?: { message?: string; code?: unknown };
      };
      if (json.error?.message) {
        chunks.push({
          content: undefined,
          finishReason: `error:${json.error.code ?? ''}:${json.error.message}`,
        });
        continue;
      }
      const usage = parseOpenRouterUsage(json.usage);
      const choice = json.choices?.[0];
      const content = choice?.delta?.content;
      if (content) chunks.push({ content, finishReason: choice?.finish_reason ?? null, usage });
      else if (choice?.finish_reason) chunks.push({ finishReason: choice.finish_reason, usage });
      else if (usage) chunks.push({ usage });
    } catch {
      // partial JSON line — keep in buffer via remainder
    }
  }

  return { buffer: remainder, chunks };
}

export type StreamProgress = {
  content: string;
  chars: number;
  firstTokenMs: number | null;
  lastActivityMs: number;
  startedMs: number;
};

export function createStreamProgress(now = Date.now()): StreamProgress {
  return { content: '', chars: 0, firstTokenMs: null, lastActivityMs: now, startedMs: now };
}

export function applyStreamChunks(
  progress: StreamProgress,
  chunks: StreamChunk[],
  now = Date.now(),
): StreamProgress {
  let { content, chars, firstTokenMs, lastActivityMs } = progress;
  for (const chunk of chunks) {
    if (chunk.content) {
      content += chunk.content;
      chars = content.length;
      if (firstTokenMs === null) firstTokenMs = now - progress.startedMs;
      lastActivityMs = now;
    }
  }
  return { content, chars, firstTokenMs, lastActivityMs, startedMs: progress.startedMs };
}

export function checkStreamStall(
  progress: StreamProgress,
  timeouts: OpenRouterAdaptiveTimeouts,
  now = Date.now(),
): OpenRouterStallError | null {
  const elapsed = now - progress.startedMs;
  const idleFor = now - progress.lastActivityMs;

  if (progress.chars === 0 && elapsed >= timeouts.firstTokenMs) {
    return new OpenRouterStallError(
      'first_token',
      '',
      `no token in ${elapsed}ms (limit ${timeouts.firstTokenMs}ms)`,
    );
  }

  if (progress.chars > 0 && idleFor >= timeouts.idleMs) {
    return new OpenRouterStallError(
      'idle',
      '',
      `idle ${idleFor}ms >= ${timeouts.idleMs}ms, chars=${progress.chars}`,
    );
  }

  if (elapsed >= timeouts.absoluteCeilingMs) {
    return new OpenRouterStallError(
      'wall',
      '',
      `absolute ceiling ${elapsed}ms >= ${timeouts.absoluteCeilingMs}ms, chars=${progress.chars}`,
    );
  }

  return null;
}

export type FetchStreamFn = (url: string, init: RequestInit) => Promise<Response>;

/* v8 ignore start -- live streaming; pure helpers above are unit-tested */

/** Stream chat completion; abort via signal when stalled. */
export async function streamOpenRouterCompletion(
  apiKey: string,
  modelId: string,
  body: Record<string, unknown>,
  timeouts: OpenRouterAdaptiveTimeouts,
  fetchFn: FetchStreamFn = fetch,
  validateResponse: OpenRouterResponseValidator = validateOpenRouterBriefJson,
  onUsage?: (usage: OpenRouterUsage) => void,
): Promise<string> {
  const started = Date.now();
  const controller = new AbortController();
  let sseBuffer = '';
  let progress = createStreamProgress(started);
  const requestBody = { ...body, model: modelId, stream: true, usage: { include: true } };

  logEvent('info', 'summarize', 'OpenRouter adaptive stream starting', {
    model: modelId,
    first_token_ms: timeouts.firstTokenMs,
    idle_ms: timeouts.idleMs,
    absolute_ceiling_ms: timeouts.absoluteCeilingMs,
  });

  const res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aitodaybrief.com',
      'X-Title': 'AI Today Brief Pipeline',
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  });

  if (!res.ok) {
    const raw = await res.text();
    let apiMessage = raw.slice(0, 400);
    let apiCode: unknown;
    try {
      const errJson = JSON.parse(raw) as { error?: { message?: string; code?: unknown } };
      apiMessage = errJson.error?.message ?? apiMessage;
      apiCode = errJson.error?.code;
    } catch {
      // non-JSON error body
    }
    const limitErr = toOpenRouterLimitError(modelId, {
      httpStatus: res.status,
      message: apiMessage,
      code: apiCode,
    });
    if (limitErr) throw limitErr;
    throw new Error(`[openrouter] HTTP ${res.status} (${modelId}): ${apiMessage}`);
  }

  if (!res.body) {
    throw new Error(`[openrouter] empty body (${modelId})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
  let lastFinishReason: string | null = null;
  const progressState = { current: progress };

  const heartbeat = setInterval(() => {
    const p = progressState.current;
    logOpenRouterStreamProgress(modelId, p, started, { source: 'heartbeat' });
    const stall = checkStreamStall(p, timeouts, Date.now());
    if (stall) {
      controller.abort();
    }
  }, timeouts.progressLogMs);

  try {
    while (true) {
      const stall = checkStreamStall(progressState.current, timeouts, Date.now());
      if (stall) {
        const salvaged = tryAcceptStreamedJson(progressState.current.content, validateResponse);
        if (salvaged) {
          controller.abort();
          return salvaged;
        }
        controller.abort();
        throw new OpenRouterStallError(stall.reason, modelId, stall.message);
      }

      if (!pendingRead) {
        pendingRead = reader.read();
      }

      const winner = await Promise.race([
        pendingRead,
        sleep(2_000).then((): null => null),
      ]);

      if (winner === null) {
        const stallOnTick = checkStreamStall(progressState.current, timeouts, Date.now());
        if (stallOnTick) {
          controller.abort();
          const salvaged = tryAcceptStreamedJson(progressState.current.content, validateResponse);
          if (salvaged) return salvaged;
          throw new OpenRouterStallError(stallOnTick.reason, modelId, stallOnTick.message);
        }
        continue;
      }

      pendingRead = null;
      const { done, value } = winner;
      if (done) break;

      const prevChars = progressState.current.chars;
      const parsed = parseOpenRouterSseChunk(sseBuffer, decoder.decode(value, { stream: true }));
      sseBuffer = parsed.buffer;
      progressState.current = applyStreamChunks(progressState.current, parsed.chunks, Date.now());
      progress = progressState.current;

      if (progress.firstTokenMs !== null && prevChars === 0) {
        logOpenRouterStreamProgress(modelId, progress, started, { source: 'first_token' });
      }

      if (shouldLogCharsMilestone(prevChars, progress.chars)) {
        logOpenRouterStreamProgress(modelId, progress, started, {
          source: 'chars_milestone',
          milestone: Math.floor(progress.chars / STREAM_CHARS_MILESTONE) * STREAM_CHARS_MILESTONE,
        });
      }

      for (const chunk of parsed.chunks) {
        if (chunk.usage) onUsage?.(chunk.usage);
        if (chunk.finishReason && !chunk.finishReason.startsWith('error:')) {
          lastFinishReason = chunk.finishReason;
        }
        if (chunk.finishReason?.startsWith('error:')) {
          const payload = chunk.finishReason.slice(6);
          const colon = payload.indexOf(':');
          const code = colon >= 0 ? payload.slice(0, colon) : undefined;
          const message = colon >= 0 ? payload.slice(colon + 1) : payload;
          const limitErr = toOpenRouterLimitError(modelId, { message, code });
          if (limitErr) throw limitErr;
          throw new Error(`[openrouter] stream error (${modelId}): ${message}`);
        }
      }
    }
  } catch (error) {
    if (isOpenRouterIncompleteJsonError(error)) {
      logError('summarize', 'OpenRouter incomplete JSON during stream', error, {
        model: modelId,
        response_chars: error.responseChars,
        finish_reason: error.finishReason,
      });
      throw error;
    }
    if (isOpenRouterLimitError(error)) {
      logError('summarize', 'OpenRouter model hit limit during stream', error, {
        model: modelId,
        limit_kind: error.kind,
        http_status: error.httpStatus,
        chars_before_limit: progressState.current.chars,
      });
      throw error;
    }
    const salvaged = tryAcceptStreamedJson(progressState.current.content, validateResponse);
    const aborted =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('aborted'));
    if (salvaged && (error instanceof OpenRouterStallError || aborted)) {
      logEvent('info', 'summarize', 'OpenRouter stream salvaged JSON after abort', {
        model: modelId,
        response_chars: salvaged.length,
      });
      return salvaged;
    }
    if (error instanceof OpenRouterStallError) {
      logError('summarize', 'OpenRouter stream stalled — switching model', error, {
        model: modelId,
        reason: error.reason,
        chars: progressState.current.chars,
        duration_ms: Date.now() - started,
      });
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  const text = progressState.current.content.trim();
  if (!text) {
    throw new OpenRouterStallError('first_token', modelId, 'stream ended with empty content');
  }

  const validated = validateResponse(modelId, text, lastFinishReason);

  logEvent('info', 'summarize', 'OpenRouter adaptive stream complete', {
    model: modelId,
    response_chars: validated.length,
    first_token_ms: progress.firstTokenMs,
    finish_reason: lastFinishReason,
    duration_ms: Date.now() - started,
  });

  return validated;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* v8 ignore end */
