/**
 * Daily edition cover prompt: one art-director call for the pack (top stories +
 * intro), then a copy-ready ManualImagePrompt. Never renders an image.
 */
import type { EditorialEssence, WeeklyReportageSceneBriefResult } from './card-image';
import type { PipelineDb } from './db';
import { logEvent } from './log';
import { exportManualImagePrompt, type ManualImagePrompt } from './prompt-export';
import {
  generateWithRegistry,
  loadProviderRegistry,
} from './providers/registry';
import type { Json } from '@/lib/database.types';

export const DAILY_COVER_SCENE_ROLE = 'daily.cover_scene' as const;
export const DAILY_COVER_HEADLINE_LIMIT = 3;

export interface DailyCoverEdition {
  title: string;
  intro: string;
  headlines: string[];
}

export interface StoredDailyCoverPrompt extends ManualImagePrompt {
  generatedAt: string;
  source: string;
  headlines: string[];
  notifiedAt: string | null;
}

export type FillDailyCoverStatus = 'written' | 'skipped' | 'failed';

export type CoverSceneGenerate = (
  role: typeof DAILY_COVER_SCENE_ROLE,
  prompt: string,
) => Promise<{ text: string; provider: string }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function takeTopHeadlines(
  titles: readonly string[],
  limit = DAILY_COVER_HEADLINE_LIMIT,
): string[] {
  const headlines: string[] = [];
  for (const title of titles) {
    const trimmed = title.trim();
    if (!trimmed) continue;
    headlines.push(trimmed);
    if (headlines.length >= limit) break;
  }
  return headlines;
}

export function buildDailyCoverSceneInstruction(edition: DailyCoverEdition): string {
  const headlines = takeTopHeadlines(edition.headlines);
  const numbered = headlines.map((headline, index) => `${index + 1}. ${headline}`).join('\n');
  return [
    'You are the art director for a developer-focused technology magazine.',
    'Design ONE cover illustration for the whole daily edition, not for a single news item.',
    'The image must make the shared tension of these top stories readable in one tableau.',
    'Name a concrete focal subject, setting, and action. No text, letters, logos, or real faces.',
    'Reply with JSON only:',
    '{"title":"short concept name","scene":"18-40 word tableau","mechanism":"visible cause","consequence":"visible outcome","visualThesis":"what a reader grasps in 3 seconds"}',
    '',
    `Edition title: ${edition.title.trim() || 'Daily AI brief'}`,
    `Edition intro: ${edition.intro.trim() || 'No intro.'}`,
    'Top stories:',
    numbered || '(none)',
  ].join('\n');
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function fallbackScene(headlines: readonly string[]): string {
  const named = headlines.length > 0 ? headlines.join('; ') : 'today’s AI engineering brief';
  return (
    `A newsroom layout table holding distinct physical artifacts that stand for ${named}, ` +
    `cool cyan accent, one continuous photograph, no collage, no writing in the frame`
  );
}

function editionEssence(edition: DailyCoverEdition, headlines: readonly string[]): EditorialEssence {
  const title = edition.title.trim() || 'Daily AI brief';
  const intro = edition.intro.trim() || title;
  const joined = headlines.join(' · ') || title;
  return {
    storyContext: joined,
    meaning: intro,
    essence: title,
    mustFeel: 'edition-wide tension',
    forbiddenCliches: [],
    mechanism: 'The top stories of the day share one visible situation.',
    consequence: 'A reader sees the day’s engineering shift without reading a caption.',
    visualThesis: intro,
    readerTest: `grasp: ${joined}`,
  };
}

function sceneBriefFromDirector(
  parsed: Record<string, unknown> | null,
  headlines: readonly string[],
  essence: EditorialEssence,
  source: string,
): WeeklyReportageSceneBriefResult {
  const scene = asTrimmedString(parsed?.scene) ?? fallbackScene(headlines);
  return {
    scene,
    source,
    conceptLens: 'literal_context',
    essence: essence.essence,
    metaphorTitle: asTrimmedString(parsed?.title) ?? 'Edition cover',
    storyContext: essence.storyContext,
    meaning: essence.meaning,
    mechanism: asTrimmedString(parsed?.mechanism) ?? essence.mechanism,
    consequence: asTrimmedString(parsed?.consequence) ?? essence.consequence,
    visualThesis: asTrimmedString(parsed?.visualThesis) ?? essence.visualThesis,
    readerTest: essence.readerTest,
    visibleMechanism: asTrimmedString(parsed?.mechanism) ?? essence.mechanism,
    visibleConsequence: asTrimmedString(parsed?.consequence) ?? essence.consequence,
  };
}

export function parseStoredCoverPrompt(value: unknown): StoredDailyCoverPrompt | null {
  if (!isRecord(value)) return null;
  const canonical = asTrimmedString(value.canonical);
  const midjourney = asTrimmedString(value.midjourney);
  const negative = asTrimmedString(value.negative);
  if (!canonical || !midjourney || !negative) return null;
  const headlines = Array.isArray(value.headlines)
    ? value.headlines.map(asTrimmedString).filter((row): row is string => Boolean(row))
    : [];
  const notes = Array.isArray(value.notes)
    ? value.notes.map(asTrimmedString).filter((row): row is string => Boolean(row))
    : [];
  const lens = asTrimmedString(value.conceptLens);
  const grammar = asTrimmedString(value.grammar);
  return {
    conceptLens:
      lens === 'mechanism' || lens === 'consequence' ? lens : 'literal_context',
    grammar:
      grammar === 'source_led_fallback' || grammar === 'deterministic_technical_hybrid'
        ? grammar
        : 'cinematic_domain_scene',
    title: asTrimmedString(value.title) ?? 'Edition cover',
    canonical,
    midjourney,
    negative,
    aspectRatio: '16:9',
    notes,
    generatedAt: asTrimmedString(value.generatedAt) ?? asTrimmedString(value.generated_at) ?? '',
    source: asTrimmedString(value.source) ?? 'unknown',
    headlines,
    notifiedAt: asTrimmedString(value.notifiedAt) ?? asTrimmedString(value.notified_at),
  };
}

export function storedCoverPromptToJson(stored: StoredDailyCoverPrompt): Json {
  return {
    conceptLens: stored.conceptLens,
    grammar: stored.grammar,
    title: stored.title,
    canonical: stored.canonical,
    midjourney: stored.midjourney,
    negative: stored.negative,
    aspectRatio: stored.aspectRatio,
    notes: stored.notes,
    generatedAt: stored.generatedAt,
    source: stored.source,
    headlines: stored.headlines,
    notifiedAt: stored.notifiedAt,
  };
}

export async function buildDailyCoverPrompt(input: {
  edition: DailyCoverEdition;
  generate: CoverSceneGenerate;
  now?: () => string;
}): Promise<StoredDailyCoverPrompt> {
  const headlines = takeTopHeadlines(input.edition.headlines);
  const instruction = buildDailyCoverSceneInstruction({ ...input.edition, headlines });
  const essence = editionEssence(input.edition, headlines);
  let source = 'fallback';
  let parsed: Record<string, unknown> | null = null;
  try {
    const result = await input.generate(DAILY_COVER_SCENE_ROLE, instruction);
    const next = parseJsonObject(result.text);
    if (next && asTrimmedString(next.scene)) {
      parsed = next;
      source = result.provider;
    }
  } catch {
    // Director call failed; sceneBriefFromDirector still builds a copy-ready prompt.
  }
  const brief = sceneBriefFromDirector(parsed, headlines, essence, source);
  const prompt = exportManualImagePrompt({ brief, essence });
  return {
    ...prompt,
    generatedAt: input.now?.() ?? new Date().toISOString(),
    source,
    headlines,
    notifiedAt: null,
  };
}

async function loadEdition(db: PipelineDb, briefId: string): Promise<{
  edition: DailyCoverEdition;
  existing: StoredDailyCoverPrompt | null;
} | null> {
  const { data: brief, error: briefError } = await db
    .from('briefs')
    .select('title_en, intro_en, cover_prompt')
    .eq('id', briefId)
    .maybeSingle();
  if (briefError) throw new Error(`[daily-cover] load brief failed: ${briefError.message}`);
  if (!brief) return null;
  const { data: items, error: itemsError } = await db
    .from('brief_items')
    .select('rank, title_en, title_uk, review_status')
    .eq('brief_id', briefId)
    .order('rank', { ascending: true });
  if (itemsError) throw new Error(`[daily-cover] load items failed: ${itemsError.message}`);
  const headlines = takeTopHeadlines(
    (items ?? [])
      .filter((item) => item.review_status !== 'rejected')
      .map((item) => item.title_en || item.title_uk || ''),
  );
  return {
    edition: {
      title: brief.title_en,
      intro: brief.intro_en ?? '',
      headlines,
    },
    existing: parseStoredCoverPrompt(brief.cover_prompt),
  };
}

async function defaultGenerate(db: PipelineDb, briefId: string): Promise<CoverSceneGenerate> {
  const registry = await loadProviderRegistry(process.env, {}, db);
  return async (role, prompt) => {
    const result = await generateWithRegistry(role, prompt, registry);
    const { error } = await db.from('generation_cost_events').insert({
      scope: 'daily',
      kind: 'llm',
      provider: result.provider,
      model: result.model,
      cost_usd: result.usage.costUsd ?? 0,
      cost_source: result.usage.costSource,
      prompt_tokens: result.usage.promptTokens,
      output_tokens: result.usage.outputTokens,
      step_key: DAILY_COVER_SCENE_ROLE,
      metadata: { brief_id: briefId },
    });
    if (error) {
      logEvent('warn', 'publish', 'Daily cover prompt cost ledger write failed', {
        error: error.message,
      });
    }
    return { text: result.text, provider: result.provider };
  };
}

export async function fillDailyCoverPrompt(
  db: PipelineDb,
  briefId: string,
  deps: {
    generate?: CoverSceneGenerate;
    now?: () => string;
  } = {},
): Promise<FillDailyCoverStatus> {
  try {
    const loaded = await loadEdition(db, briefId);
    if (!loaded) return 'failed';
    if (loaded.existing) return 'skipped';
    if (loaded.edition.headlines.length === 0) return 'skipped';
    const generate = deps.generate ?? (await defaultGenerate(db, briefId));
    const stored = await buildDailyCoverPrompt({
      edition: loaded.edition,
      generate,
      now: deps.now,
    });
    const { error } = await db
      .from('briefs')
      .update({ cover_prompt: storedCoverPromptToJson(stored) })
      .eq('id', briefId);
    if (error) {
      logEvent('warn', 'publish', 'Daily cover prompt save failed', { error: error.message });
      return 'failed';
    }
    return 'written';
  } catch (error) {
    logEvent('warn', 'publish', 'Daily cover prompt failed (non-fatal)', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

export async function markCoverPromptNotified(
  db: PipelineDb,
  briefId: string,
  stored: StoredDailyCoverPrompt,
  notifiedAt = new Date().toISOString(),
): Promise<void> {
  const next = storedCoverPromptToJson({ ...stored, notifiedAt });
  const { error } = await db.from('briefs').update({ cover_prompt: next }).eq('id', briefId);
  if (error) {
    logEvent('warn', 'notify', 'Daily cover prompt notified_at save failed', { error: error.message });
  }
}
