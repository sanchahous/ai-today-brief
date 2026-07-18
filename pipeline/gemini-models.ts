/**
 * Fetch and rank Gemini models for brief summarization.
 * @see https://ai.google.dev/api/models#method:-models.list
 *
 * No hardcoded model ids — ranking uses version numbers, flash/pro family, and
 * env overrides. Queue is built once per pipeline run from the live API catalog.
 */

import { logEvent } from './log';

export const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiModelRecord = {
  name: string;
  displayName?: string;
  version?: string;
  supportedGenerationMethods?: string[];
};

type ListModelsResponse = {
  models?: GeminiModelRecord[];
  nextPageToken?: string;
};

/** `models/gemini-2.5-flash` → `gemini-2.5-flash` */
export function modelIdFromGeminiName(name: string): string {
  return name.replace(/^models\//, '');
}

const EXCLUDED_ID_FRAGMENTS = [
  'embedding',
  'embed',
  'aqa',
  'tts',
  'image',
  'imagen',
  'live',
  'computer-use',
  'robotics',
  'nano-banana',
  'gemma',
];

const UNSTABLE_ID_FRAGMENTS = ['-exp', 'preview', 'experimental', 'beta', 'lite-preview'];

/**
 * Optional substring bias within the same version tier — lower index = tried earlier.
 * When unset, ranking uses only catalog metadata (version number, flash vs pro).
 * Set `GEMINI_MODEL_PRIORITY` (comma-separated) to nudge preferences manually.
 */
function parsePriorityList(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return [];
  return envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function priorityScore(modelId: string, priorities: string[]): number {
  const lower = modelId.toLowerCase();
  for (let i = 0; i < priorities.length; i++) {
    if (lower.includes(priorities[i]!.toLowerCase())) return i;
  }
  return priorities.length + 100;
}

/** `gemini-3.5-flash` → 3.05; higher = newer, including two-digit minors. */
export function parseGeminiVersionScore(modelId: string): number | null {
  const match = /gemini-(\d+)(?:\.(\d+))?/i.exec(modelId);
  if (!match) return null;
  const major = Number.parseInt(match[1]!, 10);
  const minor = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return major + minor / 100;
}

/**
 * Keep only the newest numbered Gemini generation exposed by the live catalog.
 * For example, a catalog containing 3.5, 3.1 and 2.5 keeps the 3.x models and
 * removes the previous 2.x generation from the retry path. `*-latest` aliases
 * are retained only when the catalog has no numbered stable model to rank.
 */
export function retainCurrentGeminiGeneration(models: GeminiModelRecord[]): GeminiModelRecord[] {
  const eligible = models.filter(isEligibleGeminiSummarizeModel);
  const numbered = eligible
    .map((model) => ({
      model,
      version: parseGeminiVersionScore(modelIdFromGeminiName(model.name)),
    }))
    .filter(
      (entry): entry is { model: GeminiModelRecord; version: number } => entry.version !== null,
    );
  if (numbered.length === 0) return eligible;

  const newestMajor = Math.max(...numbered.map((entry) => Math.floor(entry.version)));
  return numbered
    .filter((entry) => Math.floor(entry.version) === newestMajor)
    .map((entry) => entry.model);
}

export function isUnstableGeminiModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return UNSTABLE_ID_FRAGMENTS.some((frag) => lower.includes(frag));
}

export function isEligibleGeminiSummarizeModel(model: GeminiModelRecord): boolean {
  const methods = model.supportedGenerationMethods ?? [];
  if (!methods.includes('generateContent')) return false;

  const id = modelIdFromGeminiName(model.name).toLowerCase();
  if (!id.includes('gemini')) return false;
  if (EXCLUDED_ID_FRAGMENTS.some((frag) => id.includes(frag))) return false;
  if (isUnstableGeminiModelId(id)) return false;

  // Pipeline wants fast structured-json editors — flash/pro only.
  return id.includes('flash') || id.includes('pro');
}

/**
 * Lower score = earlier in queue. Newer version first; flash before pro;
 * env/custom substring priority as overlay.
 */
export function geminiSummarizeRankScore(modelId: string, priorities: string[]): number {
  let score = 0;

  const version = parseGeminiVersionScore(modelId);
  if (version !== null) {
    score -= version * 1_000;
  }

  const lower = modelId.toLowerCase();
  if (lower.includes('flash')) score -= 80;
  else if (lower.includes('pro')) score -= 40;

  score += priorityScore(modelId, priorities);
  return score;
}

export function rankGeminiModelIds(
  models: GeminiModelRecord[],
  priorities: string[] = [],
): string[] {
  const eligible = retainCurrentGeminiGeneration(models);
  const sorted = [...eligible].sort(
    (a, b) =>
      geminiSummarizeRankScore(modelIdFromGeminiName(a.name), priorities) -
      geminiSummarizeRankScore(modelIdFromGeminiName(b.name), priorities),
  );
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of sorted) {
    const id = modelIdFromGeminiName(m.name);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function prependPinnedModel(queue: string[], pinned: string | undefined): string[] {
  const pin = pinned?.trim();
  if (!pin) return queue;
  // A pin may change ordering inside the current live generation, but it may
  // not re-introduce a retired generation that discovery deliberately removed.
  if (!queue.includes(pin)) return queue;
  const rest = queue.filter((id) => id !== pin);
  return [pin, ...rest];
}

/* v8 ignore start -- live network: ranking logic is unit-tested */
export async function fetchGeminiModels(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 30_000,
): Promise<GeminiModelRecord[]> {
  const all: GeminiModelRecord[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(GEMINI_MODELS_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetchFn(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`[gemini] models HTTP ${res.status}: ${raw.slice(0, 400)}`);
    }

    let json: ListModelsResponse;
    try {
      json = JSON.parse(raw) as ListModelsResponse;
    } catch {
      throw new Error(`[gemini] models response not JSON: ${raw.slice(0, 200)}`);
    }

    all.push(...(json.models ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  if (all.length === 0) {
    throw new Error('[gemini] models list empty');
  }
  return all;
}

export async function resolveGeminiModelQueue(
  apiKey: string,
  env: {
    GEMINI_MODEL?: string;
    GEMINI_MODEL_PRIORITY?: string;
    GEMINI_MAX_MODEL_ATTEMPTS?: string;
    [key: string]: string | undefined;
  } = process.env,
  deps: {
    fetchModels?: (key: string) => Promise<GeminiModelRecord[]>;
  } = {},
): Promise<string[]> {
  const priorities = parsePriorityList(env.GEMINI_MODEL_PRIORITY);
  const maxAttempts = Number.parseInt(env.GEMINI_MAX_MODEL_ATTEMPTS ?? '5', 10);
  const cap = Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 5;
  const pinned = env.GEMINI_MODEL?.trim();

  const fetchModels = deps.fetchModels ?? ((key: string) => fetchGeminiModels(key));
  let ranked: string[];
  try {
    const models = await fetchModels(apiKey);
    ranked = rankGeminiModelIds(models, priorities);
  } catch (error) {
    // When discovery is unavailable, only a moving `*-latest` alias can still
    // satisfy the no-stale-model policy. A numbered pin cannot be verified.
    if (!pinned?.toLowerCase().includes('latest')) throw error;
    logEvent('warn', 'gemini', 'Model catalog fetch failed — using GEMINI_MODEL pin only', {
      pinned,
      error_message: error instanceof Error ? error.message : String(error),
    });
    ranked = [pinned];
  }

  if (pinned && !ranked.includes(pinned)) {
    logEvent('warn', 'gemini', 'Ignoring stale GEMINI_MODEL pin outside current generation', {
      pinned,
      current_generation: ranked,
    });
  }

  const queue = prependPinnedModel(ranked, pinned).slice(0, cap);

  logEvent('info', 'gemini', 'Model queue resolved', {
    pinned: pinned ?? null,
    total_catalog: ranked.length,
    queue_length: queue.length,
    top_models: queue.slice(0, 5),
  });

  if (queue.length === 0) {
    throw new Error('[gemini] no eligible models after ranking');
  }
  return queue;
}
/* v8 ignore end */
