/**
 * Vision-LLM critic: prompt + JSON parse for weekly/daily image QA.
 * Provider I/O lives in pipeline/providers/vision.ts; this module stays pure
 * enough to unit-test parsing and pass/fail thresholds.
 */

import { contentSimScoreThreshold } from './config';
import type { ContentSimBlocker, ContentSimCritique, ContentSimRepairDirective } from './types';

export const IMAGE_CRITIC_BLOCKER_CODES = [
  'readable_text',
  'ui_chrome',
  'collage_panels',
  'banned_cliche',
  'off_metaphor',
  'off_news',
  'melted_motion',
  'brand_unsafe',
  'low_quality',
  'wrong_subject',
  'impossible_orientation',
  'prop_use_mismatch',
  'decorative_second_beat',
  'sibling_echo',
] as const;

export type ImageCriticBlockerCode = (typeof IMAGE_CRITIC_BLOCKER_CODES)[number];

/** Floor for news_legibility when CONTENT_SIM_SCORE_THRESHOLD is lower. */
export const NEWS_LEGIBILITY_MIN = 75;

export function newsLegibilityThreshold(scoreThreshold = contentSimScoreThreshold()): number {
  return Math.max(NEWS_LEGIBILITY_MIN, scoreThreshold);
}

/**
 * Honest overall: craft cannot inflate past news legibility.
 * `overall = min(overall, news_legibility + 5)`.
 */
export function clampOverallByNewsLegibility(overall: number, newsLegibility: number): number {
  return Math.min(overall, newsLegibility + 5);
}

export function buildImageCriticPrompt(input: {
  headline: string;
  essence?: string;
  mechanism?: string;
  readerTest?: string;
  metaphorTitle?: string;
  whyItFits?: string;
  scene?: string;
  policyId?: string;
  scoreThreshold?: number;
  siblingScenes?: string[];
}): string {
  const threshold = input.scoreThreshold ?? contentSimScoreThreshold();
  const newsFloor = newsLegibilityThreshold(threshold);
  const siblingBlock =
    input.siblingScenes?.length ?
      [
        'Sibling scenes already used in this digest (flag sibling_echo if this image rhymes with them):',
        ...input.siblingScenes.slice(0, 6).map((s, i) => `  ${i + 1}. ${s.slice(0, 160)}`),
      ].join('\n')
    : '';
  return [
    'You are the art director QA for AI Today Brief.',
    `Policy: ${input.policyId ?? 'weekly-editorial-concept-v3'} (no readable text, no UI chrome, no comic panels/collage).`,
    `Score overall 0–100. Pass only if overall >= ${threshold}, news_legibility >= ${newsFloor}, AND no blocking issues.`,
    'Blocking codes (use exactly): readable_text | ui_chrome | collage_panels | banned_cliche | off_metaphor | off_news | melted_motion | brand_unsafe | low_quality | wrong_subject | impossible_orientation | prop_use_mismatch | decorative_second_beat | sibling_echo.',
    'banned_cliche includes: terminal/IDE screens, paper-heap sludge, generic desk without a conceptual prop.',
    'Editorial fidelity (news first):',
    '- off_news: the image could illustrate almost any tech story; it does not make THIS story’s distinctive mechanism visible. Score news_legibility low.',
    '- melted_motion: smeared shuttles, melted limbs, motion-lag blobs, streaking blur that destroys silhouette readability.',
    'Ask yourself: would a developer infer THIS story’s distinctive claim from the image alone?',
    'Physics / craft checks:',
    '- impossible_orientation: readable surfaces (books, journals, screens, signs) upside-down or rotated vs how a human would use them.',
    '- prop_use_mismatch: grip, posture, or object use that a human would not do this way.',
    '- decorative_second_beat: second half of a dual/contrast frame that does not argue the essence (ballerinas, props that are mood-only).',
    '- sibling_echo: composition/subject rhymes with a sibling scene listed below.',
    '',
    `Headline: ${input.headline}`,
    input.essence ? `Essence: ${input.essence}` : '',
    input.mechanism ? `Mechanism that must be visible: ${input.mechanism}` : '',
    input.readerTest ? `Reader test: ${input.readerTest}` : '',
    input.metaphorTitle ? `Metaphor: ${input.metaphorTitle}` : '',
    input.whyItFits ? `Why it fits: ${input.whyItFits}` : '',
    input.scene ? `Scene brief: ${input.scene.slice(0, 800)}` : '',
    siblingBlock,
    '',
    'Inspect the attached image. Reply with ONLY JSON:',
    '{',
    '  "overall": number,',
    '  "dimensions": { "metaphor_fit": number, "no_text": number, "craft": number, "brand_safe": number, "news_legibility": number },',
    '  "blockers": [{ "code": string, "message": string, "region": string }],',
    '  "notes": string,',
    '  "repair": {',
    '    "prompt_patches": string[],',
    '    "reject_metaphor": boolean,',
    '    "scene_override": string | null,',
    '    "change_seed": boolean,',
    '    "suggested_actions": string[]',
    '  }',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseBlockers(raw: unknown): ContentSimBlocker[] {
  if (!Array.isArray(raw)) return [];
  const out: ContentSimBlocker[] = [];
  for (const entry of raw) {
    const row = asRecord(entry);
    const code = str(row.code);
    const message = str(row.message);
    if (!code || !message) continue;
    out.push({
      code,
      message,
      region: str(row.region),
      blocker: true,
    });
  }
  return out;
}

function parseRepair(raw: unknown): ContentSimRepairDirective | undefined {
  const row = asRecord(raw);
  if (Object.keys(row).length === 0) return undefined;
  const patches = Array.isArray(row.prompt_patches)
    ? row.prompt_patches.filter((p): p is string => typeof p === 'string' && Boolean(p.trim()))
    : [];
  const actions = Array.isArray(row.suggested_actions)
    ? row.suggested_actions.filter((p): p is string => typeof p === 'string' && Boolean(p.trim()))
    : [];
  return {
    promptPatches: patches.length ? patches : undefined,
    rejectMetaphor: row.reject_metaphor === true,
    sceneOverride: str(row.scene_override) ?? undefined,
    changeSeed: row.change_seed === true,
    suggestedActions: actions.length ? actions : undefined,
  };
}

/**
 * Extract first JSON object from a model response (tolerates fences).
 * Returns null when the model returns prose / empty / truncated garbage —
 * callers must soft-fail (never throw through scoreAndPickVariants).
 */
export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function criticParseFailure(reason: string): ContentSimCritique {
  return {
    passed: false,
    scores: { overall: 0, news_legibility: 0, craft: 0 },
    blockers: [
      {
        code: 'critic_parse_error',
        message: reason,
        blocker: true,
      },
    ],
    notes: reason,
    repairDirective: {
      changeSeed: true,
      suggestedActions: ['Retry vision critic with a fresh seed'],
    },
  };
}

export function parseImageCriticResponse(
  text: string,
  scoreThreshold = contentSimScoreThreshold(),
): ContentSimCritique {
  let raw: unknown;
  try {
    raw = extractJsonObject(text);
  } catch {
    return criticParseFailure('Vision critic response could not be parsed as JSON.');
  }
  if (raw == null) {
    return criticParseFailure('No JSON object in critic response');
  }
  const parsed = asRecord(raw);
  if (Object.keys(parsed).length === 0 && typeof raw !== 'object') {
    return criticParseFailure('Critic JSON was empty or not an object.');
  }
  const dimensions = asRecord(parsed.dimensions);
  const rawOverall = num(parsed.overall, num(dimensions.overall, 0));
  const newsLegibility = num(dimensions.news_legibility, rawOverall);
  const overall = clampOverallByNewsLegibility(rawOverall, newsLegibility);
  const blockers = parseBlockers(parsed.blockers);
  const scores = {
    overall,
    metaphor_fit: num(dimensions.metaphor_fit, overall),
    no_text: num(dimensions.no_text, overall),
    craft: num(dimensions.craft, overall),
    brand_safe: num(dimensions.brand_safe, overall),
    news_legibility: newsLegibility,
  };
  const newsFloor = newsLegibilityThreshold(scoreThreshold);
  const hasOffNews = blockers.some((b) => b.code === 'off_news');
  const passed =
    blockers.length === 0 &&
    !hasOffNews &&
    overall >= scoreThreshold &&
    newsLegibility >= newsFloor;
  return {
    passed,
    scores,
    blockers,
    notes: str(parsed.notes),
    repairDirective: passed ? undefined : parseRepair(parsed.repair),
  };
}
