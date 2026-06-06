/**
 * Fetch and rank OpenRouter models for brief summarization.
 * @see https://openrouter.ai/docs/api/api-reference/models/get-models
 *
 * No hardcoded model ids — ranking uses id patterns (-pro, -vX.Y) and env overrides.
 */

import { logEvent } from './log';

export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

export type OpenRouterModelRecord = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string; instruct_type?: string | null };
};

type ModelsResponse = { data?: OpenRouterModelRecord[] };

/**
 * Substring priority list — lower index = tried earlier within the same tier.
 * Used as a scoring overlay on top of the tier + pattern rank; override via
 * OPENROUTER_MODEL_PRIORITY env var (comma-separated substrings).
 *
 * Tier order (always applied first):
 *   1. deepseek_pro  — DeepSeek flagship (v4-pro, v3.x, r1)
 *   2. deepseek_chat — DeepSeek lite/chat variants
 *   3. qwen          — Qwen family
 *   4. other         — Claude, GPT, Gemini, Llama, Mistral, …
 *
 * Within "other", this list orders the frontier models by capability.
 * `:free` tier models on OpenRouter are excluded entirely — their rate limits
 * are too aggressive for production use (unrelated to Google AI Studio free tier).
 */
export const DEFAULT_MODEL_PRIORITY = [
  // ── DeepSeek — cost-effective powerhouses (handled by deepseek_pro/chat tiers) ──
  'deepseek-v4-pro',
  'deepseek-v4',      // catches v4-flash and future v4.x variants
  'deepseek-v3.2',
  'deepseek-v3.1',
  'deepseek-v3',
  'deepseek-r1',
  'deepseek-pro',
  'deepseek-chat',
  // ── Qwen (handled by qwen tier) ──
  'qwen-max',
  'qwen-plus',
  'qwen3',
  'qwen',
  // ── Frontier (all land in "other" tier; ordered by capability) ──
  'claude-opus-4',    // Anthropic flagship
  'claude-sonnet-4',  // matches sonnet-4, sonnet-4.x, sonnet-4-5, sonnet-4-6 …
  'gpt-5',
  'gpt-4.1',
  'gpt-4o',
  'gemini-3.5',       // matches gemini-3.5-flash, gemini-3.5-pro, …
  'gemini-3',         // matches gemini-3-flash, gemini-3-pro, gemini-3.1-…, …
  'gemini-2.5-pro',   // explicit fallback for older Gemini Pro
  'llama-3.3-70b',
  'mistral-large',
] as const;

export type OpenRouterModelTier = 'deepseek_pro' | 'deepseek_chat' | 'qwen' | 'other';

export function classifyOpenRouterModelTier(modelId: string): OpenRouterModelTier {
  const lower = modelId.toLowerCase();
  if (!lower.includes('deepseek')) {
    if (lower.includes('qwen')) return 'qwen';
    return 'other';
  }
  if (lower.includes('chat') && !lower.includes('r1')) return 'deepseek_chat';
  if (
    lower.includes('pro') ||
    lower.includes('v3') ||
    lower.includes('v4') ||
    lower.includes('v5') ||
    lower.includes('r1')
  ) {
    return 'deepseek_pro';
  }
  return 'deepseek_chat';
}

const TIER_ORDER: OpenRouterModelTier[] = ['deepseek_pro', 'deepseek_chat', 'qwen', 'other'];

const TIER_BASE_SCORE: Record<OpenRouterModelTier, number> = {
  deepseek_pro: 0,
  deepseek_chat: 1_000,
  qwen: 2_000,
  other: 3_000,
};

/** Re-order ranked ids: DeepSeek pro → DeepSeek chat → Qwen → everything else. */
export function sortModelQueueByTier(ranked: string[]): string[] {
  const buckets: Record<OpenRouterModelTier, string[]> = {
    deepseek_pro: [],
    deepseek_chat: [],
    qwen: [],
    other: [],
  };
  const seen = new Set<string>();
  for (const id of ranked) {
    if (seen.has(id)) continue;
    seen.add(id);
    buckets[classifyOpenRouterModelTier(id)].push(id);
  }
  return TIER_ORDER.flatMap((tier) => buckets[tier]);
}

const UNSTABLE_ID_FRAGMENTS = [
  '-exp',
  '/exp',
  'experimental',
  'preview',
  'beta',
  'nex-agi',
  'terminus',
];

const MIN_CONTEXT_LENGTH = 32_000;

/** Prefer ids containing -pro (e.g. deepseek-v4-pro). */
export function hasOpenRouterProPattern(modelId: string): boolean {
  return modelId.toLowerCase().includes('-pro');
}

/** Prefer versioned release ids (v3.2, v4, …). */
export function hasOpenRouterVersionPattern(modelId: string): boolean {
  return /-v\d+(?:\.\d+)?/i.test(modelId);
}

/**
 * Numeric version from id segments like v4-pro → 4.0, v3.2 → 3.2 (higher = ranked earlier).
 */
export function parseOpenRouterVersionScore(modelId: string): number | null {
  const match = /-v(\d+)(?:\.(\d+))?/i.exec(modelId);
  if (!match) return null;
  const major = Number.parseInt(match[1]!, 10);
  const minor = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return major + minor / 100;
}

function parsePriorityList(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return [...DEFAULT_MODEL_PRIORITY];
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

export function isUnstableOpenRouterModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return UNSTABLE_ID_FRAGMENTS.some((frag) => lower.includes(frag));
}

function stabilityPenalty(modelId: string): number {
  return isUnstableOpenRouterModelId(modelId) ? 200 : 0;
}

/**
 * Pattern bias within a tier: -pro and higher vX.Y first.
 * Lower returned score = earlier in queue.
 */
export function openRouterPatternRankScore(modelId: string): number {
  const lower = modelId.toLowerCase();
  let score = 0;

  if (hasOpenRouterProPattern(modelId)) {
    score -= 500;
  }

  const version = parseOpenRouterVersionScore(modelId);
  if (version !== null) {
    score -= version * 50;
  } else if (hasOpenRouterVersionPattern(modelId)) {
    score -= 40;
  }

  if (lower.includes('deepseek') && !hasOpenRouterProPattern(modelId) && version === null) {
    score += 150;
  }

  if (lower.includes('distill')) {
    score += 80;
  }

  return score;
}

function compositeRankScore(
  model: OpenRouterModelRecord,
  priorities: string[],
): number {
  const tier = classifyOpenRouterModelTier(model.id);
  const tierBase = TIER_BASE_SCORE[tier];
  const pattern = openRouterPatternRankScore(model.id);
  const priority = priorityScore(model.id, priorities);
  const stability = stabilityPenalty(model.id);
  const contextBoost = -((model.context_length ?? 0) / 1_000_000);
  return tierBase + pattern + priority + stability + contextBoost;
}

function isEligibleModel(model: OpenRouterModelRecord): boolean {
  const id = model.id.toLowerCase();
  // Exclude OpenRouter's `:free` routing tier — it has severe per-minute rate limits
  // that make it unreliable as a production fallback. This is distinct from the free
  // quota on the Google AI Studio / Gemini API which we use as primary.
  if (id.includes(':free')) return false;
  if (id.includes('vision') || id.includes('image')) return false;
  if (isUnstableOpenRouterModelId(model.id)) return false;
  const modality = model.architecture?.modality ?? 'text';
  if (!modality.includes('text')) return false;
  const ctx = model.context_length ?? 0;
  if (ctx > 0 && ctx < MIN_CONTEXT_LENGTH) return false;
  return true;
}

/** Rank model ids: pattern (-pro, -v) → env/custom substrings → context length. */
export function rankOpenRouterModelIds(
  models: OpenRouterModelRecord[],
  priorities: string[] = [...DEFAULT_MODEL_PRIORITY],
): string[] {
  const eligible = models.filter(isEligibleModel);
  const sorted = [...eligible].sort(
    (a, b) => compositeRankScore(a, priorities) - compositeRankScore(b, priorities),
  );
  return sortModelQueueByTier(sorted.map((m) => m.id));
}

/* v8 ignore start -- live network: tested via unit tests of ranking logic */
export async function fetchOpenRouterModels(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 60_000,
): Promise<OpenRouterModelRecord[]> {
  const res = await fetchFn(OPENROUTER_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://aitodaybrief.com',
      'X-Title': 'AI Today Brief Pipeline',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`[openrouter] models HTTP ${res.status}: ${raw.slice(0, 400)}`);
  }
  let json: ModelsResponse;
  try {
    json = JSON.parse(raw) as ModelsResponse;
  } catch {
    throw new Error(`[openrouter] models response not JSON: ${raw.slice(0, 200)}`);
  }
  if (!json.data?.length) {
    throw new Error('[openrouter] models list empty');
  }
  return json.data;
}

export async function resolveOpenRouterModelQueue(
  apiKey: string,
  env: {
    OPENROUTER_MODEL_PRIORITY?: string;
    OPENROUTER_MAX_MODEL_ATTEMPTS?: string;
    [key: string]: string | undefined;
  } = process.env,
  deps: {
    fetchModels?: (key: string) => Promise<OpenRouterModelRecord[]>;
  } = {},
): Promise<string[]> {
  const priorities = parsePriorityList(env.OPENROUTER_MODEL_PRIORITY);
  const maxAttempts = Number.parseInt(env.OPENROUTER_MAX_MODEL_ATTEMPTS ?? '6', 10);
  const cap = Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 6;

  const fetchModels = deps.fetchModels ?? ((key: string) => fetchOpenRouterModels(key));
  const models = await fetchModels(apiKey);
  const ranked = rankOpenRouterModelIds(models, priorities);
  const queue = ranked.slice(0, cap);

  logEvent('info', 'openrouter', 'Model queue resolved', {
    total_available: models.length,
    eligible_ranked: ranked.length,
    queue_length: queue.length,
    top_models: queue.slice(0, 5),
  });

  if (queue.length === 0) {
    throw new Error('[openrouter] no eligible models after ranking');
  }
  return queue;
}
/* v8 ignore end */
