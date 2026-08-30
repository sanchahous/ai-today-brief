/**
 * OpenRouter provider routing for a chosen model: cheapest endpoint that
 * still clears an uptime floor.
 *
 * `:floor` on the model id is the short form of `provider.sort: "price"`, but
 * it also opts into flex/slow tiers — that already blew a social checkpoint
 * (2026-08-17). We send the JSON equivalent plus `preferred_max_latency` and
 * an `ignore` list from `/endpoints` uptime, and we never rewrite the model id.
 *
 * (source: wiki/research/2026-08-30-openrouter-routing-api.md §5, §12 step 6)
 */

import {
  fetchOpenRouterModelEndpoints,
  type OpenRouterEndpointRecord,
} from './openrouter-models';

export const DEFAULT_PROVIDER_UPTIME_FLOOR = 0.99;
export const DEFAULT_PROVIDER_MAX_LATENCY_S = 15;

export type OpenRouterProviderRouting = {
  sort: 'price';
  allow_fallbacks: boolean;
  require_parameters: boolean;
  preferred_max_latency: number;
  ignore?: string[];
};

export type ProviderRoutingEnv = {
  OPENROUTER_PROVIDER_UPTIME_FLOOR?: string;
  OPENROUTER_PROVIDER_MAX_LATENCY_S?: string;
  [key: string]: string | undefined;
};

function parseBound(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function resolveProviderUptimeFloor(env: ProviderRoutingEnv = process.env): number {
  return parseBound(env.OPENROUTER_PROVIDER_UPTIME_FLOOR, DEFAULT_PROVIDER_UPTIME_FLOOR, 0, 1);
}

export function resolveProviderMaxLatencyS(env: ProviderRoutingEnv = process.env): number {
  return parseBound(env.OPENROUTER_PROVIDER_MAX_LATENCY_S, DEFAULT_PROVIDER_MAX_LATENCY_S, 0.1, 90);
}

/**
 * Catalog uptime is sometimes 0–1 and sometimes 0–100. Values above 1 are
 * treated as percents.
 */
export function normalizeUptime(raw: number | undefined): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return raw > 1 ? raw / 100 : raw;
}

export function endpointProviderSlug(endpoint: OpenRouterEndpointRecord): string {
  const raw = endpoint.tag || endpoint.provider_name || endpoint.name || '';
  const left = raw.split('|')[0]?.trim() ?? '';
  return left.toLowerCase().replace(/\s+/g, '-');
}

export function providersBelowUptimeFloor(
  endpoints: readonly OpenRouterEndpointRecord[],
  floor: number = DEFAULT_PROVIDER_UPTIME_FLOOR,
): string[] {
  const ignored: string[] = [];
  const seen = new Set<string>();
  for (const endpoint of endpoints) {
    const slug = endpointProviderSlug(endpoint);
    if (!slug || seen.has(slug)) continue;
    const uptime = normalizeUptime(endpoint.uptime_last_1d);
    if (uptime === null) continue;
    if (uptime >= floor) continue;
    seen.add(slug);
    ignored.push(slug);
  }
  return ignored;
}

export function openRouterPriceRouting(input: {
  ignore?: readonly string[];
  maxLatencyS?: number;
}): OpenRouterProviderRouting {
  const ignore = [
    ...new Set(
      (input.ignore ?? []).map((slug) => slug.trim().toLowerCase()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const routing: OpenRouterProviderRouting = {
    sort: 'price',
    allow_fallbacks: true,
    require_parameters: true,
    preferred_max_latency: input.maxLatencyS ?? DEFAULT_PROVIDER_MAX_LATENCY_S,
  };
  if (ignore.length > 0) routing.ignore = ignore;
  return routing;
}

export async function resolveOpenRouterProviderRouting(
  apiKey: string,
  modelId: string,
  env: ProviderRoutingEnv = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<OpenRouterProviderRouting> {
  const maxLatencyS = resolveProviderMaxLatencyS(env);
  const floor = resolveProviderUptimeFloor(env);
  try {
    const endpoints = await fetchOpenRouterModelEndpoints(apiKey, modelId, fetchFn);
    return openRouterPriceRouting({
      ignore: providersBelowUptimeFloor(endpoints, floor),
      maxLatencyS,
    });
  } catch {
    // Fail open: still sort by price, just without an ignore list.
    return openRouterPriceRouting({ maxLatencyS });
  }
}
