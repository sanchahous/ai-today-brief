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
  'brand_unsafe',
  'low_quality',
  'wrong_subject',
] as const;

export type ImageCriticBlockerCode = (typeof IMAGE_CRITIC_BLOCKER_CODES)[number];

export function buildImageCriticPrompt(input: {
  headline: string;
  essence?: string;
  metaphorTitle?: string;
  scene?: string;
  policyId?: string;
  scoreThreshold?: number;
}): string {
  const threshold = input.scoreThreshold ?? contentSimScoreThreshold();
  return [
    'You are the art director QA for AI Today Brief.',
    `Policy: ${input.policyId ?? 'weekly-editorial-concept-v1'} (no readable text, no UI chrome, no comic panels/collage).`,
    `Score overall 0–100. Pass only if overall >= ${threshold} AND no blocking issues.`,
    'Blocking codes (use exactly): readable_text | ui_chrome | collage_panels | banned_cliche | off_metaphor | brand_unsafe | low_quality | wrong_subject.',
    'banned_cliche includes: terminal/IDE screens, paper-heap sludge, generic desk without a conceptual prop.',
    '',
    `Headline: ${input.headline}`,
    input.essence ? `Essence: ${input.essence}` : '',
    input.metaphorTitle ? `Metaphor: ${input.metaphorTitle}` : '',
    input.scene ? `Scene brief: ${input.scene.slice(0, 800)}` : '',
    '',
    'Inspect the attached image. Reply with ONLY JSON:',
    '{',
    '  "overall": number,',
    '  "dimensions": { "metaphor_fit": number, "no_text": number, "craft": number, "brand_safe": number },',
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

/** Extract first JSON object from a model response (tolerates fences). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) throw new SyntaxError('No JSON object in critic response');
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  }
}

export function parseImageCriticResponse(
  text: string,
  scoreThreshold = contentSimScoreThreshold(),
): ContentSimCritique {
  const parsed = asRecord(extractJsonObject(text));
  const dimensions = asRecord(parsed.dimensions);
  const overall = num(parsed.overall, num(dimensions.overall, 0));
  const blockers = parseBlockers(parsed.blockers);
  const scores = {
    overall,
    metaphor_fit: num(dimensions.metaphor_fit, overall),
    no_text: num(dimensions.no_text, overall),
    craft: num(dimensions.craft, overall),
    brand_safe: num(dimensions.brand_safe, overall),
  };
  const passed = blockers.length === 0 && overall >= scoreThreshold;
  return {
    passed,
    scores,
    blockers,
    notes: str(parsed.notes),
    repairDirective: passed ? undefined : parseRepair(parsed.repair),
  };
}
