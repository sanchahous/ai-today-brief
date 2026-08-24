const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
export const DAILY_VISUAL_IMAGE_MODEL = 'gpt-image-2';
export const DAILY_VISUAL_IMAGE_SIZE = '1536x1024';
export const DAILY_VISUAL_IMAGE_QUALITY = 'medium';

export interface DailyVisualRenderedImage {
  bytes: Buffer;
  mimeType: 'image/webp';
  provider: 'openai';
  model: typeof DAILY_VISUAL_IMAGE_MODEL;
}

export class DailyVisualImageError extends Error {
  readonly mayHaveBeenBilled: boolean;

  constructor(message: string, mayHaveBeenBilled: boolean) {
    super(message);
    this.name = 'DailyVisualImageError';
    this.mayHaveBeenBilled = mayHaveBeenBilled;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstImageBase64(value: unknown): string | null {
  const root = asRecord(value);
  const rows = root?.data;
  if (!Array.isArray(rows)) return null;
  const first = asRecord(rows[0]);
  const encoded = first?.b64_json;
  return typeof encoded === 'string' && encoded.trim() ? encoded.trim() : null;
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const body = asRecord((await response.json()) as unknown);
    const nested = asRecord(body?.error);
    const message = nested?.message ?? body?.message;
    return typeof message === 'string' && message.trim()
      ? message.trim().slice(0, 400)
      : `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function isAmbiguousHttpStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

/**
 * Server-only, one-image GPT Image 2 request. We use base64 instead of a
 * remote URL so the candidate can be hashed and placed directly in the private
 * storage bucket before any public projection exists.
 */
export async function generateDailyVisualImage(
  prompt: string,
  apiKey: string | undefined = process.env.OPENAI_API_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<DailyVisualRenderedImage> {
  const key = apiKey?.trim();
  if (!key) throw new DailyVisualImageError('OPENAI_API_KEY is not configured.', false);
  if (!prompt.trim()) throw new DailyVisualImageError('Daily visual image prompt is empty.', false);

  let response: Response;
  try {
    response = await fetchImpl(OPENAI_IMAGE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: DAILY_VISUAL_IMAGE_MODEL,
        prompt,
        size: DAILY_VISUAL_IMAGE_SIZE,
        quality: DAILY_VISUAL_IMAGE_QUALITY,
        background: 'opaque',
        output_format: 'webp',
        output_compression: 90,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DailyVisualImageError(`GPT Image request did not complete: ${message}`, true);
  }

  if (!response.ok) {
    const message = await safeErrorMessage(response);
    throw new DailyVisualImageError(
      `GPT Image request failed: ${message}`,
      isAmbiguousHttpStatus(response.status),
    );
  }

  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new DailyVisualImageError('GPT Image response was not valid JSON.', true);
  }
  const encoded = firstImageBase64(payload);
  if (!encoded)
    throw new DailyVisualImageError('GPT Image response did not contain image bytes.', true);
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0)
    throw new DailyVisualImageError('GPT Image response contained empty image bytes.', true);
  return {
    bytes,
    mimeType: 'image/webp',
    provider: 'openai',
    model: DAILY_VISUAL_IMAGE_MODEL,
  };
}
