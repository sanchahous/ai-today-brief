import { createHash } from 'node:crypto';
import {
  DAILY_VISUAL_PRIMARY_MAX_COST_MICRO_USD,
  DAILY_VISUAL_REPAIR_MAX_COST_MICRO_USD,
} from './daily-visual-contract';

export const DAILY_VISUAL_IMAGE_ROUTE_POLICY_ID = 'daily-openrouter-image-route-v1';
export const OPENROUTER_IMAGE_MODELS_URL = 'https://openrouter.ai/api/v1/images/models';
const OPENROUTER_IMAGE_API_URL = 'https://openrouter.ai/api/v1/images';
const OPENROUTER_TIMEOUT_MS = 180_000;
const MAX_CATALOG_MODELS_PER_FAMILY = 4;

const IMAGE_ASPECT_RATIO = '16:9' as const;
const IMAGE_RESOLUTIONS = ['1K', '2K'] as const;
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type DailyVisualImageResolution = (typeof IMAGE_RESOLUTIONS)[number];
type DailyVisualImageMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];
type DailyVisualImageRouteStrategy = 'bootstrap' | 'champion' | 'canary';
export type DailyVisualImageRouteWinner = 'primary' | 'repair';

export interface DailyVisualImageModelRoute {
  model: string;
  provider: string;
  resolution: DailyVisualImageResolution;
  aspectRatio: typeof IMAGE_ASPECT_RATIO;
  fixedCostMicroUsd: number;
  catalogCreatedAt: number | null;
}

/**
 * This private snapshot is written before a paid image request. Its purpose is
 * reproducibility: a retry must never be affected by a later catalog refresh.
 */
export interface DailyVisualImageRoute {
  policyId: typeof DAILY_VISUAL_IMAGE_ROUTE_POLICY_ID;
  strategy: DailyVisualImageRouteStrategy;
  catalogHash: string;
  primary: DailyVisualImageModelRoute;
  repair: DailyVisualImageModelRoute;
  winner: DailyVisualImageRouteWinner | null;
}

export interface DailyVisualRenderedImage {
  bytes: Buffer;
  mimeType: DailyVisualImageMediaType;
  provider: 'openrouter';
  model: string;
  usage: {
    costUsd: number | null;
    costSource: 'reported' | 'unknown';
  };
}

export class DailyVisualImageError extends Error {
  readonly mayHaveBeenBilled: boolean;

  constructor(message: string, mayHaveBeenBilled: boolean) {
    super(message);
    this.name = 'DailyVisualImageError';
    this.mayHaveBeenBilled = mayHaveBeenBilled;
  }
}

type OpenRouterCapability = {
  type?: unknown;
  values?: unknown;
  min?: unknown;
  max?: unknown;
};

type OpenRouterImageModel = {
  id?: unknown;
  created?: unknown;
  architecture?: { input_modalities?: unknown; output_modalities?: unknown };
};

type OpenRouterImageEndpoint = {
  provider_tag?: unknown;
  supported_parameters?: unknown;
  pricing?: unknown;
};

type OpenRouterImagePricing = {
  billable?: unknown;
  unit?: unknown;
  cost_usd?: unknown;
  variant?: unknown;
};

type OpenRouterImageModelsResponse = { data?: unknown };
type OpenRouterImageEndpointsResponse = { endpoints?: unknown };
type OpenRouterImageGenerationResponse = {
  data?: unknown;
  usage?: { cost?: unknown };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown, maximum = 256): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function isImageResolution(value: unknown): value is DailyVisualImageResolution {
  return typeof value === 'string' && (IMAGE_RESOLUTIONS as readonly string[]).includes(value);
}

function isSafeProviderTag(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/iu.test(value);
}

function normalizedVariant(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, '');
}

/**
 * Ranks a declared resolution label so the endpoint's base tier can be found.
 * An unrankable label makes "lowest" unprovable, which disables the
 * variant-less price below rather than guessing a tier.
 */
function resolutionRank(value: string): number | null {
  const matched = /^(\d+(?:\.\d+)?)(k)?$/iu.exec(value.trim());
  const size = Number.parseFloat(matched?.[1] ?? '');
  if (!Number.isFinite(size) || size <= 0) return null;
  return matched?.[2] ? size * 1024 : size;
}

function lowestDeclaredResolution(
  capabilities: Record<string, OpenRouterCapability>,
): string | null {
  const capability = capabilities.resolution;
  if (capability?.type !== 'enum') return null;
  let lowest: { value: string; rank: number } | null = null;
  for (const value of asStringArray(capability.values)) {
    const rank = resolutionRank(value);
    if (rank === null) return null;
    if (!lowest || rank < lowest.rank) lowest = { value, rank };
  }
  return lowest?.value ?? null;
}

/**
 * OpenRouter states a higher tier as an explicit variant (`2k`, `4k`,
 * `high_resolution`) and leaves the endpoint's cheapest declared tier
 * variant-less. Seedream 5.0 Pro is exactly that shape: a bare $0.045 line for
 * 1K plus a `high_resolution` line for 2K. Reading the bare line as the price
 * of any resolution would understate a larger render, so it is only accepted
 * for the base tier; every other tier needs its own named variant.
 */
function outputPriceForResolution(
  pricing: unknown,
  resolution: DailyVisualImageResolution,
  isBaseResolution: boolean,
): number | null {
  if (!Array.isArray(pricing)) return null;
  const prices = pricing
    .map((entry) => asRecord(entry) as OpenRouterImagePricing | null)
    .filter((entry): entry is OpenRouterImagePricing => entry !== null)
    .filter((entry) => entry.billable === 'output_image' && entry.unit === 'image');
  const exact = prices.filter(
    (entry) =>
      typeof entry.variant === 'string' &&
      normalizedVariant(entry.variant) === normalizedVariant(resolution),
  );
  const generic = isBaseResolution
    ? prices.filter((entry) => entry.variant === undefined || entry.variant === null)
    : [];
  const selected =
    exact.length === 1 ? exact[0] : exact.length === 0 && generic.length === 1 ? generic[0] : null;
  const cost = selected?.cost_usd;
  return typeof cost === 'number' && Number.isFinite(cost) && cost > 0 ? cost : null;
}

/**
 * A fixed output-image price is only a real upper bound when no other
 * non-zero line can be charged for the request. A reference-image price is
 * safe because this worker never sends an input image; token, megapixel,
 * request, and text-input pricing are rejected rather than estimated from a
 * future provider schema.
 */
function hasOnlyFixedImageOutputPricing(pricing: unknown): boolean {
  if (!Array.isArray(pricing) || pricing.length === 0) return false;
  for (const rawEntry of pricing) {
    const entry = asRecord(rawEntry) as OpenRouterImagePricing | null;
    if (!entry) return false;
    const cost = entry?.cost_usd;
    if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) return false;
    if (cost === 0) continue;
    if (entry.billable === 'output_image' && entry.unit === 'image') continue;
    // The request payload below never has input_references, so these charges
    // are unavailable to this exact route. Do not generalize this exception
    // to text or per-request pricing: the prompt is always supplied.
    if (
      (entry.billable === 'input_image' || entry.billable === 'input_reference') &&
      entry.unit === 'image'
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function capabilityRecord(value: unknown): Record<string, OpenRouterCapability> | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const result: Record<string, OpenRouterCapability> = {};
  for (const [key, descriptor] of Object.entries(raw)) {
    const record = asRecord(descriptor);
    if (record) result[key] = record;
  }
  return result;
}

function supportsEnum(
  capabilities: Record<string, OpenRouterCapability>,
  key: string,
  value: string,
): boolean {
  const capability = capabilities[key];
  return capability?.type === 'enum' && asStringArray(capability.values).includes(value);
}

function supportsOneImage(capabilities: Record<string, OpenRouterCapability>): boolean {
  const capability = capabilities.n;
  return (
    capability?.type === 'range' &&
    typeof capability.min === 'number' &&
    typeof capability.max === 'number' &&
    capability.min <= 1 &&
    capability.max >= 1
  );
}

function imageModelFamily(model: string): 'seedream' | 'qwen' | null {
  const id = model.toLowerCase();
  // The daily budget is intentionally for a premium explanatory cover, not a
  // cheap variant experiment. A same-generation Lite SKU is not evidence of a
  // quality upgrade, so only stable Pro generations can enter auto-routing.
  if (/^bytedance-seed\/seedream-\d+(?:[-.]\d+)*-pro$/u.test(id)) {
    return 'seedream';
  }
  if (/^qwen\/qwen-image-\d+(?:[-.]\d+)*-pro$/u.test(id)) return 'qwen';
  return null;
}

function imageModelGeneration(model: string): number {
  const matched = /(?:seedream|qwen-image)-(\d+)(?:[-.](\d+))?/iu.exec(model);
  if (!matched) return 0;
  const major = Number.parseInt(matched[1] ?? '0', 10);
  const minor = Number.parseInt(matched[2] ?? '0', 10);
  return Number.isFinite(major) && Number.isFinite(minor) ? major * 1_000 + minor : 0;
}

function isProModel(model: string): boolean {
  return model.toLowerCase().endsWith('-pro');
}

function routeIdentity(route: DailyVisualImageModelRoute): string {
  return `${route.model}|${route.provider}|${route.resolution}`;
}

function sameRoute(left: DailyVisualImageModelRoute, right: DailyVisualImageModelRoute): boolean {
  return routeIdentity(left) === routeIdentity(right);
}

function routePriority(
  left: DailyVisualImageModelRoute,
  right: DailyVisualImageModelRoute,
): number {
  const leftExactChampion = left.model === 'bytedance-seed/seedream-5-0-pro' ? 0 : 1;
  const rightExactChampion = right.model === 'bytedance-seed/seedream-5-0-pro' ? 0 : 1;
  if (leftExactChampion !== rightExactChampion) return leftExactChampion - rightExactChampion;
  const leftFamily = imageModelFamily(left.model) === 'seedream' ? 0 : 1;
  const rightFamily = imageModelFamily(right.model) === 'seedream' ? 0 : 1;
  if (leftFamily !== rightFamily) return leftFamily - rightFamily;
  const leftPro = isProModel(left.model) ? 0 : 1;
  const rightPro = isProModel(right.model) ? 0 : 1;
  if (leftPro !== rightPro) return leftPro - rightPro;
  const generation = imageModelGeneration(right.model) - imageModelGeneration(left.model);
  if (generation !== 0) return generation;
  const created = (right.catalogCreatedAt ?? 0) - (left.catalogCreatedAt ?? 0);
  if (created !== 0) return created;
  const cost = left.fixedCostMicroUsd - right.fixedCostMicroUsd;
  if (cost !== 0) return cost;
  return routeIdentity(left).localeCompare(routeIdentity(right));
}

function exactRouteFromCatalog(
  route: DailyVisualImageModelRoute,
  catalogRoutes: readonly DailyVisualImageModelRoute[],
): DailyVisualImageModelRoute | null {
  return catalogRoutes.find((candidate) => sameRoute(candidate, route)) ?? null;
}

function preferredAlternative(
  primary: DailyVisualImageModelRoute,
  catalogRoutes: readonly DailyVisualImageModelRoute[],
): DailyVisualImageModelRoute | null {
  const differentFamily = catalogRoutes.filter(
    (candidate) =>
      !sameRoute(candidate, primary) &&
      imageModelFamily(candidate.model) !== imageModelFamily(primary.model),
  );
  const candidates = differentFamily.length
    ? differentFamily
    : catalogRoutes.filter((candidate) => !sameRoute(candidate, primary));
  return [...candidates].sort(routePriority)[0] ?? null;
}

function isNewChallenger(
  candidate: DailyVisualImageModelRoute,
  champion: DailyVisualImageModelRoute,
): boolean {
  if (sameRoute(candidate, champion)) return false;
  const candidateFamily = imageModelFamily(candidate.model);
  const championFamily = imageModelFamily(champion.model);
  if (candidateFamily && candidateFamily === championFamily) {
    return imageModelGeneration(candidate.model) > imageModelGeneration(champion.model);
  }
  return (
    candidate.catalogCreatedAt !== null &&
    champion.catalogCreatedAt !== null &&
    candidate.catalogCreatedAt > champion.catalogCreatedAt
  );
}

function bestChallenger(
  champion: DailyVisualImageModelRoute,
  catalogRoutes: readonly DailyVisualImageModelRoute[],
  rejectedModelIds: ReadonlySet<string>,
): DailyVisualImageModelRoute | null {
  const challengers = catalogRoutes.filter(
    (candidate) => !rejectedModelIds.has(candidate.model) && isNewChallenger(candidate, champion),
  );
  return (
    [...challengers].sort((left, right) => {
      const leftSameFamily =
        imageModelFamily(left.model) === imageModelFamily(champion.model) ? 0 : 1;
      const rightSameFamily =
        imageModelFamily(right.model) === imageModelFamily(champion.model) ? 0 : 1;
      if (leftSameFamily !== rightSameFamily) return leftSameFamily - rightSameFamily;
      const created = (right.catalogCreatedAt ?? 0) - (left.catalogCreatedAt ?? 0);
      if (created !== 0) return created;
      return routePriority(left, right);
    })[0] ?? null
  );
}

function asCatalogCreatedAt(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function parseCatalogModels(value: unknown): OpenRouterImageModel[] {
  const root = asRecord(value) as OpenRouterImageModelsResponse | null;
  return Array.isArray(root?.data)
    ? root.data
        .map((entry) => asRecord(entry) as OpenRouterImageModel | null)
        .filter((entry): entry is OpenRouterImageModel => entry !== null)
    : [];
}

function parseEndpoints(value: unknown): OpenRouterImageEndpoint[] {
  const root = asRecord(value) as OpenRouterImageEndpointsResponse | null;
  return Array.isArray(root?.endpoints)
    ? root.endpoints
        .map((entry) => asRecord(entry) as OpenRouterImageEndpoint | null)
        .filter((entry): entry is OpenRouterImageEndpoint => entry !== null)
    : [];
}

function catalogSupportsImageGeneration(model: OpenRouterImageModel): boolean {
  const architecture = asRecord(model.architecture);
  const inputs = asStringArray(architecture?.input_modalities);
  const outputs = asStringArray(architecture?.output_modalities);
  return inputs.includes('text') && outputs.includes('image');
}

function modelCandidatesForLookup(
  models: readonly OpenRouterImageModel[],
  currentChampion: DailyVisualImageModelRoute | null | undefined,
): OpenRouterImageModel[] {
  const grouped = new Map<'seedream' | 'qwen', OpenRouterImageModel[]>();
  for (const model of models) {
    const id = asNonEmptyString(model.id);
    const family = id ? imageModelFamily(id) : null;
    if (!id || !family || !catalogSupportsImageGeneration(model)) continue;
    const entries = grouped.get(family) ?? [];
    entries.push(model);
    grouped.set(family, entries);
  }
  const newestByFamily = [...grouped.values()].flatMap((entries) =>
    [...entries]
      .sort((left, right) => {
        const leftId = asNonEmptyString(left.id) ?? '';
        const rightId = asNonEmptyString(right.id) ?? '';
        const generation = imageModelGeneration(rightId) - imageModelGeneration(leftId);
        if (generation !== 0) return generation;
        const pro = Number(!isProModel(leftId)) - Number(!isProModel(rightId));
        if (pro !== 0) return pro;
        return (asCatalogCreatedAt(right.created) ?? 0) - (asCatalogCreatedAt(left.created) ?? 0);
      })
      .slice(0, MAX_CATALOG_MODELS_PER_FAMILY),
  );
  // The newest-N cap bounds discovery traffic. It must not make an already
  // approved champion disappear when several newer releases arrive at once.
  const championId = currentChampion?.model.toLowerCase();
  const champion = models.find((model) => {
    const id = asNonEmptyString(model.id);
    return Boolean(
      championId &&
      id?.toLowerCase() === championId &&
      imageModelFamily(id) &&
      catalogSupportsImageGeneration(model),
    );
  });
  const seen = new Set<string>();
  return [...newestByFamily, ...(champion ? [champion] : [])].filter((model) => {
    const id = asNonEmptyString(model.id)?.toLowerCase();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function endpointRoute(
  model: OpenRouterImageModel,
  endpoint: OpenRouterImageEndpoint,
): DailyVisualImageModelRoute | null {
  const id = asNonEmptyString(model.id);
  const provider = asNonEmptyString(endpoint.provider_tag, 64);
  const capabilities = capabilityRecord(endpoint.supported_parameters);
  if (!id || !imageModelFamily(id) || !provider || !isSafeProviderTag(provider) || !capabilities)
    return null;
  if (
    !supportsEnum(capabilities, 'aspect_ratio', IMAGE_ASPECT_RATIO) ||
    !supportsOneImage(capabilities)
  ) {
    return null;
  }
  if (!hasOnlyFixedImageOutputPricing(endpoint.pricing)) return null;
  const baseResolution = lowestDeclaredResolution(capabilities);
  for (const resolution of IMAGE_RESOLUTIONS) {
    if (!supportsEnum(capabilities, 'resolution', resolution)) continue;
    const costUsd = outputPriceForResolution(
      endpoint.pricing,
      resolution,
      baseResolution !== null && normalizedVariant(baseResolution) === normalizedVariant(resolution),
    );
    if (costUsd === null) continue;
    const fixedCostMicroUsd = Math.ceil(costUsd * 1_000_000);
    if (
      !Number.isSafeInteger(fixedCostMicroUsd) ||
      fixedCostMicroUsd > DAILY_VISUAL_PRIMARY_MAX_COST_MICRO_USD ||
      fixedCostMicroUsd > DAILY_VISUAL_REPAIR_MAX_COST_MICRO_USD
    ) {
      continue;
    }
    return {
      model: id,
      provider,
      resolution,
      aspectRatio: IMAGE_ASPECT_RATIO,
      fixedCostMicroUsd,
      catalogCreatedAt: asCatalogCreatedAt(model.created),
    };
  }
  return null;
}

function stableCatalogHash(routes: readonly DailyVisualImageModelRoute[]): string {
  const normalized = [...routes]
    .sort((left, right) => routeIdentity(left).localeCompare(routeIdentity(right)))
    .map((route) => ({
      model: route.model,
      provider: route.provider,
      resolution: route.resolution,
      cost: route.fixedCostMicroUsd,
      created: route.catalogCreatedAt,
    }));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function parseModelRoute(value: unknown): DailyVisualImageModelRoute | null {
  const route = asRecord(value);
  const model = asNonEmptyString(route?.model);
  const provider = asNonEmptyString(route?.provider, 64);
  const resolution = route?.resolution;
  const aspectRatio = route?.aspectRatio;
  const fixedCostMicroUsd = route?.fixedCostMicroUsd;
  const catalogCreatedAt = route?.catalogCreatedAt;
  if (
    !model ||
    !imageModelFamily(model) ||
    !provider ||
    !isSafeProviderTag(provider) ||
    !isImageResolution(resolution) ||
    aspectRatio !== IMAGE_ASPECT_RATIO ||
    typeof fixedCostMicroUsd !== 'number' ||
    !Number.isSafeInteger(fixedCostMicroUsd) ||
    fixedCostMicroUsd <= 0 ||
    fixedCostMicroUsd > DAILY_VISUAL_PRIMARY_MAX_COST_MICRO_USD ||
    (catalogCreatedAt !== null &&
      (!Number.isSafeInteger(catalogCreatedAt) ||
        typeof catalogCreatedAt !== 'number' ||
        catalogCreatedAt < 0))
  ) {
    return null;
  }
  return {
    model,
    provider,
    resolution,
    aspectRatio: IMAGE_ASPECT_RATIO,
    fixedCostMicroUsd,
    catalogCreatedAt: catalogCreatedAt as number | null,
  };
}

/** Reject arbitrary JSONB before it can become a provider-routing payload. */
export function parseDailyVisualImageRoute(value: unknown): DailyVisualImageRoute | null {
  const route = asRecord(value);
  if (
    route?.policyId !== DAILY_VISUAL_IMAGE_ROUTE_POLICY_ID ||
    (route.strategy !== 'bootstrap' && route.strategy !== 'champion' && route.strategy !== 'canary')
  ) {
    return null;
  }
  const catalogHash = asNonEmptyString(route.catalogHash, 128);
  const primary = parseModelRoute(route.primary);
  const repair = parseModelRoute(route.repair);
  const winner = route.winner;
  if (
    !catalogHash ||
    !primary ||
    !repair ||
    sameRoute(primary, repair) ||
    (winner !== null && winner !== 'primary' && winner !== 'repair')
  ) {
    return null;
  }
  return {
    policyId: DAILY_VISUAL_IMAGE_ROUTE_POLICY_ID,
    strategy: route.strategy,
    catalogHash,
    primary,
    repair,
    winner,
  };
}

export function withDailyVisualImageRouteWinner(
  route: DailyVisualImageRoute,
  winner: DailyVisualImageRouteWinner,
): DailyVisualImageRoute {
  return { ...route, winner };
}

export function winningDailyVisualImageModelRoute(
  route: DailyVisualImageRoute,
): DailyVisualImageModelRoute | null {
  if (route.winner === 'primary') return route.primary;
  if (route.winner === 'repair') return route.repair;
  return null;
}

function routeFromEligibleCatalog(
  catalogRoutes: readonly DailyVisualImageModelRoute[],
  input: {
    currentChampion?: DailyVisualImageModelRoute | null;
    rejectedModelIds?: ReadonlySet<string>;
  },
): DailyVisualImageRoute {
  const catalogHash = stableCatalogHash(catalogRoutes);
  const rejectedModelIds = input.rejectedModelIds ?? new Set<string>();
  const priorChampion = input.currentChampion
    ? exactRouteFromCatalog(input.currentChampion, catalogRoutes)
    : null;
  if (input.currentChampion && !priorChampion) {
    throw new Error('The current daily visual champion is not live-eligible in the image catalog.');
  }
  const champion = priorChampion ?? [...catalogRoutes].sort(routePriority)[0]!;
  const challenger = priorChampion
    ? bestChallenger(champion, catalogRoutes, rejectedModelIds)
    : null;
  if (challenger) {
    return {
      policyId: DAILY_VISUAL_IMAGE_ROUTE_POLICY_ID,
      strategy: 'canary',
      catalogHash,
      primary: challenger,
      repair: champion,
      winner: null,
    };
  }
  const repair = preferredAlternative(champion, catalogRoutes) ?? champion;
  if (sameRoute(champion, repair)) {
    throw new Error('The image catalog did not provide an independent fixed-price repair route.');
  }
  return {
    policyId: DAILY_VISUAL_IMAGE_ROUTE_POLICY_ID,
    strategy: priorChampion ? 'champion' : 'bootstrap',
    catalogHash,
    primary: champion,
    repair,
    winner: null,
  };
}

function resolveOpenRouterApiKey(env: Record<string, string | undefined>): string | null {
  return env.OPEN_ROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim() || null;
}

async function requestJson(url: string, apiKey: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://aitodaybrief.com',
      'X-Title': 'AI Today Brief Daily Visual',
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenRouter image catalog HTTP ${response.status}.`);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error('OpenRouter image catalog returned invalid JSON.');
  }
}

/**
 * Reads the image-only catalog, not OpenRouter's opaque auto router. A model
 * is eligible only when the exact pinned provider can make one native 16:9
 * image at a fixed price inside the existing hard reservation.
 */
export async function resolveDailyVisualImageRoute(
  input: {
    currentChampion?: DailyVisualImageModelRoute | null;
    rejectedModelIds?: ReadonlySet<string>;
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<DailyVisualImageRoute> {
  const env = input.env ?? process.env;
  const apiKey = resolveOpenRouterApiKey(env);
  if (!apiKey) throw new Error('OPEN_ROUTER_API_KEY is not configured.');
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const catalogPayload = await requestJson(OPENROUTER_IMAGE_MODELS_URL, apiKey, fetchImpl);
    const models = modelCandidatesForLookup(
      parseCatalogModels(catalogPayload),
      input.currentChampion,
    );
    const candidateRoutes: DailyVisualImageModelRoute[] = [];
    const endpointPayloads = await Promise.allSettled(
      models.map(async (model) => {
        const id = asNonEmptyString(model.id);
        if (!id) return null;
        return {
          model,
          endpointPayload: await requestJson(
            `${OPENROUTER_IMAGE_MODELS_URL}/${id}/endpoints`,
            apiKey,
            fetchImpl,
          ),
        };
      }),
    );
    for (const result of endpointPayloads) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      for (const endpoint of parseEndpoints(result.value.endpointPayload)) {
        const route = endpointRoute(result.value.model, endpoint);
        if (route) candidateRoutes.push(route);
      }
    }
    if (candidateRoutes.length === 0) {
      throw new Error('The image catalog had no eligible fixed-price 16:9 Pro routes.');
    }
    return routeFromEligibleCatalog(candidateRoutes, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A catalog outage or a missing champion is a manual-choice state. It is
    // never permission to bill a hard-coded model at an unknown new price.
    throw new Error(`OpenRouter image route discovery failed: ${message}`);
  }
}

function allowedMediaType(value: unknown): DailyVisualImageMediaType | null {
  return typeof value === 'string' && (ALLOWED_MEDIA_TYPES as readonly string[]).includes(value)
    ? (value as DailyVisualImageMediaType)
    : null;
}

function firstImage(
  value: unknown,
): { encoded: string; mimeType: DailyVisualImageMediaType } | null {
  const root = asRecord(value) as OpenRouterImageGenerationResponse | null;
  if (!Array.isArray(root?.data)) return null;
  const first = asRecord(root.data[0]);
  const encoded = asNonEmptyString(first?.b64_json, 20_000_000);
  if (!encoded) return null;
  return { encoded, mimeType: allowedMediaType(first?.media_type) ?? 'image/png' };
}

function reportedImageCost(value: unknown): number | null {
  const root = asRecord(value) as OpenRouterImageGenerationResponse | null;
  const cost = root?.usage?.cost;
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null;
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

/** One pinned OpenRouter image request; no provider or model fallback is implicit. */
export async function generateDailyVisualImage(
  prompt: string,
  rawRoute: DailyVisualImageModelRoute,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<DailyVisualRenderedImage> {
  const apiKey = resolveOpenRouterApiKey(env);
  if (!apiKey) throw new DailyVisualImageError('OPEN_ROUTER_API_KEY is not configured.', false);
  if (!prompt.trim()) throw new DailyVisualImageError('Daily visual image prompt is empty.', false);
  const route = parseModelRoute(rawRoute);
  if (!route) throw new DailyVisualImageError('Daily visual image route is invalid.', false);

  let response: Response;
  try {
    response = await fetchImpl(OPENROUTER_IMAGE_API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'HTTP-Referer': 'https://aitodaybrief.com',
        'X-Title': 'AI Today Brief Daily Visual',
      },
      body: JSON.stringify({
        model: route.model,
        prompt,
        n: 1,
        resolution: route.resolution,
        aspect_ratio: route.aspectRatio,
        provider: {
          only: [route.provider],
          allow_fallbacks: false,
          require_parameters: true,
          // OpenRouter rejects the request before provider dispatch if this
          // image price is no longer available. The later usage check is an
          // audit fence, not the first line of budget protection.
          max_price: { image: route.fixedCostMicroUsd / 1_000_000 },
        },
      }),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DailyVisualImageError(`OpenRouter image request did not complete: ${message}`, true);
  }

  if (!response.ok) {
    const message = await safeErrorMessage(response);
    throw new DailyVisualImageError(
      `OpenRouter image request failed: ${message}`,
      isAmbiguousHttpStatus(response.status),
    );
  }

  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new DailyVisualImageError('OpenRouter image response was not valid JSON.', true);
  }
  const image = firstImage(payload);
  if (!image) {
    throw new DailyVisualImageError(
      'OpenRouter image response did not contain usable image bytes.',
      true,
    );
  }
  const bytes = Buffer.from(image.encoded, 'base64');
  if (bytes.length === 0) {
    throw new DailyVisualImageError('OpenRouter image response contained empty image bytes.', true);
  }
  const costUsd = reportedImageCost(payload);
  return {
    bytes,
    mimeType: image.mimeType,
    provider: 'openrouter',
    model: route.model,
    usage: { costUsd, costSource: costUsd === null ? 'unknown' : 'reported' },
  };
}
