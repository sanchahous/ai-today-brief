/**
 * Price/quality-aware OpenRouter model selection for the weekly master.
 *
 * No hardcoded model ids or vendor tiers. Ranking pulls live pricing and
 * quality benchmarks from the OpenRouter catalog every run, so a model that
 * is cheap today (a temporary discount, a new cost-efficient release) is
 * preferred automatically — and stops being preferred the moment its price
 * or the competitive field changes, with no code edit required.
 */

import type { OpenRouterModelRecord } from './openrouter-models';

export type OpenRouterValueCandidate = {
  id: string;
  estimatedCostUsd: number;
  qualityIndex: number | null;
  reasoningEffort: string | null;
};

/** Per-token USD rate parsed from the catalog; null if the model didn't report pricing. */
function parseRate(raw: string | undefined): number | null {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Projected cost for one call at the given token profile, or null if pricing is unknown. */
export function estimateOpenRouterCallCost(
  model: OpenRouterModelRecord,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const promptRate = parseRate(model.pricing?.prompt);
  const completionRate = parseRate(model.pricing?.completion);
  if (promptRate === null || completionRate === null) return null;
  return promptTokens * promptRate + completionTokens * completionRate;
}

/** Anthropic Analysis intelligence index (0-100-ish), or null if unrated. */
export function qualityIndexOf(model: OpenRouterModelRecord): number | null {
  const index = model.benchmarks?.artificial_analysis?.intelligence_index;
  return typeof index === 'number' && Number.isFinite(index) ? index : null;
}

/**
 * Lowest reasoning effort the model will accept, when reasoning defaults on.
 * Reasoning tokens bill as output tokens — a model that reasons by default
 * without an explicit low-effort request silently inflates cost far beyond
 * its sticker price (this is what happened with the previous fixed pick).
 * Returns null when the model has no reasoning to suppress.
 */
export function minimalReasoningEffort(model: OpenRouterModelRecord): string | null {
  const supported = model.reasoning?.supported_efforts ?? [];
  if (!model.reasoning?.default_enabled) return null;
  if (supported.includes('none')) return 'none';
  if (supported.includes('low')) return 'low';
  return null;
}

export type RankOpenRouterModelsOptions = {
  promptTokens: number;
  completionTokens: number;
  /** Minimum acceptable Artificial Analysis intelligence index. */
  minQualityIndex: number;
  /** Vendors (openrouter id prefix, e.g. "openai") allowed through without a benchmark score. */
  trustedVendorsWithoutBenchmark?: string[];
  excludeVendors?: string[];
  configuredModels?: string[];
};

function vendorOf(modelId: string): string {
  return modelId.split('/', 1)[0]?.trim().toLowerCase() ?? '';
}

const BASE_EXCLUDED_ID_PATTERN = /:free$|mini|flash|lite|small|nano|coder|image|audio|embedding/i;

/**
 * Rank eligible models by estimated cost for the given token profile, cheapest
 * first, after applying a quality floor. A model without benchmark data is
 * only considered when its vendor is explicitly trusted — unrated models from
 * unknown vendors are excluded rather than risking editorial quality.
 */
export function rankOpenRouterModelsByValue(
  models: OpenRouterModelRecord[],
  options: RankOpenRouterModelsOptions,
): OpenRouterValueCandidate[] {
  const excludedVendors = new Set(
    (options.excludeVendors ?? []).map((vendor) => vendor.trim().toLowerCase()).filter(Boolean),
  );
  const trustedVendors = new Set(
    (options.trustedVendorsWithoutBenchmark ?? [])
      .map((vendor) => vendor.trim().toLowerCase())
      .filter(Boolean),
  );
  const configured = new Set(options.configuredModels ?? []);

  const candidates: OpenRouterValueCandidate[] = [];
  for (const model of models) {
    const id = model.id;
    const lower = id.toLowerCase();
    if (configured.size > 0 && !configured.has(id)) continue;
    if (excludedVendors.has(vendorOf(id))) continue;
    if (BASE_EXCLUDED_ID_PATTERN.test(lower)) continue;
    if (model.expiration_date) continue;
    if ((model.context_length ?? 0) < 64_000) continue;
    if (!(model.architecture?.modality ?? 'text').includes('text')) continue;

    const quality = qualityIndexOf(model);
    if (quality === null) {
      if (!trustedVendors.has(vendorOf(id))) continue;
    } else if (quality < options.minQualityIndex) {
      continue;
    }

    const cost = estimateOpenRouterCallCost(model, options.promptTokens, options.completionTokens);
    if (cost === null) continue;

    candidates.push({
      id,
      estimatedCostUsd: cost,
      qualityIndex: quality,
      reasoningEffort: minimalReasoningEffort(model),
    });
  }

  return candidates.sort((left, right) => left.estimatedCostUsd - right.estimatedCostUsd);
}
