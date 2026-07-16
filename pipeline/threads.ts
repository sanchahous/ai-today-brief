/**
 * Minimal Threads publishing adapter. It deliberately owns only the two-step
 * text publication protocol; scheduling, editorial approval and retries stay
 * in the existing pipeline so every channel shares one source of truth.
 */

export const THREADS_TEXT_LIMIT = 500;

export interface ThreadsPublishInput {
  accessToken: string;
  text: string;
  /** Overridable only for tests. */
  apiBase?: string;
}

export interface ThreadsPublishResult {
  id: string;
  creationId: string;
}

export type ThreadsFetch = typeof fetch;

type ThreadsResponse = {
  id?: string;
  error?: { message?: string; type?: string; code?: number };
};

const DEFAULT_API_BASE = 'https://graph.threads.net';

function apiError(action: string, response: Response, body: ThreadsResponse): Error {
  const detail = body.error?.message || body.error?.type || 'unknown provider error';
  return new Error(`[threads] ${action} failed (${response.status}): ${detail}`);
}

async function readResponse(action: string, response: Response): Promise<ThreadsResponse> {
  let body: ThreadsResponse = {};
  try {
    body = (await response.json()) as ThreadsResponse;
  } catch {
    if (!response.ok) throw new Error(`[threads] ${action} failed (${response.status})`);
  }
  if (!response.ok) throw apiError(action, response, body);
  return body;
}

/** Publish a text post through Meta's create-container → publish flow. */
export async function publishThreadsText(
  input: ThreadsPublishInput,
  fetchImpl: ThreadsFetch = fetch,
): Promise<ThreadsPublishResult> {
  const text = input.text.trim();
  const accessToken = input.accessToken.trim();
  if (!accessToken) throw new Error('[threads] access token is required');
  if (!text) throw new Error('[threads] text is required');
  if (text.length > THREADS_TEXT_LIMIT) {
    throw new Error(`[threads] text exceeds ${THREADS_TEXT_LIMIT} characters`);
  }

  const apiBase = (input.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, '');
  const createUrl = new URL(`${apiBase}/me/threads`);
  createUrl.searchParams.set('media_type', 'TEXT');
  createUrl.searchParams.set('text', text);
  const createResponse = await fetchImpl(createUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const created = await readResponse('create container', createResponse);
  const creationId = created.id;
  if (!creationId) throw new Error('[threads] create container returned no id');

  const publishUrl = new URL(`${apiBase}/me/threads_publish`);
  publishUrl.searchParams.set('creation_id', creationId);
  const publishResponse = await fetchImpl(publishUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const published = await readResponse('publish container', publishResponse);
  if (!published.id) throw new Error('[threads] publish container returned no id');
  return { id: published.id, creationId };
}
