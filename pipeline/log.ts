/**
 * Structured JSON logging for the daily pipeline.
 *
 * One JSON object per line so Vercel/GitHub-Actions log drains stay greppable.
 * Never log secrets or full prompts (see `00-core.mdc` › Pipeline). `logError`
 * folds an unknown error into safe, structured fields.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type PipelineStage =
  | 'fetch'
  | 'rank'
  | 'summarize'
  | 'publish'
  | 'dedup'
  | 'enrich'
  | 'verify';

const ERROR_STACK_MAX_CHARS = 1200;

/** Structured error fields for JSON logs (no secrets). */
export function serializeErrorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error_message: String(error), error_type: typeof error };
  }

  const out: Record<string, unknown> = {
    error_message: error.message,
    error_name: error.name,
  };

  if (error.cause !== undefined) {
    out.error_cause =
      error.cause instanceof Error ? serializeErrorDetails(error.cause) : String(error.cause);
  }

  if (error.stack) {
    out.error_stack = error.stack.slice(0, ERROR_STACK_MAX_CHARS);
  }

  const lower = error.message.toLowerCase();
  if (lower.includes('googlegenerativeai') || lower.includes('generativelanguage.googleapis.com')) {
    out.error_source = 'google_generative_ai';
  }

  const statusFromBracket = error.message.match(/\[(\d{3})\s/);
  const statusLoose = error.message.match(/\b([45]\d{2})\b/);
  const status = statusFromBracket?.[1] ?? statusLoose?.[1];
  if (status) out.http_status_hint = status;

  if (lower.includes('fetch failed')) out.failure_kind = 'network_fetch_failed';
  if (lower.includes('rate limit') || lower.includes('429')) out.failure_kind = 'rate_limit';
  if (lower.includes('resource exhausted')) out.failure_kind = 'quota_exhausted';

  return out;
}

export function logEvent(
  level: LogLevel,
  stage: string,
  message: string,
  meta: Record<string, unknown> = {},
): void {
  const payload = { ts: new Date().toISOString(), level, stage, message, ...meta };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logError(
  stage: string,
  message: string,
  error: unknown,
  meta: Record<string, unknown> = {},
): void {
  logEvent('error', stage, message, { ...meta, ...serializeErrorDetails(error) });
}
