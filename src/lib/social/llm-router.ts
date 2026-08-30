import 'server-only';

import { SchemaType } from '@google/generative-ai';
import type { PipelineDb } from '../../../pipeline/db';
import { resolveGeminiModelQueue } from '../../../pipeline/gemini-models';
import { logEvent } from '../../../pipeline/log';
import {
  fetchOpenRouterModels,
  isUnstableOpenRouterModelId,
  type OpenRouterModelRecord,
} from '../../../pipeline/openrouter-models';
import {
  OpenRouterIncompleteJsonError,
  type OpenRouterResponseValidator,
} from '../../../pipeline/openrouter-brief-json';
import {
  generateWithHttpProviderChain,
  OPENROUTER_HTTP_DEFAULTS,
  type HttpProviderConfig,
} from '../../../pipeline/providers/http-provider';
import type { ProviderUsage } from '../../../pipeline/providers/types';
import { loadProviderRegistry, type ProviderRole } from '../../../pipeline/providers/registry';
import { generateWithModelQueue, type GeminiResponseSchema } from '../../../pipeline/summarize';

export type SocialLlmRole = 'writer' | 'critic';
export type SocialLlmProvider = 'gemini' | 'openrouter' | 'ollama';
export type SocialLlmEnv = Record<string, string | undefined>;

export interface SocialLlmAttempt {
  provider: SocialLlmProvider;
  status: 'success' | 'failed' | 'unconfigured';
  model?: string;
  reason?: 'missing_config' | 'request_failed' | 'invalid_response';
}

export interface SocialLlmResult<T> {
  value: T;
  provider: SocialLlmProvider;
  model: string;
  fallbackUsed: boolean;
  attempts: SocialLlmAttempt[];
  usage: {
    promptTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
}

interface ProviderOutput {
  text: string;
  model: string;
  fallbackUsed?: boolean;
  /** Real billed usage when the provider reports it (OpenRouter does). */
  usage?: ProviderUsage;
  /** Billed usage from chain attempts whose answer was rejected. */
  discarded?: ProviderUsage[];
}

interface ProviderInput<T> {
  prompt: string;
  role: SocialLlmRole;
  parse: (raw: string) => T;
  env: SocialLlmEnv;
}

type ProviderGenerator = <T>(input: ProviderInput<T>) => Promise<ProviderOutput>;

interface SocialLlmDependencies {
  generators?: Partial<Record<SocialLlmProvider, ProviderGenerator>>;
  fetchOpenRouterModels?: (apiKey: string) => Promise<OpenRouterModelRecord[]>;
  fetchFn?: typeof fetch;
}

const PROVIDERS: readonly SocialLlmProvider[] = ['gemini', 'openrouter', 'ollama'];
// Gemini dropped from the default rotation (2026-08-06, owner request): the free
// tier has no usable premium model for this workload. The 'gemini' client stays
// wired and testable -- SOCIAL_WRITER_PROVIDER_ORDER / SOCIAL_CRITIC_PROVIDER_ORDER
// can still opt back in explicitly. Writer/critic independence no longer comes
// from a different first-choice provider here; it's enforced at call time via
// generateSocialJson's excludeProviders (see social-adapter.ts).
const DEFAULT_PROVIDER_ORDER: Record<SocialLlmRole, readonly SocialLlmProvider[]> = {
  writer: ['openrouter', 'ollama'],
  critic: ['openrouter', 'ollama'],
};

const GEMINI_SCHEMAS: Record<SocialLlmRole, GeminiResponseSchema> = {
  writer: {
    type: SchemaType.OBJECT,
    properties: {
      text: { type: SchemaType.STRING },
      firstComment: { type: SchemaType.STRING },
    },
    required: ['text'],
  },
  critic: {
    type: SchemaType.OBJECT,
    properties: {
      score: { type: SchemaType.NUMBER },
      flags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      platformFitScore: { type: SchemaType.NUMBER },
      platformFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    },
    required: ['score', 'flags'],
  },
};

const OPENROUTER_PROVIDER_PRIORITY: Record<SocialLlmRole, readonly string[]> = {
  critic: ['openai', 'anthropic', 'deepseek', 'x-ai', 'qwen'],
  // Production 2026-08-17: both DeepSeek lanes missed the first-token budget
  // and Qwen returned 429 before Telegram could save a checkpoint. Prefer the
  // current efficient OpenAI lane for short social JSON; provider diversity
  // remains available in the bounded tail.
  writer: ['openai', 'anthropic', 'deepseek', 'qwen', 'x-ai'],
};

const MODEL_FRESHNESS_SECONDS = 400 * 24 * 60 * 60;

/**
 * Social calls are prompt-heavy — the whole digest plus the channel contract
 * and the repair history go in, a few hundred tokens of JSON come out (live
 * ledger 2026-08-28: ~50k prompt vs ~1-6k completion) — so the blended rate a
 * model actually costs us is dominated by its input price.
 */
const SOCIAL_TOKEN_MIX = { prompt: 0.9, completion: 0.1 } as const;

/**
 * Blended USD/M above which a model may not enter a social queue at all.
 *
 * The ranking below had no price term whatsoever: `openRouterRoleScore` gave
 * every `~*-latest` alias a flat -10 000 and then broke ties on `created`. For
 * the anthropic lane that made `~anthropic/claude-fable-latest` ($10/M in,
 * $50/M out — $14.00/M blended) beat `~anthropic/claude-sonnet-latest`
 * ($2.80/M blended) by 0.0037 points of timestamp, so the single most
 * expensive text model in the catalog became the standing writer fallback.
 * Twelve calls on 2026-08-28 cost $4.66 — 51% of a $9.16 two-day bill — while
 * the ledger booked one of them at $0.0149.
 *
 * $1.50 is an owner decision (2026-08-29), tighter than the $3.50 that merely
 * excluded the frontier tier. It keeps the efficient writer lanes (the OpenAI
 * mini alias at $1.13, the Anthropic small alias at $1.40, deepseek and qwen
 * flash lanes near $0.04) and deliberately also drops the two lanes the critic
 * used to lead with — the standard OpenAI audit lane ($3.00) and the Anthropic
 * mid tier ($2.80). The critic therefore runs on cheaper families; that is a
 * quality trade the owner accepted, not an oversight. See
 * wiki/audits/2026-08-29-openrouter-spend-leak.md for the per-model table —
 * deliberately not repeated here, because pinning model versions in production
 * source is what the F5 grep forbids.
 */
export const DEFAULT_SOCIAL_MAX_PRICE_PER_MILLION = 1.5;

/**
 * Blended USD per million tokens from the live catalog, or null when the model
 * does not publish both rates. Null is treated as ineligible, not as free: an
 * unpriced model is exactly the case we cannot afford to guess at.
 */
export function socialBlendedPricePerMillion(model: OpenRouterModelRecord): number | null {
  const prompt = Number(model.pricing?.prompt);
  const completion = Number(model.pricing?.completion);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  if (prompt < 0 || completion < 0) return null;
  return (prompt * SOCIAL_TOKEN_MIX.prompt + completion * SOCIAL_TOKEN_MIX.completion) * 1_000_000;
}

export function resolveSocialMaxPricePerMillion(env: SocialLlmEnv = process.env): number {
  const parsed = Number(env.SOCIAL_LLM_MAX_PRICE_PER_MILLION);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SOCIAL_MAX_PRICE_PER_MILLION;
}

function resolveSocialOpenRouterAttemptCap(env: SocialLlmEnv): number {
  const parsed = Number.parseInt(env.SOCIAL_OPENROUTER_MODEL_ATTEMPTS ?? '2', 10);
  return Number.isFinite(parsed) ? Math.min(3, Math.max(1, parsed)) : 2;
}

export class SocialLlmExhaustedError extends Error {
  constructor(readonly attempts: SocialLlmAttempt[]) {
    super(
      `All configured social LLM providers failed -- ${attempts
        .map(
          (a) =>
            `${a.provider}${a.model ? `/${a.model}` : ''}: ${a.status}${a.reason ? ` (${a.reason})` : ''}`,
        )
        .join(' | ')}`,
    );
    this.name = 'SocialLlmExhaustedError';
  }
}

/**
 * What the call really cost, preferring the provider's own reported figure.
 *
 * The previous version ignored `usage` entirely and rebuilt everything from
 * `prompt.length / 4` at a hardcoded $0.3/$1 per M. Both halves were wrong:
 * the rates belong to no model we actually route to (`~openai/gpt-mini-latest`
 * bills $0.75/$4.50, `~anthropic/claude-fable-latest` $10/$50), and only the
 * winning attempt was ever counted. Discarded attempts are added here because
 * OpenRouter bills them the same — that is the difference between the $0.65
 * the ledger showed for 2026-08-28 and the $8.74 OpenRouter charged.
 */
function socialUsage(
  prompt: string,
  output: ProviderOutput,
  env: SocialLlmEnv,
): SocialLlmResult<unknown>['usage'] {
  const inputRate = Number(env.SOCIAL_LLM_INPUT_USD_PER_MILLION ?? '0.3');
  const outputRate = Number(env.SOCIAL_LLM_OUTPUT_USD_PER_MILLION ?? '1');
  const billed = [...(output.discarded ?? []), ...(output.usage ? [output.usage] : [])];

  let promptTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let anyReported = false;

  for (const entry of billed) {
    // A provider that reports tokens but not cost (NIM et al.) still gives us
    // real token counts — price those at the configured estimate rather than
    // dropping the call from the ledger.
    const entryPrompt = entry.promptTokens ?? 0;
    const entryOutput = entry.outputTokens ?? 0;
    promptTokens += entryPrompt;
    outputTokens += entryOutput;
    if (entry.costSource === 'reported' && entry.costUsd !== null) {
      costUsd += entry.costUsd;
      anyReported = true;
    } else {
      costUsd += (entryPrompt * inputRate + entryOutput * outputRate) / 1_000_000;
    }
  }

  if (promptTokens === 0 && outputTokens === 0) {
    // Gemini/Ollama report no usage at all — keep the old char heuristic.
    promptTokens = Math.max(1, Math.ceil(prompt.length / 4));
    outputTokens = Math.max(1, Math.ceil(output.text.length / 4));
    costUsd = (promptTokens * inputRate + outputTokens * outputRate) / 1_000_000;
  }

  if (billed.length > 1) {
    logEvent('info', 'social-llm', 'Social call billed across multiple attempts', {
      model: output.model,
      billed_calls: billed.length,
      discarded_calls: output.discarded?.length ?? 0,
      cost_usd: Number(costUsd.toFixed(6)),
      cost_source: anyReported ? 'reported' : 'estimated',
    });
  }

  return {
    promptTokens,
    outputTokens,
    estimatedCostUsd: Number(costUsd.toFixed(6)),
  };
}

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveSocialProviderOrder(
  role: SocialLlmRole,
  env: SocialLlmEnv = process.env,
): SocialLlmProvider[] {
  const configured = commaList(
    role === 'critic' ? env.SOCIAL_CRITIC_PROVIDER_ORDER : env.SOCIAL_WRITER_PROVIDER_ORDER,
  );
  const valid = configured.filter((item): item is SocialLlmProvider =>
    (PROVIDERS as readonly string[]).includes(item),
  );
  const order = valid.length > 0 ? valid : [...DEFAULT_PROVIDER_ORDER[role]];
  return [...new Set(order)];
}

function providerFromModelId(modelId: string): string {
  return modelId.replace(/^~/, '').split('/')[0]?.toLowerCase() ?? '';
}

function hasJsonOutput(model: OpenRouterModelRecord): boolean {
  const supported = model.supported_parameters;
  return (
    !supported || supported.includes('structured_outputs') || supported.includes('response_format')
  );
}

function isSocialTextModel(model: OpenRouterModelRecord): boolean {
  const lower = model.id.toLowerCase();
  if (lower.includes(':free') || isUnstableOpenRouterModelId(model.id)) return false;
  if (model.expiration_date) return false;
  if (/image|vision|audio|embedding|moderation|coder|code-/.test(lower)) return false;
  if ((model.context_length ?? 32_000) < 32_000) return false;
  if (!(model.architecture?.modality ?? 'text').includes('text')) return false;
  return hasJsonOutput(model);
}

function openRouterRoleScore(model: OpenRouterModelRecord, role: SocialLlmRole): number {
  const id = model.id.toLowerCase();
  let score = -(model.created ?? 0) / 1_000_000;
  if (id.startsWith('~') && id.endsWith('-latest')) score -= 10_000;
  // Price is a real tie-breaker, not decoration. Scaled so it decides between
  // siblings inside one provider family (the case the alias bonus used to
  // settle on a timestamp fraction) without overriding the role bands below.
  score += (socialBlendedPricePerMillion(model) ?? 0) * 100;

  if (role === 'critic') {
    if (/(^|[-/])(pro|max|opus|sonnet)([-/.]|$)/.test(id)) score -= 800;
    if (/mini|flash|lite|small/.test(id)) score += 1_500;
  } else {
    if (/mini|flash|lite|plus/.test(id)) score -= 700;
    if (/opus|sol-pro|ultra/.test(id)) score += 1_000;
  }
  return score;
}

function latestStandardTerra(models: OpenRouterModelRecord[]): OpenRouterModelRecord | undefined {
  return models
    .filter((model) => /^openai\/gpt-[0-9]+(?:\.[0-9]+)?-terra$/i.test(model.id))
    .sort((left, right) => (right.created ?? 0) - (left.created ?? 0))[0];
}

/**
 * Build a diverse, current OpenRouter queue: one model per provider family.
 * This avoids a "fallback" that merely retries an older release of the same
 * model and gives the critic genuine family independence.
 */
export function rankSocialOpenRouterModels(
  models: OpenRouterModelRecord[],
  role: SocialLlmRole,
  maxPricePerMillion: number = DEFAULT_SOCIAL_MAX_PRICE_PER_MILLION,
): string[] {
  const providerPriority = OPENROUTER_PROVIDER_PRIORITY[role];
  const eligible = models.filter((model) => {
    if (!isSocialTextModel(model) || !providerPriority.includes(providerFromModelId(model.id))) {
      return false;
    }
    const price = socialBlendedPricePerMillion(model);
    return price !== null && price <= maxPricePerMillion;
  });
  const newestCreated = Math.max(0, ...eligible.map((model) => model.created ?? 0));
  const current =
    newestCreated > 0
      ? eligible.filter(
          (model) => !model.created || newestCreated - model.created <= MODEL_FRESHNESS_SECONDS,
        )
      : eligible;

  const queue: string[] = [];
  for (const provider of providerPriority) {
    const providerModels = current.filter((model) => providerFromModelId(model.id) === provider);
    // Editorial audits use the balanced Terra lane, never the top-cost Sol
    // alias or Terra Pro. If standard Terra is absent, skip OpenAI entirely.
    const best =
      role === 'critic' && provider === 'openai'
        ? latestStandardTerra(providerModels)
        : providerModels.sort(
            (left, right) => openRouterRoleScore(left, role) - openRouterRoleScore(right, role),
          )[0];
    if (best) queue.push(best.id);
  }
  return queue;
}

async function resolveSocialOpenRouterQueue(
  role: SocialLlmRole,
  apiKey: string,
  env: SocialLlmEnv,
  fetchModels: (apiKey: string) => Promise<OpenRouterModelRecord[]>,
): Promise<string[]> {
  const models = await fetchModels(apiKey);
  const ranked = rankSocialOpenRouterModels(models, role, resolveSocialMaxPricePerMillion(env));
  const configured = commaList(
    role === 'critic' ? env.SOCIAL_CRITIC_OPENROUTER_MODELS : env.SOCIAL_WRITER_OPENROUTER_MODELS,
  );
  const allowed = new Set(ranked);
  const queue = (configured.length > 0 ? configured.filter((id) => allowed.has(id)) : ranked).slice(
    0,
    resolveSocialOpenRouterAttemptCap(env),
  );
  if (queue.length === 0) throw new Error('No current OpenRouter models satisfy the social role.');
  return queue;
}

/**
 * Completion ceilings, sized against what the models actually emitted.
 *
 * `max_tokens` covers reasoning as well as the answer, and `exclude: true`
 * only hides reasoning from the response -- it is still generated, billed and
 * counted here. The old ceilings did not allow for that and cut answers off
 * mid-JSON (2026-08-28): the critic's 2 048 was spent almost entirely on
 * thinking (one call reported 2 048 completion tokens of which 2 048 were
 * reasoning -- zero content), and the writer's 4 096 was too small for three
 * candidates plus ~2 300 reasoning tokens. Seven cut-off calls cost $0.82 and,
 * worse, each one dropped the queue onto a pricier model.
 *
 * Writer needs room for three full candidates; the critic's own answer is a
 * short JSON object, so its ceiling is almost entirely reasoning headroom.
 */
const SOCIAL_MAX_TOKENS: Record<SocialLlmRole, number> = { writer: 8_192, critic: 6_144 };

/** Widen once on a retry after a cut-off answer, capped so a runaway stays bounded. */
const TRUNCATION_RETRY_MULTIPLIER = 2;

export function socialMaxTokens(role: SocialLlmRole, env: SocialLlmEnv, attempt = 1): number {
  const parsed = Number.parseInt(
    role === 'critic'
      ? (env.SOCIAL_CRITIC_OPENROUTER_MAX_TOKENS ?? '')
      : (env.SOCIAL_WRITER_OPENROUTER_MAX_TOKENS ?? ''),
    10,
  );
  const base =
    Number.isFinite(parsed) && parsed > 0 ? parsed : SOCIAL_MAX_TOKENS[role];
  return attempt > 1 ? base * TRUNCATION_RETRY_MULTIPLIER : base;
}

function socialOpenRouterBody(role: SocialLlmRole, env: SocialLlmEnv, attempt = 1) {
  return {
    max_tokens: socialMaxTokens(role, env, attempt),
    // Social JSON is short. Low reasoning preserves the critic's independent
    // analysis without letting hidden thinking consume an editorial-master
    // token/time budget before a channel checkpoint can be saved.
    reasoning: { effort: 'low', exclude: true },
  };
}

function geminiApiKey(env: SocialLlmEnv): string | null {
  return env.GEMINI_API_KEY?.trim() || null;
}

function openRouterApiKey(env: SocialLlmEnv): string | null {
  return env.OPEN_ROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim() || null;
}

async function generateGemini<T>(input: ProviderInput<T>): Promise<ProviderOutput> {
  const apiKey = geminiApiKey(input.env);
  if (!apiKey) throw new Error('UNCONFIGURED:GEMINI_API_KEY');
  const pin =
    input.role === 'critic'
      ? input.env.SOCIAL_CRITIC_GEMINI_MODEL
      : input.env.SOCIAL_WRITER_GEMINI_MODEL;
  const queue = await resolveGeminiModelQueue(apiKey, {
    ...input.env,
    GEMINI_MODEL: pin,
    GEMINI_MAX_MODEL_ATTEMPTS: input.env.SOCIAL_GEMINI_MAX_MODEL_ATTEMPTS ?? '2',
  });
  const roleQueue =
    input.role === 'critic' ? queue.filter((model) => !model.includes('lite')) : queue;
  const result = await generateWithModelQueue(
    input.prompt,
    apiKey,
    (roleQueue.length > 0 ? roleQueue : queue).slice(0, 2),
    1,
    undefined,
    undefined,
    GEMINI_SCHEMAS[input.role],
  );
  input.parse(result.text);
  return { text: result.text, model: result.model, fallbackUsed: result.model !== queue[0] };
}

/**
 * An owner-configured HTTP provider for this role (e.g. a promo like NVIDIA
 * NIM, added via /admin/providers) takes over entirely -- its own model
 * list, no live-catalog ranking (rankSocialOpenRouterModels needs
 * OpenRouter's own benchmark/pricing fields, which a catalog-less provider
 * doesn't have -- see wiki/pipeline/llm-providers.md). Null when no `db` was
 * supplied or nothing is configured for this role.
 */
async function resolveSocialDbHttpProvider(
  role: SocialLlmRole,
  db?: PipelineDb,
): Promise<HttpProviderConfig | null> {
  if (!db) return null;
  const providerRole: ProviderRole = role === 'critic' ? 'social.critic' : 'social.writer';
  const { data: savedRole, error } = await db
    .from('llm_role_chains')
    .select('chain')
    .eq('role', providerRole)
    .maybeSingle();
  if (error) throw new Error(`Could not read ${providerRole} provider override: ${error.message}`);
  const rawChain = Array.isArray(savedRole?.chain) ? savedRole.chain : [];
  const configuredIds = new Set(
    rawChain.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const id = (entry as Record<string, unknown>).id;
      return typeof id === 'string' ? [id] : [];
    }),
  );
  if (configuredIds.size === 0) return null;
  const registry = await loadProviderRegistry(process.env, {}, db);
  const resolved = registry
    .chainForRole(providerRole)
    .find((entry) => entry.entry.kind === 'http' && configuredIds.has(entry.entry.id));
  return resolved?.http ?? null;
}

async function generateOpenRouter<T>(
  input: ProviderInput<T>,
  fetchModels: (apiKey: string) => Promise<OpenRouterModelRecord[]>,
  db?: PipelineDb,
): Promise<ProviderOutput> {
  const validateResponse: OpenRouterResponseValidator = (modelId, text, finishReason) => {
    // Typed, not a bare SyntaxError: the chain retries a cut-off answer on the
    // same model with a wider ceiling, but moves on from a malformed one.
    if (finishReason === 'length') {
      throw new OpenRouterIncompleteJsonError(
        modelId,
        text.length,
        'truncated social JSON response',
        finishReason,
      );
    }
    input.parse(text);
    return text;
  };

  const dbHttp = await resolveSocialDbHttpProvider(input.role, db);
  if (dbHttp) {
    // An owner-configured provider failing mid-call must not take down the
    // whole social generation -- fall through to the normal OpenRouter path
    // below instead of throwing, same as an unconfigured dbHttp (null)
    // already falls through.
    try {
      const result = await generateWithHttpProviderChain(
        input.prompt,
        {
          ...dbHttp,
          modelQueue: dbHttp.modelQueue.slice(0, resolveSocialOpenRouterAttemptCap(input.env)),
        },
        {
          validateResponse,
          extraBodyForModel: (_modelId, attempt) =>
            socialOpenRouterBody(input.role, input.env, attempt),
          retryTruncatedOnce: true,
        },
      );
      return {
        text: result.text,
        model: result.model,
        fallbackUsed: result.model !== dbHttp.modelQueue[0],
        usage: result.usage,
        discarded: result.discarded,
      };
    } catch (error) {
      logEvent(
        'warn',
        'social-llm',
        'Owner-configured OpenRouter provider failed -- falling back to the default OpenRouter path',
        {
          role: input.role,
          provider: dbHttp.id,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  const apiKey = openRouterApiKey(input.env);
  if (!apiKey) throw new Error('UNCONFIGURED:OPEN_ROUTER_API_KEY');
  const modelQueue = await resolveSocialOpenRouterQueue(input.role, apiKey, input.env, fetchModels);
  const result = await generateWithHttpProviderChain(
    input.prompt,
    { id: 'openrouter', apiKey, modelQueue, ...OPENROUTER_HTTP_DEFAULTS },
    {
      validateResponse,
      extraBodyForModel: (_modelId, attempt) => socialOpenRouterBody(input.role, input.env, attempt),
      retryTruncatedOnce: true,
    },
  );
  return {
    text: result.text,
    model: result.model,
    fallbackUsed: result.model !== modelQueue[0],
    usage: result.usage,
    discarded: result.discarded,
  };
}

export function rankLocalModelIds(ids: string[]): string[] {
  const eligible = ids.filter(
    (id) => !/embed|vision|image|audio|(^|[/_-])(bge|nomic|e5|gte)/i.test(id),
  );
  const score = (id: string) => {
    const version = /(?:qwen|llama|gemma)[-_]?([0-9]+(?:\.[0-9]+)?)/i.exec(id)?.[1];
    const size = /[:_-]([0-9]+)b(?:[-_:]|$)/i.exec(id)?.[1];
    return -(Number(version ?? 0) * 10_000 + Number(size ?? 0));
  };
  return [...new Set(eligible)].sort((left, right) => score(left) - score(right));
}

function safeOllamaBaseUrl(env: SocialLlmEnv): URL | null {
  const raw = env.SOCIAL_OLLAMA_BASE_URL?.trim();
  if (!raw) return null;
  const url = new URL(raw.endsWith('/') ? raw : `${raw}/`);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (env.VERCEL && loopback) throw new Error('Loopback Ollama is not reachable from Vercel.');
  if (!loopback && (url.protocol !== 'https:' || !env.SOCIAL_OLLAMA_API_KEY?.trim())) {
    throw new Error('Remote Ollama requires HTTPS and SOCIAL_OLLAMA_API_KEY.');
  }
  return url;
}

async function generateOllama<T>(
  input: ProviderInput<T>,
  fetchFn: typeof fetch,
): Promise<ProviderOutput> {
  const baseUrl = safeOllamaBaseUrl(input.env);
  if (!baseUrl) throw new Error('UNCONFIGURED:SOCIAL_OLLAMA_BASE_URL');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (input.env.SOCIAL_OLLAMA_API_KEY?.trim()) {
    headers.Authorization = `Bearer ${input.env.SOCIAL_OLLAMA_API_KEY.trim()}`;
  }
  const modelsResponse = await fetchFn(new URL('models', baseUrl), {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!modelsResponse.ok) throw new Error(`Ollama models HTTP ${modelsResponse.status}`);
  const modelsJson = (await modelsResponse.json()) as { data?: Array<{ id?: string }> };
  const ranked = rankLocalModelIds(
    (modelsJson.data ?? []).flatMap((model) => (model.id ? [model.id] : [])),
  );
  const configured = input.env.SOCIAL_OLLAMA_MODEL?.trim();
  const queue = configured && ranked.includes(configured) ? [configured] : ranked.slice(0, 2);
  if (queue.length === 0) throw new Error('No eligible local Ollama model is installed.');

  let lastError: unknown;
  for (const model of queue) {
    try {
      const response = await fetchFn(new URL('chat/completions', baseUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Return one valid JSON object only. Do not add markdown or commentary.',
            },
            { role: 'user', content: input.prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: input.role === 'critic' ? 0 : 0.3,
        }),
        signal: AbortSignal.timeout(
          Number.parseInt(input.env.SOCIAL_OLLAMA_TIMEOUT_MS ?? '240000', 10),
        ),
      });
      if (!response.ok) throw new Error(`Ollama completion HTTP ${response.status}`);
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Ollama returned an empty completion.');
      input.parse(text);
      return { text, model, fallbackUsed: model !== queue[0] };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Local Ollama models failed.');
}

function reasonFromError(error: unknown): SocialLlmAttempt['reason'] {
  if (error instanceof Error && error.message.startsWith('UNCONFIGURED:')) {
    return 'missing_config';
  }
  if (error instanceof SyntaxError) return 'invalid_response';
  return 'request_failed';
}

/** Generate and validate role-specific JSON through an independent provider cascade. */
export async function generateSocialJson<T>(
  role: SocialLlmRole,
  prompt: string,
  parse: (raw: string) => T,
  options: {
    env?: SocialLlmEnv;
    deps?: SocialLlmDependencies;
    excludeProviders?: readonly SocialLlmProvider[];
    /** Enables DB-driven role-chain overrides (owner-added HTTP providers via /admin/providers) for the openrouter slot. */
    db?: PipelineDb;
  } = {},
): Promise<SocialLlmResult<T>> {
  const env = options.env ?? process.env;
  const deps = options.deps ?? {};
  const attempts: SocialLlmAttempt[] = [];
  const fetchModels = deps.fetchOpenRouterModels ?? ((key: string) => fetchOpenRouterModels(key));
  const fetchFn = deps.fetchFn ?? fetch;

  const excluded = new Set(options.excludeProviders ?? []);
  const resolvedOrder = resolveSocialProviderOrder(role, env);
  const independent = resolvedOrder.filter((candidate) => !excluded.has(candidate));
  const sharedWithOtherRole = resolvedOrder.filter((candidate) => excluded.has(candidate));
  // Independence from the other role is a preference, not a hard requirement: try every
  // independent provider first, but if all of them fail too, fall through to the one(s) the
  // other role already used rather than throw while a working provider still exists.
  const providerOrder = [...independent, ...sharedWithOtherRole];
  for (const provider of providerOrder) {
    try {
      const injected = deps.generators?.[provider];
      const output = injected
        ? await injected({ prompt, role, parse, env })
        : provider === 'gemini'
          ? await generateGemini({ prompt, role, parse, env })
          : provider === 'openrouter'
            ? await generateOpenRouter({ prompt, role, parse, env }, fetchModels, options.db)
            : await generateOllama({ prompt, role, parse, env }, fetchFn);
      const value = parse(output.text);
      attempts.push({ provider, status: 'success', model: output.model });
      return {
        value,
        provider,
        model: output.model,
        fallbackUsed: attempts.length > 1 || Boolean(output.fallbackUsed),
        attempts,
        usage: socialUsage(prompt, output, env),
      };
    } catch (error) {
      const reason = reasonFromError(error);
      attempts.push({
        provider,
        status: reason === 'missing_config' ? 'unconfigured' : 'failed',
        reason,
      });
    }
  }
  throw new SocialLlmExhaustedError(attempts);
}
