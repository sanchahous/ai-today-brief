import 'server-only';

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PipelineDb } from '../../../pipeline/db';
import { resolveGeminiModelQueue } from '../../../pipeline/gemini-models';
import { logEvent } from '../../../pipeline/log';
import type { OpenRouterResponseValidator } from '../../../pipeline/openrouter-brief-json';
import {
  fetchOpenRouterModels,
  type OpenRouterModelRecord,
} from '../../../pipeline/openrouter-models';
import {
  rankOpenRouterModelsByValue,
  minimalReasoningEffort,
} from '../../../pipeline/openrouter-value';
import { generateWithClaudeCli } from '../../../pipeline/claude-cli';
import {
  generateWithHttpProviderChain,
  OPENROUTER_HTTP_DEFAULTS,
  type HttpProviderConfig,
} from '../../../pipeline/providers/http-provider';
import { loadProviderRegistry, type ProviderRole } from '../../../pipeline/providers/registry';
import type { ProviderCallResult } from '../../../pipeline/providers/types';
import {
  WEEKLY_MASTER_SPEC_VERSION,
  editorialQualityPasses,
  editorialQualityRetryGuidance,
  reportIsRevisable,
  validateMasterBundle,
  type WeeklyArticleMaster,
  type WeeklyContentQualityReport,
  type WeeklyMasterBundle,
  type WeeklyQualityDimension,
  type WeeklyQualityIssue,
  type WeeklyResearchPack,
} from './content-studio';
import { voicePromptBlock } from './editorial-voice';

type EditorialProvider = 'gemini' | 'openrouter' | 'claude-cli';

export interface WeeklyMasterInputStory {
  revisionItemId: string;
  rank: number;
  placement: 'feature' | 'radar';
  titleEn: string;
  titleUk: string;
  summaryEn: string;
  summaryUk: string;
  whyEn: string | null;
  whyUk: string | null;
  sources: Array<{ name: string; url: string }>;
  claims: Array<{ id: string; text: string; evidenceUrls: string[] }>;
  research?: WeeklyResearchPack;
  /**
   * Owner-set editorial angle for this story (PR4, weekly_digest_story_
   * directions), present only for the Top 3 features the owner has reviewed
   * in the Research tab before Start Content Studio. Treated as binding
   * editorial direction in englishPrompt, not just a suggestion.
   */
  angle?: string;
}

export interface EditorialGenerationMetadata {
  provider: EditorialProvider;
  model: string;
  promptTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  /**
   * 'reported' = real billed cost from the provider's own usage payload.
   * 'estimated' = char-count-derived guess, used only when the provider
   * didn't report real cost. Never trust 'estimated' for budget decisions.
   * 'subscription' = ran via the Claude Code CLI under a Pro/Max login —
   * real generation happened but it draws on session/weekly plan limits,
   * not the OpenRouter dollar budget, so estimatedCostUsd is always 0 here.
   */
  costSource: 'reported' | 'estimated' | 'subscription';
  promptVersion: string;
}

export interface WeeklyMasterGenerationResult {
  bundle: WeeklyMasterBundle;
  quality: WeeklyContentQualityReport;
  generation: {
    english: EditorialGenerationMetadata;
    ukrainian: EditorialGenerationMetadata;
    critic: EditorialGenerationMetadata;
  };
}

export interface WeeklyMasterRetryGuidance {
  code: string;
  message: string;
  suggestedFix?: string;
  locale?: 'en' | 'uk';
  revisionItemId?: string;
  field?: string;
}

export type WeeklyMasterProviderStep = 'english' | 'ukrainian' | 'critic' | 'revisions';

/** Lean evidence payload for writer/critic prompts (avoids dumping full research packs). */
export interface ApprovedStoryPromptMaterial {
  revisionItemId: string;
  rank: number;
  placement: 'feature' | 'radar';
  titleEn: string;
  titleUk: string;
  summaryEn: string;
  summaryUk: string;
  whyEn: string | null;
  whyUk: string | null;
  sources: Array<{ name: string; url: string }>;
  claims: Array<{ id: string; text: string; evidenceUrls: string[] }>;
  angle?: string;
  primarySourceExcerpt?: {
    url: string;
    sourceName: string;
    domain: string;
    excerpt: string;
  };
  corroboratingExcerpts?: Array<{
    url: string;
    sourceName: string;
    excerpt: string;
  }>;
}

const CORROBORATING_EXCERPT_PROMPT_CHARS = 1_500;

export function approvedStoryPromptMaterial(
  stories: WeeklyMasterInputStory[],
): ApprovedStoryPromptMaterial[] {
  return stories.map((story) => {
    const primary = story.research?.primarySource;
    const corroborating = story.research?.corroboratingSources ?? [];
    const material: ApprovedStoryPromptMaterial = {
      revisionItemId: story.revisionItemId,
      rank: story.rank,
      placement: story.placement,
      titleEn: story.titleEn,
      titleUk: story.titleUk,
      summaryEn: story.summaryEn,
      summaryUk: story.summaryUk,
      whyEn: story.whyEn,
      whyUk: story.whyUk,
      sources: story.sources,
      claims: story.claims,
    };
    if (story.angle?.trim()) material.angle = story.angle.trim();
    if (primary?.extractedText?.trim()) {
      material.primarySourceExcerpt = {
        url: primary.url,
        sourceName: primary.sourceName,
        domain: primary.domain,
        excerpt: primary.extractedText.trim(),
      };
    }
    const excerpts = corroborating
      .filter((source) => source.extractedText?.trim())
      .slice(0, 2)
      .map((source) => ({
        url: source.url,
        sourceName: source.sourceName,
        excerpt: source.extractedText.trim().slice(0, CORROBORATING_EXCERPT_PROMPT_CHARS),
      }));
    if (excerpts.length) material.corroboratingExcerpts = excerpts;
    return material;
  });
}

export function criticApprovedEvidence(stories: WeeklyMasterInputStory[]) {
  return approvedStoryPromptMaterial(stories).map((story) => ({
    revisionItemId: story.revisionItemId,
    claims: story.claims,
    ...(story.primarySourceExcerpt ? { primarySourceExcerpt: story.primarySourceExcerpt } : {}),
    ...(story.corroboratingExcerpts?.length
      ? { corroboratingExcerpts: story.corroboratingExcerpts }
      : {}),
  }));
}

export interface ProviderResult<T> {
  value: T;
  metadata: EditorialGenerationMetadata;
}

export type WeeklyMasterEnglishResult = ProviderResult<ReturnType<typeof parseEnglishPackage>>;
export type WeeklyMasterUkrainianResult = ProviderResult<WeeklyArticleMaster>;

/**
 * A prior attempt's EN/UK write, reusable when the caller has already
 * confirmed it matches the current research packs + retry guidance (see
 * generation-worker.ts). Letting a retry skip straight to the critic avoids
 * re-paying for a write that already succeeded and would produce the same
 * result again.
 */
export interface WeeklyMasterCheckpoint {
  // Both optional: the English and Ukrainian steps now cache independently
  // (see computeEnglishCheckpointHash/computeUkrainianCheckpointHash in
  // generation-worker.ts), so a checkpoint can carry just one of them --
  // e.g. English/video reused as-is while only Ukrainian regenerates after a
  // naturalness-only quality-gate failure.
  english?: WeeklyMasterEnglishResult;
  ukrainian?: WeeklyMasterUkrainianResult;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const normalized = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const value = JSON.parse(normalized) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SyntaxError('Editorial model must return one JSON object.');
  }
  return value as Record<string, unknown>;
}

function requiredString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) throw new SyntaxError(`${key} is required.`);
  return value.trim();
}

function stringArray(value: unknown, key: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new SyntaxError(`${key} must be a non-empty string array.`);
  }
  return value.map((entry) => (entry as string).trim());
}

function recordArray(value: unknown, key: string) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))
  ) {
    throw new SyntaxError(`${key} must be an object array.`);
  }
  return value as Array<Record<string, unknown>>;
}

function parseArticle(raw: string, locale: 'en' | 'uk'): WeeklyArticleMaster {
  const row = parseJsonObject(raw);
  const stories = recordArray(row.stories, 'stories').map((story) => {
    const placement = requiredString(story, 'placement');
    if (placement !== 'feature' && placement !== 'radar')
      throw new SyntaxError('Invalid placement.');
    return {
      revisionItemId: requiredString(story, 'revisionItemId'),
      placement: placement as 'feature' | 'radar',
      headline: requiredString(story, 'headline'),
      summary: requiredString(story, 'summary'),
      hook: requiredString(story, 'hook'),
      body: requiredString(story, 'body'),
      why: requiredString(story, 'why'),
      practical: requiredString(story, 'practical'),
      limitation: requiredString(story, 'limitation'),
      takeaway: requiredString(story, 'takeaway'),
      // Radar stories legitimately send an empty string for both -- only
      // features require them, enforced deterministically in
      // validateMasterBundle (content-studio.ts), not by the parser.
      editorsView: typeof story.editorsView === 'string' ? story.editorsView.trim() : '',
      discussionQuestion:
        typeof story.discussionQuestion === 'string' ? story.discussionQuestion.trim() : '',
      claimIds: stringArray(story.claimIds, 'story.claimIds'),
    };
  });
  const links = recordArray(row.internalLinks, 'internalLinks').map((link) => ({
    anchor: requiredString(link, 'anchor'),
    query: requiredString(link, 'query'),
  }));
  return {
    locale,
    title: requiredString(row, 'title'),
    seoTitle: requiredString(row, 'seoTitle'),
    metaDescription: requiredString(row, 'metaDescription'),
    ogTitle: requiredString(row, 'ogTitle'),
    ogDescription: requiredString(row, 'ogDescription'),
    standfirst: requiredString(row, 'standfirst'),
    theme: requiredString(row, 'theme'),
    intro: requiredString(row, 'intro'),
    editorNote: requiredString(row, 'editorNote'),
    keyTakeaways: stringArray(row.keyTakeaways, 'keyTakeaways'),
    topics: stringArray(row.topics, 'topics'),
    entities: stringArray(row.entities, 'entities'),
    internalLinks: links,
    conclusion: requiredString(row, 'conclusion'),
    stories,
  };
}

function parseEnglishPackage(raw: string) {
  const row = parseJsonObject(raw);
  // video moved out of the master call entirely in PR6 (editorial quality
  // overhaul) -- see video-script-llm.ts. The one-sentence video contract
  // that used to live in englishPrompt's CONTRACT block, generated inside
  // the same 20k-token completion as the 2,000-3,000 word article, is the
  // documented root cause of the "silent slideshow" (durationSeconds was
  // invented to satisfy a 360-480s sum while narration text stayed ~1,000
  // chars -- see ai-today-brief-video's 2026-08-05-professional-ai-video-
  // guide.md). video_script is now its own job, run after the master
  // succeeds, writing real narration long enough for its claimed runtime.
  // socialAngles moved out in PR7 -- social-adapter.ts now proposes its own
  // angle per channel from the approved article, instead of the master
  // pre-baking one shared angle per channel that the writer never actually
  // saw the channel contract for.
  const article = parseArticle(JSON.stringify(row.article), 'en');
  return { article };
}

function parseCritic(raw: string) {
  const row = parseJsonObject(raw);
  const dimensions = recordArray(row.dimensions, 'dimensions').map((dimension) => ({
    name: requiredString(dimension, 'name') as WeeklyQualityDimension['name'],
    score: Number(dimension.score),
    // Commentary, not structural -- don't fail the whole critic pass when a
    // model leaves this blank for an unremarkable dimension.
    note: typeof dimension.note === 'string' ? dimension.note.trim() : '',
  }));
  if (
    dimensions.some(
      (dimension) =>
        !Number.isFinite(dimension.score) || dimension.score < 0 || dimension.score > 100,
    )
  ) {
    throw new SyntaxError('Critic scores must be numbers from 0 to 100.');
  }
  const requiredDimensions = [
    'engagement',
    'voice',
    'clarity',
    'trust',
    'usefulness',
    'naturalness',
    'parity',
  ];
  if (
    dimensions.length !== requiredDimensions.length ||
    requiredDimensions.some(
      (name) => dimensions.filter((dimension) => dimension.name === name).length !== 1,
    )
  ) {
    throw new SyntaxError('Critic must return each required quality dimension exactly once.');
  }
  const issues = recordArray(row.issues ?? [], 'issues').map((issue): WeeklyQualityIssue => ({
    code: requiredString(issue, 'code'),
    message: requiredString(issue, 'message'),
    blocker: issue.blocker === true,
    locale: issue.locale === 'en' || issue.locale === 'uk' ? issue.locale : undefined,
    revisionItemId: typeof issue.revisionItemId === 'string' ? issue.revisionItemId : undefined,
    field: typeof issue.field === 'string' ? issue.field : undefined,
    span: typeof issue.span === 'string' ? issue.span : undefined,
    suggestedFix: typeof issue.suggestedFix === 'string' ? issue.suggestedFix : undefined,
  }));
  const score = Number(row.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new SyntaxError('Overall critic score must be between 0 and 100.');
  }
  return {
    score,
    dimensions,
    issues,
    // The prompt asks for [] when clean; tolerate a missing/malformed field or
    // a stray "none" placeholder rather than failing the whole critic pass
    // over this one auxiliary list.
    factualFlags: (Array.isArray(row.factualFlags) ? row.factualFlags : [])
      .filter(
        (flag): flag is string =>
          typeof flag === 'string' && flag.trim() !== '' && flag.trim() !== 'none',
      )
      .map((flag) => flag.trim()),
  };
}

function estimateTokens(chars: number) {
  return Math.max(1, Math.ceil(chars / 4));
}

function estimateCost(promptTokens: number, outputTokens: number) {
  const inputRate = Number(process.env.WEEKLY_LLM_INPUT_USD_PER_MILLION ?? '3');
  const outputRate = Number(process.env.WEEKLY_LLM_OUTPUT_USD_PER_MILLION ?? '15');
  return Number(((promptTokens * inputRate + outputTokens * outputRate) / 1_000_000).toFixed(6));
}

// Gemini dropped from the default rotation (2026-08-06, owner request): the free
// tier has no usable premium model for this workload. The gemini client stays
// wired and testable -- WEEKLY_MASTER_PROVIDER_ORDER can still opt back in.
function providerOrder() {
  const configured = (process.env.WEEKLY_MASTER_PROVIDER_ORDER ?? 'claude-cli,openrouter')
    .split(',')
    .map((value) => value.trim())
    .filter(
      (value): value is EditorialProvider =>
        value === 'claude-cli' || value === 'openrouter' || value === 'gemini',
    );
  return [...new Set(configured)];
}

export function openRouterModelVendor(modelId: string) {
  return modelId.split('/', 1)[0]?.trim().toLowerCase() ?? '';
}

/**
 * Anthropic Analysis intelligence-index floor a candidate must clear to write
 * the master — every candidate needs a reported score, regardless of vendor.
 * Tunable rather than a fixed model list, since the cheapest model that
 * clears this bar changes as the OpenRouter catalog and pricing shift.
 */
const DEFAULT_MIN_QUALITY_INDEX = 40;
// Sized from observed real usage of the weekly EN/UK master write (see PR
// history) — used only to rank candidates by projected cost, not billed.
const MASTER_PROMPT_TOKENS_ESTIMATE = 12_000;
const MASTER_COMPLETION_TOKENS_ESTIMATE = 20_000;

function masterMinQualityIndex() {
  const parsed = Number(process.env.WEEKLY_MASTER_MIN_QUALITY_INDEX);
  return Number.isFinite(parsed) ? parsed : DEFAULT_MIN_QUALITY_INDEX;
}

/**
 * Ranks eligible OpenRouter models by projected cost for the master's typical
 * token profile, cheapest first, among models clearing the quality floor.
 * No model id is hardcoded — a temporarily discounted or newly released
 * model is picked up automatically the next time the catalog is fetched.
 */
export function premiumOpenRouterModels(
  models: OpenRouterModelRecord[],
  options: { configuredModels?: string[]; excludeVendors?: string[] } = {},
) {
  const configured =
    options.configuredModels ??
    (process.env.WEEKLY_MASTER_OPENROUTER_MODELS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  const ranked = rankOpenRouterModelsByValue(models, {
    promptTokens: MASTER_PROMPT_TOKENS_ESTIMATE,
    completionTokens: MASTER_COMPLETION_TOKENS_ESTIMATE,
    minQualityIndex: masterMinQualityIndex(),
    excludeVendors: options.excludeVendors,
    configuredModels: configured.length ? configured : undefined,
  });
  // A full master response is large. Retrying another OpenRouter model inside
  // the same request can consume the entire 300-second function budget, so
  // the default stays at one candidate for anything running on Vercel.
  //
  // That budget does not exist on the GitHub Actions worker (120-minute job),
  // where a single candidate means a single sloppy answer kills the whole
  // job: observed live 2026-08-09 on the sandbox fixture — the cheapest
  // qualifying model, tencent/hy3-preview, streamed a complete 31k-char
  // article whose opening brace carried one stray quote (`{"article":{"`),
  // failed JSON.parse, and had nothing to fall back to. That path sets
  // WEEKLY_MASTER_OPENROUTER_CANDIDATES so a second model gets a turn.
  return ranked.slice(0, masterOpenRouterCandidates()).map((candidate) => candidate.id);
}

function masterOpenRouterCandidates() {
  const parsed = Number(process.env.WEEKLY_MASTER_OPENROUTER_CANDIDATES);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

/** Wraps a registry ProviderCallResult in this file's own ProviderResult<T> shape (shared by both the DB-override and the default value-ranked OpenRouter path below). */
function toOpenRouterResult<T>(
  result: ProviderCallResult,
  value: T,
  promptChars: number,
): ProviderResult<T> {
  const promptTokens = result.usage.promptTokens ?? estimateTokens(promptChars);
  const outputTokens = result.usage.outputTokens ?? estimateTokens(result.text.length);
  return {
    value,
    metadata: {
      // Stable EditorialProvider slot name, regardless of which concrete HTTP
      // provider actually served this call (default OpenRouter, or an
      // owner-configured one -- see resolveWeeklyDbHttpProvider below).
      provider: 'openrouter',
      model: result.model,
      promptTokens,
      outputTokens,
      estimatedCostUsd: result.usage.costUsd ?? estimateCost(promptTokens, outputTokens),
      costSource: result.usage.costSource,
      promptVersion: WEEKLY_MASTER_SPEC_VERSION,
    },
  };
}

/**
 * Looks up an owner-configured HTTP provider for this role via
 * /admin/providers (e.g. a promo like NVIDIA NIM) — null when no `db` was
 * supplied or nothing is configured, in which case generateOpenRouter falls
 * through to its normal value-ranked OpenRouter path below. An owner-added
 * provider's model list is theirs to manage (no live catalog/benchmark data
 * exists for a provider like NIM, see wiki/pipeline/llm-providers.md), so
 * premiumOpenRouterModels' value-ranking is intentionally not applied here.
 */
async function resolveWeeklyDbHttpProvider(
  role: ProviderRole,
  db?: PipelineDb,
): Promise<HttpProviderConfig | null> {
  if (!db) return null;
  const registry = await loadProviderRegistry(process.env, {}, db);
  const resolved = registry.chainForRole(role).find((entry) => entry.entry.kind === 'http');
  return resolved?.http ?? null;
}

async function generateOpenRouter<T>(
  prompt: string,
  parse: (raw: string) => T,
  options: {
    configuredModels?: string[];
    excludeVendors?: string[];
    /** weekly.master_writer | weekly.master_critic -- which role's DB chain to check for an owner override. */
    role?: ProviderRole;
    db?: PipelineDb;
  } = {},
): Promise<ProviderResult<T>> {
  const validateResponse: OpenRouterResponseValidator = (_model, raw, finishReason) => {
    if (finishReason === 'length') throw new SyntaxError('Truncated editorial response.');
    parse(raw);
    return raw;
  };

  const dbHttp = options.role ? await resolveWeeklyDbHttpProvider(options.role, options.db) : null;
  if (dbHttp) {
    // An owner-configured provider failing mid-call must not take down the
    // whole editorial generation -- fall through to the normal value-ranked
    // OpenRouter ladder below instead of throwing, same as an unconfigured
    // dbHttp (null) already falls through.
    try {
      const result = await generateWithHttpProviderChain(prompt, dbHttp, { validateResponse });
      return toOpenRouterResult(result, parse(result.text), prompt.length);
    } catch (error) {
      logEvent(
        'warn',
        'weekly-editorial',
        'Owner-configured OpenRouter provider failed -- falling back to the default value-ranked OpenRouter path',
        {
          role: options.role,
          provider: dbHttp.id,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  const apiKey = process.env.OPEN_ROUTER_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('UNCONFIGURED:OPEN_ROUTER_API_KEY');
  const models = await fetchOpenRouterModels(apiKey);
  const queue = premiumOpenRouterModels(models, options);
  if (!queue.length) throw new Error('No premium OpenRouter editorial model is available.');
  // `extraBodyForModel` is a per-model hook, but this used to compute one
  // effort from queue[0] and hand it to every model in the chain. Harmless
  // while the queue was always length 1; actively wrong now that the Actions
  // worker runs several candidates — a fallback model whose reasoning
  // defaults on would get no suppression at all and reason until the wall
  // ceiling, billing those tokens as output the whole way.
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const result = await generateWithHttpProviderChain(
    prompt,
    { id: 'openrouter', apiKey, modelQueue: queue, ...OPENROUTER_HTTP_DEFAULTS },
    {
      validateResponse,
      extraBodyForModel: (modelId) => {
        const record = modelsById.get(modelId);
        const effort = record ? minimalReasoningEffort(record) : null;
        return effort ? { reasoning: { effort } } : undefined;
      },
    },
  );
  return toOpenRouterResult(result, parse(result.text), prompt.length);
}

async function generateGemini<T>(
  prompt: string,
  parse: (raw: string) => T,
): Promise<ProviderResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('UNCONFIGURED:GEMINI_API_KEY');
  const queue = await resolveGeminiModelQueue(apiKey, {
    ...process.env,
    GEMINI_MODEL: process.env.WEEKLY_MASTER_GEMINI_MODEL,
    // Discovery ranks Flash before Pro for the general pipeline. Fetch enough
    // of the current-generation catalog before applying the editorial premium
    // filter, otherwise a healthy Pro model can be truncated out at index 1.
    GEMINI_MAX_MODEL_ATTEMPTS: '5',
  });
  const premium = premiumGeminiEditorialModels(queue);
  if (!premium.length) throw new Error('No premium Gemini editorial model is available.');
  let lastError: unknown;
  for (const modelId of premium.slice(0, 2)) {
    try {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: modelId,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.25 },
      });
      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      const value = parse(raw);
      const usage = result.response.usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? estimateTokens(prompt.length);
      const outputTokens =
        usage?.candidatesTokenCount ??
        (usage?.totalTokenCount && usage.promptTokenCount
          ? usage.totalTokenCount - usage.promptTokenCount
          : estimateTokens(raw.length));
      return {
        value,
        metadata: {
          provider: 'gemini',
          model: modelId,
          promptTokens,
          outputTokens,
          estimatedCostUsd: estimateCost(promptTokens, outputTokens),
          costSource: 'estimated',
          promptVersion: WEEKLY_MASTER_SPEC_VERSION,
        },
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Premium Gemini generation failed.');
}

export function premiumGeminiEditorialModels(models: string[]) {
  return models.filter((model) => !/(?:^|[-_/])(?:flash|lite|mini|nano)(?:[-_/]|$)/i.test(model));
}

/**
 * Runs the write through the user's own Claude subscription (Pro/Max) via
 * the Claude Code CLI instead of a metered API key — see pipeline/claude-cli.ts.
 * Only succeeds where the `claude` binary is installed and authenticated
 * (a GitHub Actions runner today, never Vercel); throws UNCONFIGURED:... there
 * so providerOrder() falls through to OpenRouter with no behavior change.
 */
async function generateClaudeCli<T>(
  prompt: string,
  parse: (raw: string) => T,
): Promise<ProviderResult<T>> {
  const result = await generateWithClaudeCli(prompt);
  const value = parse(result.text);
  return {
    value,
    metadata: {
      provider: 'claude-cli',
      model: result.model,
      promptTokens: estimateTokens(prompt.length),
      outputTokens: estimateTokens(result.text.length),
      estimatedCostUsd: 0,
      costSource: 'subscription',
      promptVersion: WEEKLY_MASTER_SPEC_VERSION,
    },
  };
}

async function generateWithProvider<T>(
  provider: EditorialProvider,
  prompt: string,
  parse: (raw: string) => T,
  role?: ProviderRole,
  db?: PipelineDb,
) {
  if (provider === 'claude-cli') return generateClaudeCli(prompt, parse);
  return provider === 'openrouter'
    ? generateOpenRouter(prompt, parse, { role, db })
    : generateGemini(prompt, parse);
}

function configuredCriticOpenRouterModels() {
  return (process.env.WEEKLY_CRITIC_OPENROUTER_MODELS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function generateIndependentCritic(
  english: ProviderResult<ReturnType<typeof parseEnglishPackage>>,
  prompt: string,
  db?: PipelineDb,
) {
  let primaryError: unknown;
  const independentProvider = providerOrder().find(
    (provider) => provider !== english.metadata.provider,
  );
  if (independentProvider) {
    try {
      return await generateWithProvider(
        independentProvider,
        prompt,
        parseCritic,
        'weekly.master_critic',
        db,
      );
    } catch (error) {
      primaryError = error;
    }
  }

  const writerVendor =
    english.metadata.provider === 'openrouter'
      ? openRouterModelVendor(english.metadata.model)
      : english.metadata.provider === 'claude-cli'
        ? 'anthropic'
        : 'google';
  try {
    return await generateOpenRouter(prompt, parseCritic, {
      configuredModels: configuredCriticOpenRouterModels(),
      excludeVendors: [writerVendor],
      role: 'weekly.master_critic',
      db,
    });
  } catch (fallbackError) {
    const primaryMessage =
      primaryError instanceof Error ? primaryError.message : 'independent provider unavailable';
    const fallbackMessage =
      fallbackError instanceof Error ? fallbackError.message : 'critic fallback unavailable';
    throw new Error(
      `No independent premium editorial critic is available: ${primaryMessage}; ${fallbackMessage}`,
    );
  }
}

/**
 * Exported for reuse by video-script-llm.ts, which needs the same Claude CLI
 * -> OpenRouter -> Gemini ladder for a single-shot generation call outside
 * the master write -- it calls this with 2 args, so role/db default to
 * undefined there and behave exactly as before this migration.
 */
export async function generateFirstAvailable<T>(
  prompt: string,
  parse: (raw: string) => T,
  role?: ProviderRole,
  db?: PipelineDb,
) {
  const failures: string[] = [];
  for (const provider of providerOrder()) {
    try {
      return await generateWithProvider(provider, prompt, parse, role, db);
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    failures.length
      ? `Every editorial provider failed -- ${failures.join(' | ')}`
      : 'No premium editorial provider is configured.',
  );
}

export function masterRetryGuidancePrompt(guidance: WeeklyMasterRetryGuidance[]) {
  if (!guidance.length) return '';
  return `

PRIOR CRITIC BLOCKERS TO FIX
These are editorial constraints from a rejected earlier draft, not approved factual claims. Do not quote or repeat their wording unless it is independently supported by APPROVED STORY MATERIAL. Resolve every item in the new draft:
${JSON.stringify(guidance)}`;
}

/**
 * `naturalness`/`parity` guidance is about the Ukrainian translation, not the
 * English source (see the critic prompt below) -- routing it only to the
 * Ukrainian step means a naturalness-only retry never re-sends the English
 * prompt, which is what lets the checkpoint hashes (generation-worker.ts)
 * skip a paid-for English regeneration that was never the problem.
 */
export function splitMasterRetryGuidance(guidance: WeeklyMasterRetryGuidance[]) {
  return {
    english: guidance.filter((entry) => entry.locale !== 'uk'),
    ukrainian: guidance.filter((entry) => entry.locale === 'uk'),
  };
}

function englishPrompt(
  stories: WeeklyMasterInputStory[],
  retryGuidance: WeeklyMasterRetryGuidance[],
) {
  return `You are the senior editor-practitioner at AI Today Brief, a weekly digest read by software builders, AI practitioners and the technically curious -- not a briefing for executives. Produce an engaging, evidence-bound Weekly Digest. Explain technical complexity in plain English, show judgment, and never use clickbait or generic advice.

${voicePromptBlock('en')}

CONTRACT
- Structure: Top 3 feature stories followed by 3–4 radar stories, preserving the supplied order and revisionItemId.
- Feature body: 400–650 words each, continuous narrative prose. Radar body: 80–140 words each, same rule.
- A vivid opening must still be true. Use only a documented moment or source-supported fact from APPROVED STORY MATERIAL. Never invent a person staring at a screen, a machine crashing after N hours, a reaction, quote, chronology, or other cinematic detail merely to satisfy the voice guidance. When the source has no real scene, open with the strongest verified contrast or result.
- The body must stand alone as a story -- never open a sentence with the name of another field ("Practical scenario:", "The limitation is that...", "Why it matters:", "The takeaway is..."). Those fields have their own boxes elsewhere; restating them inside the body with a label is the single most common failure mode -- do not do it.
- Ground every factual sentence in supplied claims and/or primarySourceExcerpt (and corroboratingExcerpts when present). Prefer claimIds for structured facts; excerpts may supply additional detail that appears in the approved research pack. Never invent numbers, names, quotes or causal implications absent from both claims and excerpts. editorsView is the one deliberate exception to this rule -- see VOICE above.
- Treat single-person logs, company benchmarks and vendor announcements as limited evidence. Attribute them in the headline/dek/body and do not turn one measured workload into a universal statement about all agentic AI. For energy claims, name electricity, the unit and workload (for example kWh per Claude Code session), not vague "energy".
- Every story must still cite at least one real claimId from its claims array. Do not invent claim IDs.
- The practical field must name a concrete actor, workflow, action, constraint and observable result. Never use a reusable category template.
- editorsView and discussionQuestion are required for the three feature stories only (see VOICE above for what each must do); send both as empty strings for radar stories.
- When a story's approved material includes an "angle" field, that is the owner's binding editorial direction for that story, decided before you started writing -- build the headline, body and editorsView around it, don't default to a generic recap that ignores it. Never contradict supplied claims or excerpts to fit the angle.
- Establish one honest edition throughline from the Top 3 before drafting. Use a thematic umbrella only when the approved evidence supports a real connection; otherwise frame the edition transparently around the three concrete developments instead of forcing a vague idea onto unrelated stories.
- Headline must read like a real news headline about what happened -- name the actor and the concrete event -- never an abstract thesis a reader can't picture. The edition title must make the Top 3 legible on first read by naming concrete actors/products/results; do not use umbrella labels such as "The Agentic Shift", "The Future of AI", or a bare list of categories. All prose across the article object must total 2,000–3,000 words.
- Framing limits are hard: seoTitle <=65 characters; metaDescription <=160; ogTitle <=70; ogDescription <=200. The standfirst opens on the issue's strongest news value, never "A weekly digest..." boilerplate. editorNote may say the edition uses cited primary sources and separately labeled editorial analysis, but must not claim "original research" unless the supplied material explicitly proves AI Today Brief conducted it.
- Return one JSON object only.

JSON SHAPE
{"article":{"title":"","seoTitle":"","metaDescription":"","ogTitle":"","ogDescription":"","standfirst":"","theme":"","intro":"","editorNote":"","keyTakeaways":[""],"topics":[""],"entities":[""],"internalLinks":[{"anchor":"","query":""}],"conclusion":"","stories":[{"revisionItemId":"","placement":"feature|radar","headline":"","summary":"","hook":"","body":"","why":"","practical":"","limitation":"","takeaway":"","editorsView":"","discussionQuestion":"","claimIds":[""]}]}}

APPROVED STORY MATERIAL
${JSON.stringify(approvedStoryPromptMaterial(stories))}${masterRetryGuidancePrompt(retryGuidance)}`;
}

function ukrainianPrompt(
  en: WeeklyArticleMaster,
  stories: WeeklyMasterInputStory[],
  retryGuidance: WeeklyMasterRetryGuidance[],
) {
  return `Act as a Ukrainian senior news editor re-narrating the story for a Ukrainian audience of builders and the technically curious, not a literal translator. You may restructure sentences and paragraph flow freely. revisionItemId, placement, story order, every claimIds array, names and numeric values must stay faithful to the English master; localize how numbers and units are written (for example 1,138 -> 1 138; 0.6 kWh -> 0,6 кВт·год; 24 hours -> 24 години). Return only the article JSON object in the same shape as the English article, including editorsView and discussionQuestion for the three feature stories (empty strings for radar).

${voicePromptBlock('uk')}

CONTRACT
- Feature bodies stay 400–650 words, radar 80–140 words -- continuous narrative prose, never opening a sentence with a field-name label ("Практичний сценарій:", "Обмеження полягає в тому", "Висновок для рішення:"). See REGISTER CONTRAST above for exactly this failure mode.
- This is not a word-for-word translation: re-narrate for rhythm and naturalness in Ukrainian while preserving every fact, claim ID, name and numeric value. Translate ordinary English words and units; keep only product names, code, CLI flags and genuinely standard technical terms in English.
- Prefer clear Ukrainian equivalents over unnecessary loans: «взаємодія» instead of «інтеракція», «супроводжувач пакета» instead of «мейнтейнер», «робочий процес» where «воркфлоу» adds nothing. Never coin a word or guess a form. If uncertain, rewrite with simpler established vocabulary.
- Proofread every field after drafting, including title, metadata, intro, editorNote and each story field. Reject malformed words, Russian endings, untranslated connectors/time units ("to", "hours", "minutes"), internal field names such as editorsView, mismatched decimal/thousands separators, and agreement/case errors. One such error is a failed draft, not an acceptable stylistic blemish.
- Keep the same hard framing limits as English: seoTitle <=65 characters; metaDescription <=160; ogTitle <=70; ogDescription <=200. The standfirst starts with the news, not «Щотижневий дайджест». The edition title must name concrete actors/products/results, not an abstract label such as «Зсув до агентів».
- Побудуйте одну чесну наскрізну логіку з трьох головних історій. Не вигадуйте спільну «велику тему», якщо джерела її не підтверджують: тоді прямо назвіть у рамці три конкретні події.
- A multiple stays a multiple and a percentage stays a percentage. «600x» is «у 600 разів», never «на 600%» — they differ by two orders of magnitude, and a headline that disagrees with its own standfirst is a failed draft.
- Energy comparisons must say «електроенергія» and include the measured unit/workload and single-case-study attribution; do not write an unqualified «у 600 разів більше енергії».
- editorNote may describe cited primary sources and separately labeled editorial analysis, but never translate or introduce an unsupported claim about «оригінальні дослідження».
- editorsView must be its own independent Ukrainian re-narration of the English editorial reasoning, not a mechanical translation -- keep the same underlying judgment, written the way a Ukrainian editor would actually say it.

APPROVED ENGLISH MASTER
${JSON.stringify(en)}

SOURCE MATERIAL FOR TERMINOLOGY
${JSON.stringify(stories.map(({ revisionItemId, titleUk, summaryUk, whyUk }) => ({ revisionItemId, titleUk, summaryUk, whyUk })))}${masterRetryGuidancePrompt(retryGuidance)}`;
}

const CRITIC_RUBRIC = `RUBRIC -- score each dimension 0-100. Any dimension scored below 80 MUST quote 1-2 offending spans verbatim in that dimension's "note" (the exact text that earned the low score), not a paraphrase of the problem.

engagement -- would a person actually read past paragraph one, driven by narrative pull, not just information density.
  90: opens on a concrete, surprising AND source-supported moment or fact; sentence length varies on purpose; each story has one throughline, not four slots stapled together.
  75: readable and accurate but opens on an abstract thesis or a recap rather than a scene; some paragraphs read like they're working through a checklist.
  55: opens with an abstract claim about "the tension" or "the operating model", or invents cinematic detail absent from the evidence; uniform sentence rhythm throughout; reads like a summary of a summary.

voice -- adherence to the AI Today Brief house style: a sharp colleague explaining over coffee, real editorial judgment, zero template leaks.
  90: no banned phrases anywhere; body never opens a sentence with a field-name label ("Practical scenario:", "Обмеження полягає в тому"); editorsView is unmistakably framed as the editor's own reasoning, never blended into the sourced voice.
  75: mostly in-voice but one passage drifts into a generic AI-tell phrase, a hedge-heavy register, or a leader-briefing frame.
  55: reads like a compliance memo or briefing note in multiple places; editorsView is indistinguishable in register from the sourced body.

clarity -- a reader with no prior context understands what happened and why it's presented this way, on one read.
  90: technical terms are explained the moment they're used; every paragraph earns its place; no sentence needs a second read.
  75: mostly clear but one or two passages assume background the reader may not have, or bury the point in a long sentence.
  55: a reader would need to re-read multiple passages, or the piece never states plainly what actually happened.

trust -- claims are attributed, hedged where the source hedges, and self-reported figures are flagged as such.
  90: every load-bearing claim names its source inline ("Anthropic reports...", "the report says..."); self-reported/company-provided numbers are explicitly flagged as such; openings contain no invented scenes; single-person logs are not generalized to an entire category; energy claims name electricity, unit and workload.
  75: attribution is present but inconsistent -- some claims float without a named source even though one exists in the evidence.
  55: claims read as established fact when the evidence only supports "a report says" or "the company claims", or a vivid opening event is absent from the approved evidence.

usefulness -- a builder finishes the story knowing something they can act on or evaluate, not a AI-generated abstract restatement of the summary.
  90: the practical field names a concrete actor, workflow, action, constraint and observable result specific to this story.
  75: practical guidance is present but generic enough it could attach to several unrelated stories with a find-and-replace.
  55: no actionable specificity anywhere in the story; it only restates what happened.

naturalness (Ukrainian only) -- reads as copy a Ukrainian editor has fully proofread, not a translation draft.
  90: no calques, malformed/nonexistent words, Russian endings, grammar or agreement errors, untranslated ordinary English words/units, internal field names, or non-localized number/unit formatting; idiomatic word order and register throughout.
  75: one minor stiff construction or debatable loanword, but no spelling/grammar error and no untranslated ordinary English residue.
  55: any malformed/nonexistent word or grammar error, or multiple calques, untranslated words/units, unnatural word order, and unexplained English jargon.

parity -- the EN and UK articles tell the same story with the same facts, claim IDs, and structure.
  90: every fact, numeric value, and claim ID matches between locales; locale formatting may differ (1,138 -> 1 138, 0.6 kWh -> 0,6 кВт·год), while phrasing and rhythm differ as intended.
  75: facts match but emphasis or structure has drifted noticeably between locales.
  55: a fact, number, or claim present in one locale is missing, altered, or contradicted in the other.`;

export function criticPrompt(bundle: WeeklyMasterBundle, stories: WeeklyMasterInputStory[]) {
  return `You are the independent factual and editorial critic for AI Today Brief. Audit the bilingual master against approved claims AND the attached primary/corroborating source excerpts. A detail clearly supported by an approved excerpt is grounded even when it is missing from the numbered claims list — do NOT flag it as UNSUPPORTED_*. Flag only numbers, quotes, named claims, or causal implications that appear in neither the claims nor the excerpts. A writer may paraphrase but may not strengthen beyond what claims+excerpts support. Return JSON only.

${CRITIC_RUBRIC}

Before scoring, inspect every article-level field and every story field in both locales. In Ukrainian, explicitly scan token by token for spelling, grammar, Russian endings, malformed words, untranslated ordinary English words/units, internal field names, decimal/thousands formatting and unnatural loans. A single objective language error caps naturalness at 55 and MUST create a blocking language_mechanics issue with the exact span and replacement. An unqualified energy multiplier, invented opening scene, unsupported "original research" claim, overlong metadata, abstract edition title, or copied prompt/example prose is also blocker-worthy. Do not rubber-stamp the draft with uniform 90s: scores must follow the actual evidence in the notes, and no dimension may score 90+ while an issue relevant to it remains.

Required dimensions, exactly these seven, each exactly once: engagement, voice, clarity, trust, usefulness, naturalness, parity. Overall score 0–100. factualFlags must be [] when clean. Every issue needs code, message, blocker, and when possible locale, revisionItemId, field, exact span, suggestedFix.

For any non-factual (register/prose/language) issue, the code MUST be exactly one of: voice_register, engagement_structure, clarity_unclear, trust_attribution, usefulness_generic, naturalness_calque, language_mechanics. Use language_mechanics for spelling, grammar, untranslated ordinary words/units, broken morphology and numeric/unit localization. Do not invent other codes for prose/register problems -- these seven are the only ones a downstream automated fix step recognizes as safe to line-edit. Never use them for a grounding or factual problem; put those in factualFlags instead, not issues.

JSON SHAPE
{"score":0,"dimensions":[{"name":"engagement","score":0,"note":""}],"factualFlags":[],"issues":[{"code":"","message":"","blocker":true,"locale":"en|uk","revisionItemId":"","field":"","span":"","suggestedFix":""}]}

APPROVED EVIDENCE (claims + source excerpts)
${JSON.stringify(criticApprovedEvidence(stories))}

MASTER TO AUDIT
${JSON.stringify(bundle)}`;
}

/**
 * Line-edit pass: rewrite only the fields a revisable quality-gate failure
 * names, leaving everything else byte-for-byte unchanged. Replaces a full
 * EN+UK regenerate for the class of failure that's just prose (a low
 * dimension score, a template-leak phrase, a too-short editorsView) -- see
 * `reportIsRevisable` (content-studio.ts) for exactly which failures qualify.
 * Reusing the same voice block as the original write keeps the revised
 * prose from drifting back toward a blander, more compliant register than
 * the first draft.
 */
export function reviseArticlePrompt(
  article: WeeklyArticleMaster,
  guidance: WeeklyMasterRetryGuidance[],
  locale: 'en' | 'uk',
): string {
  return `You are line-editing an already-drafted AI Today Brief Weekly Digest article, not rewriting it from scratch. Fix ONLY the specific problems listed below. Every field, sentence, and character not implicated by a listed problem must be returned exactly as given in the input -- do not "improve" anything else. Never change claimIds, revisionItemId, placement, or touch a story not named by any problem below.

${voicePromptBlock(locale)}

PROBLEMS TO FIX (each names the story and field at fault; fix every one)
${JSON.stringify(guidance)}

ARTICLE TO REVISE
${JSON.stringify(article)}

Return the complete article JSON in the exact same shape as the input, with only the named problems fixed.`;
}

/**
 * Converts one in-memory quality report into the same WeeklyMasterRetryGuidance
 * shape the cross-job-retry path uses (generation-worker.ts's blockerGuidanceFrom
 * Report/dimensionGuidanceFromReport read the same report back out of the DB) --
 * kept local since the revise loop below acts on the report it just computed,
 * with no DB round-trip.
 */
function reviseGuidanceFromReport(report: WeeklyContentQualityReport): WeeklyMasterRetryGuidance[] {
  const fromIssues: WeeklyMasterRetryGuidance[] = report.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    ...(issue.suggestedFix ? { suggestedFix: issue.suggestedFix } : {}),
    ...(issue.locale ? { locale: issue.locale } : {}),
    ...(issue.revisionItemId ? { revisionItemId: issue.revisionItemId } : {}),
    ...(issue.field ? { field: issue.field } : {}),
  }));
  return [...fromIssues, ...editorialQualityRetryGuidance(report)];
}

/** Sums token/cost metadata across every call made for one step (write + revise attempts). */
function accumulateGenerationMetadata(
  calls: EditorialGenerationMetadata[],
): EditorialGenerationMetadata {
  const last = calls[calls.length - 1]!;
  return {
    provider: last.provider,
    model: last.model,
    promptTokens: calls.reduce((sum, call) => sum + call.promptTokens, 0),
    outputTokens: calls.reduce((sum, call) => sum + call.outputTokens, 0),
    estimatedCostUsd: Number(
      calls.reduce((sum, call) => sum + call.estimatedCostUsd, 0).toFixed(6),
    ),
    costSource: calls.every((call) => call.costSource === 'subscription')
      ? 'subscription'
      : calls.every((call) => call.costSource === 'reported')
        ? 'reported'
        : 'estimated',
    promptVersion: last.promptVersion,
  };
}

const MAX_REVISE_ATTEMPTS = 2;

export async function generateWeeklyMaster(
  stories: WeeklyMasterInputStory[],
  researchPacks: WeeklyResearchPack[],
  retryGuidance: WeeklyMasterRetryGuidance[] = [],
  options: {
    checkpoint?: WeeklyMasterCheckpoint | null;
    onStepComplete?: (
      step: 'english' | 'ukrainian',
      result: WeeklyMasterEnglishResult | WeeklyMasterUkrainianResult,
    ) => void | Promise<void>;
    /** Emits every paid model call so workers can persist provider/cost telemetry durably. */
    onProviderCallStarted?: (step: WeeklyMasterProviderStep) => void | Promise<void>;
    onProviderCallCompleted?: (
      step: WeeklyMasterProviderStep,
      metadata: EditorialGenerationMetadata,
    ) => void | Promise<void>;
    /** Enables DB-driven role-chain overrides (owner-added HTTP providers via /admin/providers) for the openrouter slot. */
    db?: PipelineDb;
  } = {},
): Promise<WeeklyMasterGenerationResult> {
  const { english: englishGuidance, ukrainian: ukrainianGuidance } =
    splitMasterRetryGuidance(retryGuidance);
  let english = options.checkpoint?.english;
  if (!english) {
    await options.onProviderCallStarted?.('english');
    english = await generateFirstAvailable(
      englishPrompt(stories, englishGuidance),
      parseEnglishPackage,
      'weekly.master_writer',
      options.db,
    );
    await options.onProviderCallCompleted?.('english', english.metadata);
    await options.onStepComplete?.('english', english);
  }
  let ukrainian = options.checkpoint?.ukrainian;
  if (!ukrainian) {
    await options.onProviderCallStarted?.('ukrainian');
    ukrainian = await generateWithProvider(
      english.metadata.provider,
      ukrainianPrompt(english.value.article, stories, ukrainianGuidance),
      (raw) => parseArticle(raw, 'uk'),
      'weekly.master_writer',
      options.db,
    );
    await options.onProviderCallCompleted?.('ukrainian', ukrainian.metadata);
    await options.onStepComplete?.('ukrainian', ukrainian);
  }
  const englishCalls: EditorialGenerationMetadata[] = [english.metadata];
  const ukrainianCalls: EditorialGenerationMetadata[] = [ukrainian.metadata];
  const criticCalls: EditorialGenerationMetadata[] = [];

  const expectedStories = stories.map((story) => ({
    revisionItemId: story.revisionItemId,
    placement: story.placement,
    claimIds: story.claims.map((claim) => claim.id),
  }));
  const approvedClaimIds = stories.flatMap((story) => story.claims.map((claim) => claim.id));
  const buildBundle = (): WeeklyMasterBundle => ({
    en: english!.value.article,
    uk: ukrainian!.value,
  });
  const evaluate = async (bundle: WeeklyMasterBundle): Promise<WeeklyContentQualityReport> => {
    await options.onProviderCallStarted?.('critic');
    const critic = await generateIndependentCritic(
      english!,
      criticPrompt(bundle, stories),
      options.db,
    );
    await options.onProviderCallCompleted?.('critic', critic.metadata);
    criticCalls.push(critic.metadata);
    const deterministicIssues = validateMasterBundle(bundle, researchPacks, expectedStories);
    return {
      schemaVersion: 'weekly-quality-v2',
      score: critic.value.score,
      dimensions: critic.value.dimensions,
      issues: [...deterministicIssues, ...critic.value.issues],
      factualFlags: critic.value.factualFlags,
      approvedClaimIds,
      checkedAt: new Date().toISOString(),
    };
  };

  let bundle = buildBundle();
  let quality = await evaluate(bundle);

  // Line-edit pass: a revisable failure (see reportIsRevisable) gets a
  // targeted rewrite of just the flagged fields instead of a full EN+UK
  // regenerate. Capped at MAX_REVISE_ATTEMPTS so a report the model can't
  // actually satisfy surfaces to the human via the normal gate-failure path
  // rather than looping indefinitely.
  let reviseAttempts = 0;
  while (
    reviseAttempts < MAX_REVISE_ATTEMPTS &&
    !editorialQualityPasses(quality) &&
    reportIsRevisable(quality)
  ) {
    reviseAttempts += 1;
    const guidance = reviseGuidanceFromReport(quality);
    const { english: englishRevise, ukrainian: ukrainianRevise } =
      splitMasterRetryGuidance(guidance);

    if (englishRevise.length) {
      await options.onProviderCallStarted?.('revisions');
      const revisedEnglish: ProviderResult<WeeklyArticleMaster> = await generateWithProvider(
        english!.metadata.provider,
        reviseArticlePrompt(english!.value.article, englishRevise, 'en'),
        (raw) => parseArticle(raw, 'en'),
        'weekly.master_writer',
        options.db,
      );
      await options.onProviderCallCompleted?.('revisions', revisedEnglish.metadata);
      english = {
        value: { ...english!.value, article: revisedEnglish.value },
        metadata: revisedEnglish.metadata,
      };
      englishCalls.push(revisedEnglish.metadata);
      // English prose changed underneath it -- Ukrainian must be re-adapted
      // from the new English even when nothing UK-tagged fired this round,
      // or the two locales drift out of narrative sync with each other.
      await options.onProviderCallStarted?.('revisions');
      const readapted: WeeklyMasterUkrainianResult = await generateWithProvider(
        english.metadata.provider,
        ukrainianPrompt(english.value.article, stories, ukrainianRevise),
        (raw) => parseArticle(raw, 'uk'),
        'weekly.master_writer',
        options.db,
      );
      await options.onProviderCallCompleted?.('revisions', readapted.metadata);
      ukrainian = readapted;
      ukrainianCalls.push(readapted.metadata);
    } else if (ukrainianRevise.length) {
      await options.onProviderCallStarted?.('revisions');
      const revisedUkrainian: WeeklyMasterUkrainianResult = await generateWithProvider(
        ukrainian!.metadata.provider,
        reviseArticlePrompt(ukrainian!.value, ukrainianRevise, 'uk'),
        (raw) => parseArticle(raw, 'uk'),
        'weekly.master_writer',
        options.db,
      );
      await options.onProviderCallCompleted?.('revisions', revisedUkrainian.metadata);
      ukrainian = revisedUkrainian;
      ukrainianCalls.push(revisedUkrainian.metadata);
    }

    bundle = buildBundle();
    quality = await evaluate(bundle);
  }

  return {
    bundle,
    quality,
    generation: {
      english: accumulateGenerationMetadata(englishCalls),
      ukrainian: accumulateGenerationMetadata(ukrainianCalls),
      critic: accumulateGenerationMetadata(criticCalls),
    },
  };
}
