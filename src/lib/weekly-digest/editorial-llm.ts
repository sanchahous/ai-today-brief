import 'server-only';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModelQueue } from '../../../pipeline/gemini-models';
import {
  fetchOpenRouterModels,
  type OpenRouterModelRecord,
} from '../../../pipeline/openrouter-models';
import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
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

type EditorialProvider = 'gemini' | 'openrouter';

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

interface ProviderResult<T> {
  value: T;
  metadata: EditorialGenerationMetadata;
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
  const socialAngles = recordArray(row.socialAngles, 'socialAngles').map((angle) => ({
    channel: requiredString(angle, 'channel'),
    hookAngle: requiredString(angle, 'hookAngle'),
    thesis: requiredString(angle, 'thesis'),
    factIds: stringArray(angle.factIds, 'angle.factIds'),
  }));
  const requiredChannels = ['telegram', 'facebook', 'threads', 'x', 'linkedin', 'instagram'];
  if (
    socialAngles.length !== requiredChannels.length ||
    requiredChannels.some(
      (channel) => socialAngles.filter((angle) => angle.channel === channel).length !== 1,
    )
  ) {
    throw new SyntaxError('English master requires exactly one social angle for each channel.');
  }
  return { article, video: narration, socialAngles };
}

function parseCritic(raw: string) {
  const row = parseJsonObject(raw);
  const dimensions = recordArray(row.dimensions, 'dimensions').map((dimension) => ({
    name: requiredString(dimension, 'name') as WeeklyQualityDimension['name'],
    score: Number(dimension.score),
    note: requiredString(dimension, 'note'),
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
    factualFlags: stringArray(row.factualFlags ?? ['none'], 'factualFlags').filter(
      (flag) => flag !== 'none',
    ),
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
  const configured = (process.env.WEEKLY_MASTER_PROVIDER_ORDER ?? 'openrouter,gemini')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is EditorialProvider => value === 'openrouter' || value === 'gemini');
  return [...new Set(configured)];
}

function premiumOpenRouterModels(models: OpenRouterModelRecord[]) {
  const configured = (process.env.WEEKLY_MASTER_OPENROUTER_MODELS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const eligible = models
    .filter((model) => {
      const id = model.id.toLowerCase();
      return (
        !/:free$/.test(id) &&
        !/mini|flash|lite|small|nano|coder|image|audio|embedding/.test(id) &&
        !model.expiration_date &&
        (model.context_length ?? 0) >= 64_000 &&
        (model.architecture?.modality ?? 'text').includes('text')
      );
    })
    .sort((left, right) => (right.created ?? 0) - (left.created ?? 0))
    .map((model) => model.id);
  const allowed = new Set(eligible);
  const selected = configured.length ? configured.filter((model) => allowed.has(model)) : eligible;
  return selected.slice(0, 3);
}

async function generateOpenRouter<T>(
  prompt: string,
  parse: (raw: string) => T,
): Promise<ProviderResult<T>> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('UNCONFIGURED:OPEN_ROUTER_API_KEY');
  const queue = premiumOpenRouterModels(await fetchOpenRouterModels(apiKey));
  if (!queue.length) throw new Error('No premium OpenRouter editorial model is available.');
  const result = await generateWithOpenRouterChain(prompt, {
    apiKey,
    modelQueue: queue,
    validateResponse: (_model, raw, finishReason) => {
      if (finishReason === 'length') throw new SyntaxError('Truncated editorial response.');
      parse(raw);
      return raw;
    },
  });
  const value = parse(result.text);
  const promptTokens = estimateTokens(prompt.length);
  const outputTokens = estimateTokens(result.text.length);
  return {
    value,
    metadata: {
      provider: 'openrouter',
      model: result.model,
      promptTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(promptTokens, outputTokens),
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

async function generateWithProvider<T>(
  provider: EditorialProvider,
  prompt: string,
  parse: (raw: string) => T,
) {
  return provider === 'openrouter'
    ? generateOpenRouter(prompt, parse)
    : generateGemini(prompt, parse);
}

async function generateFirstAvailable<T>(prompt: string, parse: (raw: string) => T) {
  let lastError: unknown;
  for (const provider of providerOrder()) {
    try {
      return await generateWithProvider(provider, prompt, parse);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('No premium editorial provider is configured.');
}

function englishPrompt(stories: WeeklyMasterInputStory[]) {
  return `You are the senior editor-practitioner at AI Today Brief. Produce an engaging, evidence-bound Weekly Digest for builders, founders, product, technology and business leaders. Explain technical complexity in plain English, show judgment, and never use clickbait or generic advice.

CONTRACT
- Structure: Top 3 feature stories followed by 3–4 radar stories, preserving the supplied order and revisionItemId.
- Feature body: 400–650 words each. Radar body: 80–140 words each.
- Every feature must have a human hook, what happened, context, tension/change, evidence, audience, one concrete scenario, limitations and one decision-ready takeaway.
- Use only supplied claims. Every factual sentence must be attributable to claimIds; never invent numbers, names, quotes or causal implications.
- The practical field must name a concrete actor, workflow, action, constraint and observable result. Never use a reusable category template.
- Theme-led title; the date is secondary. Total article target: 2,000–3,000 words.
- Video: one English 6–8 minute narration plan and exactly three Ukrainian Shorts (35–50 seconds) for the Top 3.
- Return one JSON object only.

JSON SHAPE
{"article":{"title":"","seoTitle":"","metaDescription":"","ogTitle":"","ogDescription":"","standfirst":"","theme":"","intro":"","editorNote":"","keyTakeaways":[""],"topics":[""],"entities":[""],"internalLinks":[{"anchor":"","query":""}],"conclusion":"","stories":[{"revisionItemId":"","placement":"feature|radar","headline":"","summary":"","hook":"","body":"","why":"","practical":"","limitation":"","takeaway":"","claimIds":[""]}]},"video":{"title":"","hook":"","narration":"","scenes":[{"id":"","purpose":"","voiceover":"","onScreenText":"","visualBrief":"","factIds":[""],"durationSeconds":1}],"shorts":[{"revisionItemId":"","hook":"","context":"","insight":"","takeaway":"","factIds":[""],"durationSeconds":40}]},"socialAngles":[{"channel":"telegram|facebook|threads|x|linkedin|instagram","hookAngle":"","thesis":"","factIds":[""]}]}

APPROVED STORY MATERIAL
${JSON.stringify(stories)}`;
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
): Promise<WeeklyMasterGenerationResult> {
  const english = await generateFirstAvailable(englishPrompt(stories), parseEnglishPackage);
  const ukrainian = await generateWithProvider(
    english.metadata.provider,
    ukrainianPrompt(english.value.article, stories),
    (raw) => parseArticle(raw, 'uk'),
  );
  const bundle: WeeklyMasterBundle = {
    en: english.value.article,
    uk: ukrainian.value,
    video: english.value.video,
    socialAngles: english.value.socialAngles,
  };
  const independent = providerOrder().find((provider) => provider !== english.metadata.provider);
  if (!independent) {
    throw new Error('An independent premium critic provider is required before master approval.');
  }
  const critic = await generateWithProvider(
    independent,
    criticPrompt(bundle, stories),
    parseCritic,
  );
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
