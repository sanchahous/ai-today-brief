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
import type { OpenRouterResponseValidator } from '../../../pipeline/openrouter-brief-json';
import {
  generateWithHttpProviderChain,
  OPENROUTER_HTTP_DEFAULTS,
  type HttpProviderConfig,
} from '../../../pipeline/providers/http-provider';
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
  writer: ['deepseek', 'qwen', 'openai', 'anthropic', 'x-ai'],
};

const MODEL_FRESHNESS_SECONDS = 400 * 24 * 60 * 60;

export class SocialLlmExhaustedError extends Error {
  constructor(readonly attempts: SocialLlmAttempt[]) {
    super(
      `All configured social LLM providers failed -- ${attempts
        .map((a) => `${a.provider}${a.model ? `/${a.model}` : ''}: ${a.status}${a.reason ? ` (${a.reason})` : ''}`)
        .join(' | ')}`,
    );
    this.name = 'SocialLlmExhaustedError';
  }
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
): string[] {
  const providerPriority = OPENROUTER_PROVIDER_PRIORITY[role];
  const eligible = models.filter(
    (model) => isSocialTextModel(model) && providerPriority.includes(providerFromModelId(model.id)),
  );
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
  const ranked = rankSocialOpenRouterModels(models, role);
  const configured = commaList(
    role === 'critic' ? env.SOCIAL_CRITIC_OPENROUTER_MODELS : env.SOCIAL_WRITER_OPENROUTER_MODELS,
  );
  const allowed = new Set(ranked);
  const queue = (configured.length > 0 ? configured.filter((id) => allowed.has(id)) : ranked).slice(
    0,
    3,
  );
  if (queue.length === 0) throw new Error('No current OpenRouter models satisfy the social role.');
  return queue;
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
  const registry = await loadProviderRegistry(process.env, {}, db);
  const resolved = registry.chainForRole(providerRole).find((entry) => entry.entry.kind === 'http');
  return resolved?.http ?? null;
}

async function generateOpenRouter<T>(
  input: ProviderInput<T>,
  fetchModels: (apiKey: string) => Promise<OpenRouterModelRecord[]>,
  db?: PipelineDb,
): Promise<ProviderOutput> {
  const validateResponse: OpenRouterResponseValidator = (_modelId, text, finishReason) => {
    if (finishReason === 'length') throw new SyntaxError('Truncated social JSON response.');
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
      const result = await generateWithHttpProviderChain(input.prompt, dbHttp, { validateResponse });
      return {
        text: result.text,
        model: result.model,
        fallbackUsed: result.model !== dbHttp.modelQueue[0],
      };
    } catch (error) {
      logEvent(
        'warn',
        'social-llm',
        'Owner-configured OpenRouter provider failed -- falling back to the default OpenRouter path',
        { role: input.role, provider: dbHttp.id, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  const apiKey = openRouterApiKey(input.env);
  if (!apiKey) throw new Error('UNCONFIGURED:OPEN_ROUTER_API_KEY');
  const modelQueue = await resolveSocialOpenRouterQueue(input.role, apiKey, input.env, fetchModels);
  const result = await generateWithHttpProviderChain(
    input.prompt,
    { id: 'openrouter', apiKey, modelQueue, ...OPENROUTER_HTTP_DEFAULTS },
    { validateResponse },
  );
  return {
    text: result.text,
    model: result.model,
    fallbackUsed: result.model !== modelQueue[0],
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
      const promptTokens = Math.max(1, Math.ceil(prompt.length / 4));
      const outputTokens = Math.max(1, Math.ceil(output.text.length / 4));
      const inputRate = Number(env.SOCIAL_LLM_INPUT_USD_PER_MILLION ?? '0.3');
      const outputRate = Number(env.SOCIAL_LLM_OUTPUT_USD_PER_MILLION ?? '1');
      attempts.push({ provider, status: 'success', model: output.model });
      return {
        value,
        provider,
        model: output.model,
        fallbackUsed: attempts.length > 1 || Boolean(output.fallbackUsed),
        attempts,
        usage: {
          promptTokens,
          outputTokens,
          estimatedCostUsd: Number(
            ((promptTokens * inputRate + outputTokens * outputRate) / 1_000_000).toFixed(6),
          ),
        },
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
