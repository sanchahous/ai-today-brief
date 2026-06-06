/**
 * Text embeddings via Google `gemini-embedding-001`, truncated to 768
 * dimensions (`outputDimensionality`). 768 stays under pgvector's 2000-dim
 * ceiling for HNSW indexes; cosine distance is unaffected by the non-unit
 * norm of truncated vectors.
 *
 * Used after the pool is selected to check each candidate against the
 * `brief_item_embeddings` store — the same event, however re-worded across
 * days, lands close in vector space and is dropped before the LLM call.
 *
 * Note: use `gemini-embedding-001`, NOT `text-embedding-004` — the latter
 * returns 404 on the batch endpoint.
 */

import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { logEvent } from './log';

export const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIM = 768;

/** Gemini caps batchEmbedContents at 100 requests per call; stay under it. */
export const EMBED_BATCH_SIZE = 96;

/** Text we embed for a candidate: headline carries the signal. */
export function embedInput(title: string): string {
  return title.trim();
}

/* v8 ignore start -- integration: real embeddings API; embedInput is unit-tested */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry transient embedding errors (429/5xx), honouring the API's suggested delay. */
async function withEmbedRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const transient = /\b429\b|quota|rate limit|\b50[0-4]\b|temporarily/i.test(msg);
      if (attempt >= attempts || !transient) throw error;
      const suggested = msg.match(/retry in ([\d.]+)s/i);
      const waitMs = Math.min(
        45_000,
        suggested ? Math.ceil(parseFloat(suggested[1]!) * 1000) + 1000 : 2000 * 2 ** (attempt - 1),
      );
      logEvent('warn', 'embed', 'Embedding throttled, backing off', { attempt, wait_ms: waitMs });
      await sleep(waitMs);
    }
  }
  throw lastError;
}

export function createEmbedder(apiKey: string): EmbedFn {
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: EMBED_MODEL });

  return async (texts: string[]) => {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const chunk = texts.slice(i, i + EMBED_BATCH_SIZE);
      const { embeddings } = await withEmbedRetry(() =>
        model.batchEmbedContents({
          requests: chunk.map((text) => ({
            content: { role: 'user', parts: [{ text }] },
            taskType: TaskType.SEMANTIC_SIMILARITY,
            outputDimensionality: EMBED_DIM,
          })),
        }),
      );
      out.push(...embeddings.map((e) => e.values));
    }
    return out;
  };
}
/* v8 ignore end */
