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
  type WeeklyMasterBundle,
  type WeeklyMasterStory,
  type WeeklyPlacement,
  type WeeklyQualityDimension,
  type WeeklyQualityIssue,
  type WeeklyResearchPack,
} from './content-studio';
import { voicePromptBlock } from './editorial-voice';
import {
  MASTER_FRAME_WORD_TARGETS,
  storyBodyWordTarget,
  storySupportWordCap,
  type MasterFrame,
} from './master-segments';
import { isListRepairField, type RepairTarget } from './master-repair';

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

/** Provider + model id of one editorial call — writer or a prior critic. */
export type EditorialModelRef = Pick<EditorialGenerationMetadata, 'provider' | 'model'>;

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

/**
 * Returns the first balanced top-level `{…}` in the text, or null.
 * Brace-counting is string- and escape-aware, so a `{` inside a quoted value
 * (or the `\"` before it) can't close the object early.
 */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const normalized = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let value: unknown;
  try {
    value = JSON.parse(normalized) as unknown;
  } catch (error) {
    // A subscription CLI answers as an assistant, not as an API: the live
    // 2026-08-09 revise step came back as "**Applying the requested
    // fixes**\n\n{…}" and killed a job that had already spent 22 minutes
    // producing a good EN, UK and critic pass. Prose around an otherwise
    // valid object is a formatting slip, not a failed generation — dig the
    // object out rather than discard the work.
    const embedded = extractJsonObject(normalized);
    if (!embedded) throw error;
    value = JSON.parse(embedded) as unknown;
  }
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

/**
 * One story segment. `revisionItemId` and `placement` are deliberately NOT
 * read from the response: the assembler owns story identity and order
 * (master-segments.ts), so a model that echoes the wrong id or flips a
 * placement can no longer produce `story_set_mismatch` or
 * `placement_mismatch` -- two blockers that used to cost a full regenerate.
 *
 * `claimIds` is intersected with the story's own approved ids for the same
 * reason: an invented or borrowed claim id is dropped here rather than
 * surviving to become an `unsupported_claim_id` blocker downstream. An empty
 * result is still a real defect and is left for the gate to catch.
 *
 * `requireClaimIds` is false for the Ukrainian pass: its prompt (see
 * `ukrainianStorySegmentPrompt`) tells the model not to return the field at
 * all because the caller copies it structurally from the English story, so
 * requiring it here would reject every conforming Ukrainian response.
 */
export function parseStorySegment(
  raw: string,
  approvedClaimIds: string[],
  requireClaimIds = true,
): Omit<WeeklyMasterStory, 'revisionItemId' | 'placement'> {
  const row = parseJsonObject(raw);
  const story = (row.story && typeof row.story === 'object' && !Array.isArray(row.story)
    ? row.story
    : row) as Record<string, unknown>;
  const approved = new Set(approvedClaimIds);
  const claimIds = requireClaimIds
    ? stringArray(story.claimIds, 'story.claimIds').filter((id) => approved.has(id))
    : [];
  return {
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
    claimIds,
  };
}

/** The article-level fields, written once per locale after every story exists. */
export function parseFrameSegment(raw: string): MasterFrame {
  const row = parseJsonObject(raw);
  const frame = (row.frame && typeof row.frame === 'object' && !Array.isArray(row.frame)
    ? row.frame
    : row) as Record<string, unknown>;
  const links = recordArray(frame.internalLinks, 'internalLinks').map((link) => ({
    anchor: requiredString(link, 'anchor'),
    query: requiredString(link, 'query'),
  }));
  return {
    title: requiredString(frame, 'title'),
    seoTitle: requiredString(frame, 'seoTitle'),
    metaDescription: requiredString(frame, 'metaDescription'),
    ogTitle: requiredString(frame, 'ogTitle'),
    ogDescription: requiredString(frame, 'ogDescription'),
    standfirst: requiredString(frame, 'standfirst'),
    theme: requiredString(frame, 'theme'),
    intro: requiredString(frame, 'intro'),
    editorNote: requiredString(frame, 'editorNote'),
    keyTakeaways: stringArray(frame.keyTakeaways, 'keyTakeaways'),
    topics: stringArray(frame.topics, 'topics'),
    entities: stringArray(frame.entities, 'entities'),
    internalLinks: links,
    conclusion: requiredString(frame, 'conclusion'),
  };
}

/**
 * A repair response carries one field's replacement value and nothing else --
 * `{"value": "..."}` for prose, `{"value": ["..."]}` for a string list. The
 * narrow shape is the point: the model cannot accidentally restructure the
 * edition while fixing one sentence, which is how the old whole-article
 * revise pass kept trading one blocker for another.
 */
export function parseRepairedValue(raw: string, list: boolean): string | string[] {
  const row = parseJsonObject(raw);
  if (list) return stringArray(row.value, 'value');
  return requiredString(row, 'value');
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
  options: { configuredModels?: string[]; excludeVendors?: string[]; excludeModels?: string[] } = {},
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
    excludeModels: options.excludeModels,
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

function remainingModelQueue(queue: string[], excludeModels?: string[]) {
  const blocked = new Set(
    (excludeModels ?? []).map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  if (blocked.size === 0) return queue;
  return queue.filter((id) => !blocked.has(id.trim().toLowerCase()));
}

async function generateOpenRouter<T>(
  prompt: string,
  parse: (raw: string) => T,
  options: {
    configuredModels?: string[];
    excludeVendors?: string[];
    excludeModels?: string[];
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
  const dbQueue = dbHttp ? remainingModelQueue(dbHttp.modelQueue, options.excludeModels) : [];
  if (dbHttp && dbQueue.length) {
    // An owner-configured provider failing mid-call must not take down the
    // whole editorial generation -- fall through to the normal value-ranked
    // OpenRouter ladder below instead of throwing, same as an unconfigured
    // dbHttp (null) already falls through.
    try {
      const result = await generateWithHttpProviderChain(
        prompt,
        { ...dbHttp, modelQueue: dbQueue },
        { validateResponse },
      );
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

export function editorialModelVendor(ref: EditorialModelRef): string {
  if (ref.provider === 'claude-cli') return 'anthropic';
  if (ref.provider === 'gemini') return 'google';
  return openRouterModelVendor(ref.model);
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Unused independent slots first, then the writer's own unused slot, then
 * already-used slots as last resort. A second critic round (or a new
 * revision of the same digest) must not start on the same provider that
 * already scored the copy when another unused slot still exists.
 *
 * OpenRouter is a catalog, not a single model — it is never marked "used"
 * at slot level, or a previous GLM critic would push us back onto Claude
 * before trying GPT/Kimi/etc.
 */
export function criticProviderLadder(
  writerProvider: string,
  usedCriticProviders: readonly string[],
  order: EditorialProvider[] = providerOrder(),
): EditorialProvider[] {
  const writer = writerProvider.trim().toLowerCase();
  const usedSlots = new Set(
    usedCriticProviders
      .map((provider) => provider.trim().toLowerCase())
      .filter((provider) => provider !== 'openrouter'),
  );
  const unusedIndependent = order.filter(
    (provider) => provider !== writer && !usedSlots.has(provider),
  );
  const unusedWriter = order.filter((provider) => provider === writer && !usedSlots.has(provider));
  const usedIndependent = order.filter((provider) => provider !== writer && usedSlots.has(provider));
  const usedWriter = order.filter((provider) => provider === writer && usedSlots.has(provider));
  return [...unusedIndependent, ...unusedWriter, ...usedIndependent, ...usedWriter];
}

/**
 * Tightest exclusion first: skip every vendor/model that already wrote or
 * scored this edition. Each later tier relaxes so an empty catalog never
 * fails the job — writer independence is the only exclusion that survives.
 */
export function criticOpenRouterExclusionTiers(
  writer: EditorialModelRef,
  priorCritics: readonly EditorialModelRef[],
): Array<{ excludeVendors: string[]; excludeModels: string[] }> {
  const writerVendor = editorialModelVendor(writer);
  const writerModel = writer.model.trim();
  const priorModels = uniqueNormalized(priorCritics.map((entry) => entry.model));
  const priorVendors = uniqueNormalized(priorCritics.map((entry) => editorialModelVendor(entry)));
  const allModels = uniqueNormalized([writerModel, ...priorModels]);
  const allVendors = uniqueNormalized([writerVendor, ...priorVendors]);
  return [
    { excludeVendors: allVendors, excludeModels: allModels },
    { excludeVendors: [writerVendor], excludeModels: allModels },
    { excludeVendors: [writerVendor], excludeModels: writerModel ? [writerModel] : [] },
  ];
}

function isNoEligibleOpenRouterModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('No premium OpenRouter editorial model is available');
}

async function generateOpenRouterCritic(
  prompt: string,
  writer: EditorialModelRef,
  priorCritics: readonly EditorialModelRef[],
  db?: PipelineDb,
) {
  const configured = configuredCriticOpenRouterModels();
  let lastError: unknown;
  for (const tier of criticOpenRouterExclusionTiers(writer, priorCritics)) {
    try {
      return await generateOpenRouter(prompt, parseCritic, {
        configuredModels: configured,
        excludeVendors: tier.excludeVendors,
        excludeModels: tier.excludeModels,
        role: 'weekly.master_critic',
        db,
      });
    } catch (error) {
      lastError = error;
      if (!isNoEligibleOpenRouterModelError(error)) throw error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('No premium OpenRouter editorial model is available.');
}

/**
 * The critic must not be the model that wrote the copy, and must not reuse a
 * model that already scored this edition (earlier critic rounds, or earlier
 * revisions of the same digest). Provider slots rotate the same way.
 */
export async function generateIndependentCritic(
  writer: EditorialModelRef,
  prompt: string,
  db?: PipelineDb,
  options?: { avoidCritics?: EditorialModelRef[] },
) {
  const prior = options?.avoidCritics ?? [];
  const failures: string[] = [];
  for (const provider of criticProviderLadder(
    writer.provider,
    prior.map((entry) => entry.provider),
  )) {
    try {
      if (provider === 'openrouter') {
        return await generateOpenRouterCritic(prompt, writer, prior, db);
      }
      return await generateWithProvider(provider, prompt, parseCritic, 'weekly.master_critic', db);
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    failures.length
      ? `No independent premium editorial critic is available: ${failures.join('; ')}`
      : 'No independent premium editorial critic is available.',
  );
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

/**
 * Preferred provider first, then the rest of the ladder.
 *
 * The Ukrainian adaptation and every revise pass deliberately reuse whichever
 * provider wrote the English master, so both locales share one voice. Until
 * 2026-08-09 that preference was also a single point of failure: those steps
 * called one provider and let its error propagate, while only the English
 * step had a ladder. A live run lost a job at the revise step — after 22
 * minutes and a successful EN, UK and critic pass — because one response
 * arrived with a prose preamble. The preference is worth keeping; dying on
 * it is not.
 */
export async function generatePreferringProvider<T>(
  preferred: EditorialProvider,
  prompt: string,
  parse: (raw: string) => T,
  role?: ProviderRole,
  db?: PipelineDb,
) {
  const failures: string[] = [];
  for (const provider of [preferred, ...providerOrder().filter((one) => one !== preferred)]) {
    try {
      return await generateWithProvider(provider, prompt, parse, role, db);
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Every editorial provider failed -- ${failures.join(' | ')}`);
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

/**
 * Story-level prompts. One call writes one story, not an edition.
 *
 * The contract lines are inherited verbatim from the v7 whole-edition prompt
 * (the invented-scene ban, the field-label ban, the evidence rules, the
 * limited-evidence attribution rule) -- the editorial standard did not change,
 * only the size of the unit it is applied to. What is new is that each call
 * carries its own word budget, which one 2,500-word completion could never
 * hold itself to.
 */
export interface StorySegmentPromptInput {
  material: ApprovedStoryPromptMaterial;
  placement: WeeklyPlacement;
  rank: number;
  /** Stories already written for this edition, so framings are not repeated. */
  alreadyWritten: Array<{ rank: number; headline: string; hook: string }>;
  guidance: WeeklyMasterRetryGuidance[];
}

function storyFieldContract(placement: WeeklyPlacement) {
  const body = storyBodyWordTarget(placement);
  const support = storySupportWordCap(placement);
  const featureOnly =
    placement === 'feature'
      ? `- editorsView and discussionQuestion are required (see EDITOR'S VIEW above for what each must do).`
      : `- editorsView and discussionQuestion must both be empty strings -- they belong to feature stories only.`;
  return `- headline: a real news headline about what happened -- name the actor and the concrete event. Never an abstract thesis a reader cannot picture.
- summary: one sentence, at most 40 words, stating what happened.
- hook: one or two sentences that make a reader want the body. Never a question, never a category label.
- body: ${body.min}-${body.max} words of continuous narrative prose.
- why, practical, limitation, takeaway: one tight paragraph each, ${support} words for all four combined. They must do four different jobs -- if two of them could be swapped without loss, rewrite them.
- practical must name a concrete actor, workflow, action, constraint and observable result. Never a reusable category template.
${featureOnly}
- claimIds: every id you cite must come from this story's claims array below. Cite at least one.`;
}

export function storySegmentPrompt(input: StorySegmentPromptInput): string {
  const { material, placement, rank, alreadyWritten, guidance } = input;
  const context = alreadyWritten.length
    ? `

ALREADY WRITTEN IN THIS EDITION -- do not repeat these framings, openings or examples
${JSON.stringify(alreadyWritten)}`
    : '';
  const angle = material.angle
    ? `

BINDING EDITORIAL ANGLE (set by the owner before you started writing)
${material.angle}
Build the headline, body and editor's view around it. Never contradict a supplied claim or excerpt to fit it.`
    : '';
  const attributionRule = material.corroboratingExcerpts?.length
    ? '- Corroborating excerpts may confirm or qualify the primary source. Prefer the more cautious wording when they disagree. Still attribute vendor-reported benchmarks.'
    : `- This story has no independent corroborating excerpt. Attribute every number, benchmark and named result to ${material.primarySourceExcerpt?.sourceName ?? 'the primary source'} ("according to …", "self-reported"). Do not present those figures as independently verified.`;
  return `You are the senior editor-practitioner at AI Today Brief, a weekly digest read by software builders, AI practitioners and the technically curious -- not a briefing for executives. Write ONE story (rank ${rank}, ${placement}) for this week's edition. You are not writing the edition introduction, the title or any other story -- only this one.

${voicePromptBlock('en')}

STORY CONTRACT
${storyFieldContract(placement)}

EVIDENCE RULES
- A vivid opening must still be true. Use only a documented moment or source-supported fact from APPROVED STORY MATERIAL. Never invent a person staring at a screen, a machine crashing after N hours, a reaction, quote, chronology or other cinematic detail merely to satisfy the voice guidance. When the source has no real scene, open with the strongest verified contrast or result.
- The body must stand alone as a story -- never open a sentence with the name of another field ("Practical scenario:", "The limitation is that...", "Why it matters:", "The takeaway is..."). Those fields have their own boxes; restating them inside the body with a label is the single most common failure mode.
- Ground every factual sentence in the supplied claims and/or primarySourceExcerpt (and corroboratingExcerpts when present). Excerpts may supply detail absent from the numbered claims. Never invent numbers, names, quotes or causal implications absent from both. editorsView is the one deliberate exception -- see EDITOR'S VIEW above.
${attributionRule}
- Treat single-person logs, company benchmarks and vendor announcements as limited evidence. Attribute them in the headline and body, and do not turn one measured workload into a universal statement. For energy claims, name electricity, the unit and the workload (for example kWh per Claude Code session), not vague "energy".
- Return one JSON object only, no preamble and no code fence.

JSON SHAPE
{"story":{"headline":"","summary":"","hook":"","body":"","why":"","practical":"","limitation":"","takeaway":"","editorsView":"","discussionQuestion":"","claimIds":[""]}}${context}${angle}

APPROVED STORY MATERIAL
${JSON.stringify(material)}${masterRetryGuidancePrompt(guidance)}`;
}

export interface FramePromptStory {
  rank: number;
  placement: WeeklyPlacement;
  headline: string;
  hook: string;
  why: string;
  takeaway: string;
}

/**
 * The frame is written last, from the finished stories.
 *
 * The old writer had to commit to an edition theme in the same breath as its
 * first sentence, before a single story existed -- which is how "The Agentic
 * Shift" got stapled onto three unrelated developments (2026-08-09 audit).
 * Deriving the throughline from copy that already exists removes the
 * incentive to invent one.
 */
export function frameSegmentPrompt(
  stories: FramePromptStory[],
  guidance: WeeklyMasterRetryGuidance[],
): string {
  const targets = MASTER_FRAME_WORD_TARGETS;
  return `You are the senior editor-practitioner at AI Today Brief. The stories below are already written and approved for this week's edition. Write the edition frame: the title, metadata and the prose that wraps those stories. Do not rewrite the stories and do not introduce a story that is not in the list.

${voicePromptBlock('en')}

FRAME CONTRACT
- Establish one honest throughline from the three feature stories. Use a thematic umbrella only when the stories actually support a real connection; otherwise frame the edition transparently around the three concrete developments instead of forcing a vague idea onto unrelated stories.
- title: makes the Top 3 legible on first read by naming concrete actors, products or results. Never an umbrella label such as "The Agentic Shift" or "The Future of AI", and never a bare list of categories.
- standfirst: about ${targets.standfirst} words, opening on the edition's strongest news value. Never "A weekly digest..." boilerplate.
- intro: about ${targets.intro} words of continuous prose that earns the reader's next minute.
- editorNote: about ${targets.editorNote} words. It may say the edition uses cited primary sources and separately labeled editorial analysis. It must NOT claim original research -- this edition is a synthesis of external primary sources.
- conclusion: about ${targets.conclusion} words. Land the throughline; do not restate every story in turn.
- theme: a short internal label for this edition's throughline.
- Hard framing limits: seoTitle <=65 characters; metaDescription <=160; ogTitle <=70; ogDescription <=200. Count characters, not words.
- keyTakeaways: 3-5 entries, each one sentence, each traceable to a story below.
- topics and entities: drawn from the stories, no invented names.
- internalLinks: 2-4 entries of {anchor, query} pointing at concepts this edition would naturally link to.
- Return one JSON object only, no preamble and no code fence.

JSON SHAPE
{"frame":{"title":"","seoTitle":"","metaDescription":"","ogTitle":"","ogDescription":"","standfirst":"","theme":"","intro":"","editorNote":"","keyTakeaways":[""],"topics":[""],"entities":[""],"internalLinks":[{"anchor":"","query":""}],"conclusion":""}}

STORIES IN THIS EDITION
${JSON.stringify(stories)}${masterRetryGuidancePrompt(guidance)}`;
}

const UKRAINIAN_ADAPTATION_RULES = `- Це не дослівний переклад: перекажіть заново для ритму й природності українською, зберігши кожен факт, назву та числове значення.
- Перекладайте звичайні англійські слова та одиниці; лишайте англійською лише назви продуктів, код, CLI-прапорці та справді усталені технічні терміни.
- Надавайте перевагу зрозумілим українським відповідникам замість зайвих запозичень: «взаємодія», а не «інтеракція»; «супроводжувач пакета», а не «мейнтейнер»; «робочий процес», де «воркфлоу» нічого не додає. Ніколи не вигадуйте слово і не гадайте форму. Якщо не впевнені -- перепишіть простішою усталеною лексикою.
- Локалізуйте запис чисел і одиниць (1,138 -> 1 138; 0.6 kWh -> 0,6 кВт·год; 24 hours -> 24 години).
- Кратність лишається кратністю, а відсоток -- відсотком. «600x» -- це «у 600 разів», ніколи «на 600%»: різниця у два порядки.
- Порівняння енергії має казати «електроенергія», містити виміряну одиницю та навантаження і посилання на конкретний вимір.
- Вичитайте кожне поле після написання. Покручені слова, російські закінчення, неперекладені сполучники чи одиниці ("to", "hours", "minutes"), внутрішні назви полів, невідповідні десяткові роздільники та помилки узгодження -- це провалений текст, а не стилістична дрібниця.
- Ніколи не починайте речення міткою поля («Практичний сценарій:», «Обмеження полягає в тому», «Висновок для рішення:»).`;

export function ukrainianStorySegmentPrompt(input: {
  english: Omit<WeeklyMasterStory, 'revisionItemId' | 'placement'>;
  placement: WeeklyPlacement;
  terminology: { titleUk: string; summaryUk: string; whyUk: string | null };
  guidance: WeeklyMasterRetryGuidance[];
}): string {
  const body = storyBodyWordTarget(input.placement);
  return `Ви -- український старший редактор, який переповідає цю історію для української аудиторії розробників і техно-цікавих читачів, а не дослівний перекладач. Адаптуйте ОДНУ історію, подану нижче англійською. Не додавайте і не прибирайте фактів.

${voicePromptBlock('uk')}

ПРАВИЛА АДАПТАЦІЇ
${UKRAINIAN_ADAPTATION_RULES}
- body лишається в межах ${body.min}-${body.max} слів суцільної розповідної прози.
- ${input.placement === 'feature' ? 'editorsView -- самостійне українське переповідання редакційного міркування, а не механічний переклад; discussionQuestion обовʼязкове.' : 'editorsView і discussionQuestion лишаються порожніми рядками.'}
- claimIds не повертайте взагалі: вони копіюються з англійського оригіналу.
- Поверніть лише один JSON-обʼєкт, без преамбули й без огорожі коду.

JSON SHAPE
{"story":{"headline":"","summary":"","hook":"","body":"","why":"","practical":"","limitation":"","takeaway":"","editorsView":"","discussionQuestion":""}}

АНГЛІЙСЬКИЙ ОРИГІНАЛ
${JSON.stringify(input.english)}

ТЕРМІНОЛОГІЯ З ДЖЕРЕЛА
${JSON.stringify(input.terminology)}${masterRetryGuidancePrompt(input.guidance)}`;
}

export function ukrainianFramePrompt(input: {
  english: MasterFrame;
  stories: Array<{ rank: number; headline: string; takeaway: string }>;
  guidance: WeeklyMasterRetryGuidance[];
}): string {
  return `Ви -- український старший редактор. Адаптуйте рамку випуску (заголовок, метадані та обгортковий текст), подану нижче англійською. Історії вже адаптовані окремо; тут не переказуйте їх заново.

${voicePromptBlock('uk')}

ПРАВИЛА АДАПТАЦІЇ
${UKRAINIAN_ADAPTATION_RULES}
- Ті самі жорсткі межі, що й англійською: seoTitle <=65 символів; metaDescription <=160; ogTitle <=70; ogDescription <=200. Рахуйте символи.
- standfirst починається з новини, а не зі «Щотижневий дайджест».
- title називає конкретних дійових осіб, продукти або результати, а не абстрактну мітку на кшталт «Зсув до агентів».
- editorNote може описувати цитовані першоджерела та окремо позначений редакційний аналіз, але ніколи не вводить твердження про «оригінальні дослідження».
- Побудуйте ту саму наскрізну логіку, що й англійський оригінал. Не вигадуйте спільну «велику тему», якщо її немає в оригіналі.
- Поверніть лише один JSON-обʼєкт, без преамбули й без огорожі коду.

JSON SHAPE
{"frame":{"title":"","seoTitle":"","metaDescription":"","ogTitle":"","ogDescription":"","standfirst":"","theme":"","intro":"","editorNote":"","keyTakeaways":[""],"topics":[""],"entities":[""],"internalLinks":[{"anchor":"","query":""}],"conclusion":""}}

АНГЛІЙСЬКА РАМКА
${JSON.stringify(input.english)}

ІСТОРІЇ ВИПУСКУ (для узгодження термінів)
${JSON.stringify(input.stories)}${masterRetryGuidancePrompt(input.guidance)}`;
}

/**
 * One-line contract per repairable field, so a repair call knows what the
 * field is *for* without being handed the whole 5,000-character writer
 * prompt. Without this a "fix the practical field" request reliably produced
 * a second generic template -- the model had the complaint but not the spec.
 */
const REPAIR_FIELD_CONTRACT: Record<string, string> = {
  headline:
    'A real news headline about what happened: name the actor and the concrete event, never an abstract thesis.',
  summary: 'One sentence, at most 40 words, stating what happened.',
  hook: 'One or two sentences that make a reader want the body. Never a question, never a category label.',
  body: 'Continuous narrative prose with one throughline. Never open a sentence with another field name ("Practical scenario:", "Why it matters:").',
  why: 'One tight paragraph on why this matters, doing a different job from practical and takeaway.',
  practical:
    'One paragraph naming a concrete actor, workflow, action, constraint and observable result. Never a reusable category template that would fit another story with a find-and-replace.',
  limitation:
    'One paragraph saying plainly what the evidence does not establish, in a sentence a person would actually say -- not a boilerplate disclaimer clause.',
  takeaway: 'One decision a reader can act on, distinct from why and practical.',
  editorsView:
    "60-110 words of clearly-labeled editorial speculation in the editor's own voice, extending the story rather than summarizing it, ending on a real open tension.",
  discussionQuestion:
    'One closing question a thoughtful reader could genuinely disagree about. Not rhetorical.',
  claimIds: 'Ids from this story\'s approved claims array only. At least one.',
  title:
    'Names concrete actors, products or results from the Top 3. Never an umbrella label or a list of categories.',
  seoTitle: 'At most 65 characters.',
  metaDescription: 'At most 160 characters.',
  ogTitle: 'At most 70 characters.',
  ogDescription: 'At most 200 characters.',
  standfirst:
    "Opens on the edition's strongest news value in about 30 words. Never \"A weekly digest...\" boilerplate.",
  theme: "A short internal label for this edition's throughline.",
  intro: "About 150 words of continuous prose that earns the reader's next minute.",
  editorNote:
    'About 50 words. May say the edition uses cited primary sources and separately labeled editorial analysis. Must never claim original research.',
  conclusion: 'About 120 words landing the throughline without restating every story in turn.',
  keyTakeaways: '3-5 entries, each one sentence, each traceable to a story in this edition.',
  topics: 'Topic labels drawn from the edition, no invented names.',
  entities: 'Named entities that actually appear in the edition.',
};

export interface RepairFieldPromptInput {
  target: RepairTarget;
  currentValue: string | string[];
  issues: Array<Pick<WeeklyQualityIssue, 'code' | 'message' | 'span' | 'suggestedFix'>>;
  /** Claims + excerpts for the story being repaired; frame repairs get none. */
  grounding?: unknown;
  /** For a Ukrainian repair: the English value this field must stay in parity with. */
  englishCounterpart?: string | string[];
  /** Other fields of the same story, so a rewrite does not duplicate them. */
  siblings?: Record<string, string>;
}

/**
 * The targeted repair call: one field in, one field out.
 *
 * This is what replaced "regenerate the article" as the response to a
 * blocker. The prompt is small (single-digit thousands of characters against
 * ~53,000 for the old writer prompt) and the completion is a few hundred
 * tokens, so a repair round costs seconds and fractions of a cent instead of
 * a second full-length write -- which is what makes it affordable to keep
 * iterating until the edition converges instead of failing the job.
 */
export function repairFieldPrompt(input: RepairFieldPromptInput): string {
  const { target } = input;
  const list = isListRepairField(target.field);
  const contract = REPAIR_FIELD_CONTRACT[target.field] ?? 'Keep the field doing its existing job.';
  const localeRule =
    target.locale === 'uk'
      ? `Answer in Ukrainian. ${UKRAINIAN_ADAPTATION_RULES}`
      : 'Answer in English, in the house voice above.';
  const parity = input.englishCounterpart
    ? `

ENGLISH COUNTERPART -- your replacement must carry the same facts, numbers and claim ids as this, re-narrated naturally in Ukrainian (never word-for-word)
${JSON.stringify(input.englishCounterpart)}`
    : '';
  const grounding = input.grounding
    ? `

APPROVED EVIDENCE FOR THIS STORY -- every factual statement in your replacement must be supported by this. Drop anything that is not.
${JSON.stringify(input.grounding)}`
    : '';
  const siblings =
    input.siblings && Object.keys(input.siblings).length
      ? `

OTHER FIELDS OF THIS STORY -- your replacement must not duplicate or restate these
${JSON.stringify(input.siblings)}`
      : '';
  return `You are line-editing ONE field of an already-written AI Today Brief Weekly Digest. Fix exactly the problems listed below and change nothing else. Do not rewrite the story, do not restructure the edition, do not add facts.

${voicePromptBlock(target.locale)}

FIELD: ${target.field}${target.revisionItemId ? ` (story ${target.revisionItemId})` : ' (edition frame)'}
WHAT THIS FIELD MUST DO: ${contract}
LANGUAGE: ${localeRule}

PROBLEMS TO FIX
${JSON.stringify(input.issues)}

CURRENT VALUE
${JSON.stringify(input.currentValue)}${parity}${grounding}${siblings}

Return raw JSON and nothing else -- no preamble, no explanation, no code fence:
{"value": ${list ? '["", ""]' : '""'}}`;
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
