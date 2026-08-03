import 'server-only';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModelQueue } from '../../../pipeline/gemini-models';
import {
  fetchOpenRouterModels,
  type OpenRouterModelRecord,
} from '../../../pipeline/openrouter-models';
import { rankOpenRouterModelsByValue, minimalReasoningEffort } from '../../../pipeline/openrouter-value';
import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
import { generateWithClaudeCli } from '../../../pipeline/claude-cli';
import {
  WEEKLY_MASTER_SPEC_VERSION,
  validateMasterBundle,
  type WeeklyArticleMaster,
  type WeeklyContentQualityReport,
  type WeeklyMasterBundle,
  type WeeklyNarrationPlan,
  type WeeklyQualityDimension,
  type WeeklyQualityIssue,
  type WeeklyResearchPack,
} from './content-studio';

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
  english: WeeklyMasterEnglishResult;
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

const WEEKLY_SOCIAL_CHANNELS = [
  'telegram',
  'facebook',
  'threads',
  'x',
  'linkedin',
  'instagram',
] as const;

type WeeklySocialAngle = WeeklyMasterBundle['socialAngles'][number];

function canonicalSocialChannel(channel: string) {
  const normalized = channel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (normalized === 'twitter' || normalized === 'twitterx') return 'x';
  if (normalized === 'linkedin') return 'linkedin';
  return WEEKLY_SOCIAL_CHANNELS.find((candidate) => candidate === normalized);
}

export function normalizeWeeklySocialAngles(angles: WeeklySocialAngle[]) {
  const byChannel = new Map<string, WeeklySocialAngle>();
  for (const angle of angles) {
    const channel = canonicalSocialChannel(angle.channel);
    if (channel && !byChannel.has(channel)) byChannel.set(channel, { ...angle, channel });
  }
  if (WEEKLY_SOCIAL_CHANNELS.some((channel) => !byChannel.has(channel))) {
    throw new SyntaxError('English master requires exactly one social angle for each channel.');
  }
  return WEEKLY_SOCIAL_CHANNELS.map((channel) => byChannel.get(channel)!);
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
  const article = parseArticle(JSON.stringify(row.article), 'en');
  const videoRow = row.video;
  if (!videoRow || typeof videoRow !== 'object' || Array.isArray(videoRow)) {
    throw new SyntaxError('video is required.');
  }
  const video = videoRow as Record<string, unknown>;
  const narration: WeeklyNarrationPlan = {
    title: requiredString(video, 'title'),
    hook: requiredString(video, 'hook'),
    narration: requiredString(video, 'narration'),
    scenes: recordArray(video.scenes, 'video.scenes').map((scene) => ({
      id: requiredString(scene, 'id'),
      purpose: requiredString(scene, 'purpose'),
      voiceover: requiredString(scene, 'voiceover'),
      onScreenText: requiredString(scene, 'onScreenText'),
      visualBrief: requiredString(scene, 'visualBrief'),
      factIds: stringArray(scene.factIds, 'scene.factIds'),
      durationSeconds: Number(scene.durationSeconds),
    })),
    shorts: recordArray(video.shorts, 'video.shorts').map((short) => ({
      revisionItemId: requiredString(short, 'revisionItemId'),
      locale: 'uk' as const,
      hook: requiredString(short, 'hook'),
      context: requiredString(short, 'context'),
      insight: requiredString(short, 'insight'),
      takeaway: requiredString(short, 'takeaway'),
      factIds: stringArray(short.factIds, 'short.factIds'),
      durationSeconds: Number(short.durationSeconds),
    })),
  };
  if (narration.scenes.some((scene) => !Number.isFinite(scene.durationSeconds))) {
    throw new SyntaxError('Every scene requires a numeric durationSeconds.');
  }
  const socialAngles = normalizeWeeklySocialAngles(
    recordArray(row.socialAngles, 'socialAngles').map((angle) => ({
      channel: requiredString(angle, 'channel'),
      hookAngle: requiredString(angle, 'hookAngle'),
      thesis: requiredString(angle, 'thesis'),
      factIds: stringArray(angle.factIds, 'angle.factIds'),
    })),
  );
  return { article, video: narration, socialAngles };
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
    'hook',
    'clarity',
    'trust',
    'usefulness',
    'structure',
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

function providerOrder() {
  const configured = (process.env.WEEKLY_MASTER_PROVIDER_ORDER ?? 'claude-cli,openrouter,gemini')
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
  // the same request can consume the entire 300-second function budget. The
  // caller still has the independent premium provider fallback, while durable
  // job retries handle transient failures across separate invocations.
  return ranked.slice(0, 1).map((candidate) => candidate.id);
}

async function generateOpenRouter<T>(
  prompt: string,
  parse: (raw: string) => T,
  options: { configuredModels?: string[]; excludeVendors?: string[] } = {},
): Promise<ProviderResult<T>> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('UNCONFIGURED:OPEN_ROUTER_API_KEY');
  const models = await fetchOpenRouterModels(apiKey);
  const queue = premiumOpenRouterModels(models, options);
  if (!queue.length) throw new Error('No premium OpenRouter editorial model is available.');
  const chosenModel = models.find((model) => model.id === queue[0]);
  const reasoningEffort = chosenModel ? minimalReasoningEffort(chosenModel) : null;
  const result = await generateWithOpenRouterChain(prompt, {
    apiKey,
    modelQueue: queue,
    validateResponse: (_model, raw, finishReason) => {
      if (finishReason === 'length') throw new SyntaxError('Truncated editorial response.');
      parse(raw);
      return raw;
    },
    extraBodyForModel: reasoningEffort ? () => ({ reasoning: { effort: reasoningEffort } }) : undefined,
  });
  const value = parse(result.text);
  const promptTokens = result.usage?.promptTokens ?? estimateTokens(prompt.length);
  const outputTokens = result.usage?.completionTokens ?? estimateTokens(result.text.length);
  return {
    value,
    metadata: {
      provider: 'openrouter',
      model: result.model,
      promptTokens,
      outputTokens,
      estimatedCostUsd: result.usage?.costUsd ?? estimateCost(promptTokens, outputTokens),
      costSource: result.usage ? 'reported' : 'estimated',
      promptVersion: WEEKLY_MASTER_SPEC_VERSION,
    },
  };
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
  return models.filter(
    (model) => !/(?:^|[-_/])(?:flash|lite|mini|nano)(?:[-_/]|$)/i.test(model),
  );
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
) {
  if (provider === 'claude-cli') return generateClaudeCli(prompt, parse);
  return provider === 'openrouter'
    ? generateOpenRouter(prompt, parse)
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
) {
  let primaryError: unknown;
  const independentProvider = providerOrder().find(
    (provider) => provider !== english.metadata.provider,
  );
  if (independentProvider) {
    try {
      return await generateWithProvider(independentProvider, prompt, parseCritic);
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

async function generateFirstAvailable<T>(prompt: string, parse: (raw: string) => T) {
  const failures: string[] = [];
  for (const provider of providerOrder()) {
    try {
      return await generateWithProvider(provider, prompt, parse);
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

function englishPrompt(
  stories: WeeklyMasterInputStory[],
  retryGuidance: WeeklyMasterRetryGuidance[],
) {
  return `You are the senior editor-practitioner at AI Today Brief. Produce an engaging, evidence-bound Weekly Digest for builders, founders, product, technology and business leaders. Explain technical complexity in plain English, show judgment, and never use clickbait or generic advice.

CONTRACT
- Structure: Top 3 feature stories followed by 3–4 radar stories, preserving the supplied order and revisionItemId.
- Feature body: 400–650 words each. Radar body: 80–140 words each.
- Every feature must have a human hook, what happened, context, tension/change, evidence, audience, one concrete scenario, limitations and one decision-ready takeaway.
- Use only supplied claims. Every factual sentence must be attributable to claimIds; never invent numbers, names, quotes or causal implications.
- The practical field must name a concrete actor, workflow, action, constraint and observable result. Never use a reusable category template.
- Theme-led title; the date is secondary. All prose across the article object must total 2,000–3,000 words. Keep why, practical, limitation and takeaway concise and do not duplicate the body.
- Video: one English 6–8 minute narration plan and exactly three Ukrainian Shorts (35–50 seconds) for the Top 3.
- Return one JSON object only.
- socialAngles must contain exactly six objects: one for each exact lowercase channel value telegram, facebook, threads, x, linkedin and instagram. Do not combine channel names in one string.

JSON SHAPE
{"article":{"title":"","seoTitle":"","metaDescription":"","ogTitle":"","ogDescription":"","standfirst":"","theme":"","intro":"","editorNote":"","keyTakeaways":[""],"topics":[""],"entities":[""],"internalLinks":[{"anchor":"","query":""}],"conclusion":"","stories":[{"revisionItemId":"","placement":"feature|radar","headline":"","summary":"","hook":"","body":"","why":"","practical":"","limitation":"","takeaway":"","claimIds":[""]}]},"video":{"title":"","hook":"","narration":"","scenes":[{"id":"","purpose":"","voiceover":"","onScreenText":"","visualBrief":"","factIds":[""],"durationSeconds":1}],"shorts":[{"revisionItemId":"","hook":"","context":"","insight":"","takeaway":"","factIds":[""],"durationSeconds":40}]},"socialAngles":[{"channel":"telegram","hookAngle":"","thesis":"","factIds":[""]},{"channel":"facebook","hookAngle":"","thesis":"","factIds":[""]},{"channel":"threads","hookAngle":"","thesis":"","factIds":[""]},{"channel":"x","hookAngle":"","thesis":"","factIds":[""]},{"channel":"linkedin","hookAngle":"","thesis":"","factIds":[""]},{"channel":"instagram","hookAngle":"","thesis":"","factIds":[""]}]}

APPROVED STORY MATERIAL
${JSON.stringify(stories)}${masterRetryGuidancePrompt(retryGuidance)}`;
}

function ukrainianPrompt(en: WeeklyArticleMaster, stories: WeeklyMasterInputStory[]) {
  return `Act as a Ukrainian senior news editor, not a literal translator. Adapt the approved English Weekly Digest into natural contemporary Ukrainian for AI builders and decision-makers. Preserve revisionItemId, placement, story order, every claimIds array, all names and every number exactly. Use «ШІ» in Ukrainian prose except inside official product names. Avoid calques, bureaucratic phrasing and unexplained English workflow/production jargon. Keep feature bodies at 400–650 words and radar at 80–140 words. Return only the article JSON object in the same shape as the English article.

APPROVED ENGLISH MASTER
${JSON.stringify(en)}

SOURCE MATERIAL FOR TERMINOLOGY
${JSON.stringify(stories.map(({ revisionItemId, titleUk, summaryUk, whyUk }) => ({ revisionItemId, titleUk, summaryUk, whyUk })))}`;
}

function criticPrompt(bundle: WeeklyMasterBundle, stories: WeeklyMasterInputStory[]) {
  return `You are the independent factual and editorial critic for AI Today Brief. Audit the bilingual master against ONLY the approved claims. Flag any unsupported number, quote, named claim, or causal implication. Also evaluate hook, clarity, trust, usefulness, structure, Ukrainian naturalness and EN/UK factual parity. A writer may paraphrase a claim but may not strengthen it. Return JSON only.

Required dimensions: hook, clarity, trust, usefulness, structure, naturalness, parity. Score each 0–100. Overall score 0–100. factualFlags must be [] when clean. Every issue needs code, message, blocker, and when possible locale, revisionItemId, field, exact span, suggestedFix.

JSON SHAPE
{"score":0,"dimensions":[{"name":"hook","score":0,"note":""}],"factualFlags":[],"issues":[{"code":"","message":"","blocker":true,"locale":"en|uk","revisionItemId":"","field":"","span":"","suggestedFix":""}]}

APPROVED CLAIMS
${JSON.stringify(stories.map(({ revisionItemId, claims }) => ({ revisionItemId, claims })))}

MASTER TO AUDIT
${JSON.stringify(bundle)}`;
}

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
  } = {},
): Promise<WeeklyMasterGenerationResult> {
  let english = options.checkpoint?.english;
  if (!english) {
    english = await generateFirstAvailable(englishPrompt(stories, retryGuidance), parseEnglishPackage);
    await options.onStepComplete?.('english', english);
  }
  let ukrainian = options.checkpoint?.ukrainian;
  if (!ukrainian) {
    ukrainian = await generateWithProvider(
      english.metadata.provider,
      ukrainianPrompt(english.value.article, stories),
      (raw) => parseArticle(raw, 'uk'),
    );
    await options.onStepComplete?.('ukrainian', ukrainian);
  }
  const bundle: WeeklyMasterBundle = {
    en: english.value.article,
    uk: ukrainian.value,
    video: english.value.video,
    socialAngles: english.value.socialAngles,
  };
  const critic = await generateIndependentCritic(english, criticPrompt(bundle, stories));
  const deterministicIssues = validateMasterBundle(
    bundle,
    researchPacks,
    stories.map((story) => ({
      revisionItemId: story.revisionItemId,
      placement: story.placement,
      claimIds: story.claims.map((claim) => claim.id),
    })),
  );
  const approvedClaimIds = stories.flatMap((story) => story.claims.map((claim) => claim.id));
  const quality: WeeklyContentQualityReport = {
    schemaVersion: 'weekly-quality-v2',
    score: critic.value.score,
    dimensions: critic.value.dimensions,
    issues: [...deterministicIssues, ...critic.value.issues],
    factualFlags: critic.value.factualFlags,
    approvedClaimIds,
    checkedAt: new Date().toISOString(),
  };
  return {
    bundle,
    quality,
    generation: {
      english: english.metadata,
      ukrainian: ukrainian.metadata,
      critic: critic.metadata,
    },
  };
}
