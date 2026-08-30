/**
 * Fetch OpenRouter's live catalog. Ranking lives in model-scoring.ts — this
 * file only knows how to retrieve records and which ids are structurally
 * unusable (batch, alias, unstable, non-text).
 *
 * @see https://openrouter.ai/docs/api/api-reference/models/get-models
 * @see wiki/research/2026-08-30-openrouter-routing-api.md
 */

import { logEvent } from './log';

export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

export type OpenRouterModelsQuery = {
  category?: string;
  sort?: string;
};

export type OpenRouterModelPricing = {
  prompt?: string;
  completion?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  /** Stepped price above a prompt-token threshold. Present on ~51 models. */
  overrides?: unknown;
};

export type OpenRouterModelRecord = {
  id: string;
  name?: string;
  created?: number;
  context_length?: number;
  pricing?: OpenRouterModelPricing;
  architecture?: {
    modality?: string;
    instruct_type?: string | null;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
  expiration_date?: string | null;
  benchmarks?: {
    artificial_analysis?: {
      intelligence_index?: number;
      coding_index?: number;
      agentic_index?: number;
    };
  };
  reasoning?: {
    mandatory?: boolean;
    default_enabled?: boolean;
    supported_efforts?: string[];
    default_effort?: string;
  };
};

export type OpenRouterEndpointRecord = {
  provider_name?: string;
  name?: string;
  tag?: string;
  pricing?: OpenRouterModelPricing & { discount?: number };
  status?: number;
  uptime_last_1d?: number;
  latency_last_30m?: number;
  supports_implicit_caching?: boolean;
};

type ModelsResponse = { data?: OpenRouterModelRecord[] };
type EndpointsResponse = { data?: OpenRouterEndpointRecord[] };

const UNSTABLE_SUBSTRINGS = [
  'experimental',
  'preview',
  'beta',
  'nex-agi',
  'terminus',
] as const;

/** `-exp` / `/exp` must be a token, not a prefix of `expensive`. */
const UNSTABLE_EXP_TOKENS = ['-exp', '/exp'] as const;

function hasExpToken(lowerId: string): boolean {
  for (const token of UNSTABLE_EXP_TOKENS) {
    let from = 0;
    while (from <= lowerId.length - token.length) {
      const idx = lowerId.indexOf(token, from);
      if (idx === -1) break;
      const after = lowerId[idx + token.length];
      if (after === undefined || after === '-' || after === '/' || after === '_' || after === ':') {
        return true;
      }
      from = idx + 1;
    }
  }
  return false;
}

export function isUnstableOpenRouterModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  if (hasExpToken(lower)) return true;
  return UNSTABLE_SUBSTRINGS.some((frag) => lower.includes(frag));
}

const MIN_CONTEXT_LENGTH = 32_000;

const OPENROUTER_FETCH_HEADERS = {
  'HTTP-Referer': 'https://aitodaybrief.com',
  'X-Title': 'AI Today Brief Pipeline',
} as const;

/** Moving aliases (`~author/slug-latest`) have no Artificial Analysis score. */
export function isOpenRouterAliasId(modelId: string): boolean {
  return modelId.startsWith('~');
}

export function isFreeOpenRouterModel(modelId: string): boolean {
  return modelId.toLowerCase().includes(':free');
}

/** Author/family prefix, used for diversity — not an allowlist. */
export function openRouterModelFamily(modelId: string): string {
  return modelId.replace(/^~/, '').split('/')[0]?.toLowerCase() ?? '';
}

export function openRouterModelSupportsJson(model: OpenRouterModelRecord): boolean {
  const supported = model.supported_parameters;
  return (
    !supported || supported.includes('structured_outputs') || supported.includes('response_format')
  );
}

export function modelHasPriceOverrides(model: OpenRouterModelRecord): boolean {
  const overrides = model.pricing?.overrides;
  if (overrides == null) return false;
  if (Array.isArray(overrides)) return overrides.length > 0;
  return typeof overrides === 'object';
}

/**
 * Same exclusions for every path that can put an id into a live queue.
 * `:free` is eligible — the ranker and the 20 req/min limiter handle it.
 * Aliases are not: they have no benchmark and were the Fable leak.
 */
export function isEligibleOpenRouterModel(model: OpenRouterModelRecord): boolean {
  const id = model.id.toLowerCase();
  if (isOpenRouterAliasId(model.id)) return false;
  if (id.includes(':batch')) return false;
  if (id.includes('distill')) return false;
  if (id.includes('vision') || id.includes('image')) return false;
  if (isUnstableOpenRouterModelId(model.id)) return false;
  if (model.expiration_date) return false;
  const modality = model.architecture?.modality ?? 'text';
  if (!modality.includes('text')) return false;
  const ctx = model.context_length ?? 0;
  if (ctx > 0 && ctx < MIN_CONTEXT_LENGTH) return false;
  return true;
}

export function openRouterModelsUrl(query?: OpenRouterModelsQuery): string {
  const url = new URL(OPENROUTER_MODELS_URL);
  if (query?.category?.trim()) url.searchParams.set('category', query.category.trim());
  if (query?.sort?.trim()) url.searchParams.set('sort', query.sort.trim());
  return url.toString();
}

export function openRouterEndpointsUrl(modelId: string): string | null {
  if (isOpenRouterAliasId(modelId)) return null;
  const trimmed = modelId.replace(/:free$/i, '');
  const slash = trimmed.indexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) return null;
  const author = trimmed.slice(0, slash);
  const slug = trimmed.slice(slash + 1);
  if (!author || !slug || slug.includes('/')) return null;
  return `${OPENROUTER_MODELS_URL}/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`;
}

/**
 * How many models a single call may walk before giving up. Every consumer of a
 * model queue must apply it: `generateWithOpenRouterChain` iterates the whole
 * queue on failures, so an uncapped queue turns one bad model family into an
 * hours-long rotation (12 models already cost ~20 minutes in production,
 * 2026-08-09).
 */
export function openRouterModelAttemptCap(
  env: {
    OPENROUTER_MAX_MODEL_ATTEMPTS?: string;
    [key: string]: string | undefined;
  } = process.env,
): number {
  const maxAttempts = Number.parseInt(env.OPENROUTER_MAX_MODEL_ATTEMPTS ?? '6', 10);
  return Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 6;
}

function parseModelsResponse(raw: string, httpStatus: number): OpenRouterModelRecord[] {
  if (httpStatus < 200 || httpStatus >= 300) {
    throw new Error(`[openrouter] models HTTP ${httpStatus}: ${raw.slice(0, 400)}`);
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

/* v8 ignore start -- live network: ranking is unit-tested against fixtures */
export async function fetchOpenRouterModels(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 60_000,
  query?: OpenRouterModelsQuery,
): Promise<OpenRouterModelRecord[]> {
  const res = await fetchFn(openRouterModelsUrl(query), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...OPENROUTER_FETCH_HEADERS,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text();
  return parseModelsResponse(raw, res.status);
}

export async function fetchOpenRouterModelEndpoints(
  apiKey: string,
  modelId: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 15_000,
): Promise<OpenRouterEndpointRecord[]> {
  const url = openRouterEndpointsUrl(modelId);
  if (!url) return [];
  const res = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...OPENROUTER_FETCH_HEADERS,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`[openrouter] endpoints HTTP ${res.status} (${modelId}): ${raw.slice(0, 300)}`);
  }
  let json: EndpointsResponse;
  try {
    json = JSON.parse(raw) as EndpointsResponse;
  } catch {
    throw new Error(`[openrouter] endpoints response not JSON: ${raw.slice(0, 200)}`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

export async function resolveOpenRouterModelQueue(
  apiKey: string,
  env: {
    OPENROUTER_MAX_MODEL_ATTEMPTS?: string;
    [key: string]: string | undefined;
  } = process.env,
  deps: {
    fetchModels?: (key: string) => Promise<OpenRouterModelRecord[]>;
    role?: string;
  } = {},
): Promise<string[]> {
  // Dynamic import: registry → this file, model-scoring → this file. A static
  // import of the ranker here would cycle through registry's ProviderRole type.
  const { rankModelsForRole, fetchOpenRouterCatalogForRole } = await import(
    './providers/model-scoring'
  );
  const role = (deps.role ?? 'weekly.master_writer') as import('./providers/registry').ProviderRole;
  const cap = openRouterModelAttemptCap(env);
  const fetchModels =
    deps.fetchModels ?? ((key: string) => fetchOpenRouterCatalogForRole(key, role));
  const models = await fetchModels(apiKey);
  const ranked = rankModelsForRole(models, role);
  const queue = ranked.slice(0, cap);

  logEvent('info', 'openrouter', 'Model queue resolved', {
    role,
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
