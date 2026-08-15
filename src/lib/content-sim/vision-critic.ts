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
  'missing_context',
  'missing_mechanism',
  'missing_consequence',
  'ambiguous_visual_story',
  'melted_motion',
  'brand_unsafe',
  'low_quality',
  'wrong_subject',
  'impossible_orientation',
  'prop_use_mismatch',
  'decorative_second_beat',
  'sibling_echo',
  'opaque_abstraction',
  'semantic_evidence_missing',
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
  summary?: string;
  why?: string;
  practical?: string;
  limitation?: string;
  takeaway?: string;
  claimsExcerpt?: string;
  editorialAngle?: string;
  storyContext?: string;
  meaning?: string;
  essence?: string;
  mechanism?: string;
  consequence?: string;
  visualThesis?: string;
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
  const semanticStory =
    input.policyId?.startsWith('weekly-') === true ||
    Boolean(input.storyContext || input.meaning || input.consequence || input.visualThesis);
  const siblingBlock = input.siblingScenes?.length
    ? [
        'Sibling scenes already used in this digest (flag sibling_echo if this image rhymes with them):',
        ...input.siblingScenes.slice(0, 6).map((s, i) => `  ${i + 1}. ${s.slice(0, 160)}`),
      ].join('\n')
    : '';
  return [
    'You are the art director QA for AI Today Brief.',
    `Policy: ${input.policyId ?? 'weekly-semantic-story-v5.1'} (no readable text, no UI chrome, no comic panels/collage).`,
    semanticStory
      ? `Score overall 0–100. Pass only if overall >= ${threshold}, news_legibility >= ${newsFloor}, context_fidelity >= ${newsFloor}, mechanism_legibility >= ${newsFloor}, consequence_legibility >= ${newsFloor}, instant_comprehension >= ${newsFloor}, AND no blocking issues.`
      : `Score overall 0–100. Pass only if overall >= ${threshold}, news_legibility >= ${newsFloor}, AND no blocking issues.`,
    'Blocking codes (use exactly): readable_text | ui_chrome | collage_panels | banned_cliche | off_metaphor | off_news | missing_context | missing_mechanism | missing_consequence | ambiguous_visual_story | melted_motion | brand_unsafe | low_quality | wrong_subject | impossible_orientation | prop_use_mismatch | decorative_second_beat | sibling_echo | opaque_abstraction | semantic_evidence_missing.',
    'banned_cliche includes: terminal/IDE screens, paper-heap sludge, generic desk without a conceptual prop.',
    'opaque_abstraction includes generic pneumatic tubes, canisters, switchboards, patch cables, pipework, or glowing data streams used merely to mean software/data flow when those objects are not literal news context.',
    'Editorial fidelity (news first):',
    '- Treat SOURCE STORY below as truth. Treat the generated semantic contract and scene brief as hypotheses to verify against it.',
    '- missing_context: the image lacks a specific anchor for who/what changed in THIS story.',
    '- missing_mechanism: the causal process is absent, decorative, or only explained in the prompt rather than visible.',
    '- missing_consequence: no grounded benefit, harm, trade-off, or uncertainty is visibly caused by the mechanism.',
    '- ambiguous_visual_story: anchor, cause, and result exist as props but their relationship is not instantly readable.',
    '- off_news: the image could illustrate almost any tech story, or argues a different claim than the source story.',
    '- opaque_abstraction: the pixels show polished machinery/data flow but give a human reader no way to identify this story.',
    '- melted_motion: smeared shuttles, melted limbs, motion-lag blobs, streaking blur that destroys silhouette readability.',
    semanticStory
      ? 'Ask yourself, in order: What changed? How? So what? Could a developer infer all three in under three seconds without seeing the prompt?'
      : 'Ask yourself: would a developer connect this image to the named story rather than generic technology?',
    'BLIND PIXEL TEST: first ignore the scene brief and infer the news only from visible pixels. Then compare with SOURCE STORY. Do not award any semantic dimension above 74 when the connection depends on prompt knowledge rather than visible evidence.',
    'HEADLINE SUBSTITUTION TEST: if the same pixels could fit two unrelated AI headlines, flag off_news or opaque_abstraction even when craft is excellent.',
    'Physics / craft checks:',
    '- impossible_orientation: readable surfaces (books, journals, screens, signs) upside-down or rotated vs how a human would use them.',
    '- prop_use_mismatch: grip, posture, or object use that a human would not do this way.',
    '- decorative_second_beat: second half of a dual/contrast frame that does not argue the essence (ballerinas, props that are mood-only).',
    '- sibling_echo: composition/subject rhymes with a sibling scene listed below.',
    '',
    'SOURCE STORY (authority):',
    `Headline: ${input.headline}`,
    input.summary ? `Summary: ${input.summary}` : '',
    input.why ? `Why it matters: ${input.why}` : '',
    input.practical ? `Practical benefit/use: ${input.practical}` : '',
    input.limitation ? `Limitation/counterweight: ${input.limitation}` : '',
    input.takeaway ? `Takeaway: ${input.takeaway}` : '',
    input.claimsExcerpt ? `Approved claims: ${input.claimsExcerpt}` : '',
    input.editorialAngle ? `Binding editorial angle: ${input.editorialAngle}` : '',
    'GENERATED SEMANTIC CONTRACT (must remain faithful to source):',
    input.storyContext ? `Context: ${input.storyContext}` : '',
    input.meaning ? `Meaning: ${input.meaning}` : '',
    input.essence ? `Essence: ${input.essence}` : '',
    input.mechanism ? `Mechanism that must be visible: ${input.mechanism}` : '',
    input.consequence ? `Consequence that must be visible: ${input.consequence}` : '',
    input.visualThesis ? `Visual thesis: ${input.visualThesis}` : '',
    input.readerTest ? `Reader test: ${input.readerTest}` : '',
    input.metaphorTitle ? `Metaphor: ${input.metaphorTitle}` : '',
    input.whyItFits ? `Why it fits: ${input.whyItFits}` : '',
    input.scene ? `Scene brief: ${input.scene.slice(0, 800)}` : '',
    siblingBlock,
    '',
    'Inspect the attached image. Reply with ONLY JSON:',
    '{',
    '  "overall": number,',
    '  "dimensions": { "metaphor_fit": number, "no_text": number, "craft": number, "brand_safe": number, "news_legibility": number, "context_fidelity": number, "mechanism_legibility": number, "consequence_legibility": number, "instant_comprehension": number },',
    '  "blockers": [{ "code": string, "message": string, "region": string }],',
    '  "pixel_evidence": { "context": "visible evidence only", "mechanism": "visible evidence only", "consequence": "visible evidence only", "headline_pairing": "why these pixels identify this story" },',
    '  "notes": string,',
    '  "repair": {',
    '    "prompt_patches": ["concrete depictable changes for the next image render, never abstract critique"],',
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

/** Pixel-only QA: no headline, scene brief, or intended prompt (illustration plan E2 / M2). */
export function buildImageOnlyCriticPrompt(): string {
  return [
    'You are checking an uploaded editorial illustration for pixel defects only.',
    'Do not infer a news story. Do not assume a prompt, headline, scene brief, or labels.',
    'Judge only what is visible in the attached image.',
    'Blocking codes (use exactly): readable_text | ui_chrome | collage_panels | banned_cliche | melted_motion | brand_unsafe | low_quality | impossible_orientation | prop_use_mismatch.',
    'readable_text: letters, logos, watermarks, captions, UI chrome, or any writing baked into the pixels.',
    'banned_cliche: terminal/IDE screens, collage, glowing brain, generic paper-heap sludge.',
    'Count distinct readable-text regions in blockers (one blocker per region).',
    'Do not score context, mechanism, consequence, or headline pairing — those axes are not applicable.',
    '',
    'Inspect the attached image. Reply with ONLY JSON:',
    '{',
    '  "overall": number,',
    '  "dimensions": { "no_text": number, "craft": number, "brand_safe": number, "news_legibility": number },',
    '  "blockers": [{ "code": string, "message": string, "region": string }],',
    '  "notes": string',
    '}',
  ].join('\n');
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
  options: { requireStorySemantics?: boolean; requirePixelEvidence?: boolean } = {},
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
  const semanticFallback = options.requireStorySemantics ? 0 : rawOverall;
  const contextFidelity = num(dimensions.context_fidelity, semanticFallback);
  const mechanismLegibility = num(dimensions.mechanism_legibility, semanticFallback);
  const consequenceLegibility = num(dimensions.consequence_legibility, semanticFallback);
  const instantComprehension = num(dimensions.instant_comprehension, semanticFallback);
  const semanticMin = Math.min(
    contextFidelity,
    mechanismLegibility,
    consequenceLegibility,
    instantComprehension,
  );
  const newsClamped = clampOverallByNewsLegibility(rawOverall, newsLegibility);
  const overall = options.requireStorySemantics
    ? Math.min(newsClamped, semanticMin + 5)
    : newsClamped;
  const blockers = parseBlockers(parsed.blockers);
  if (options.requirePixelEvidence) {
    const evidence = asRecord(parsed.pixel_evidence);
    const missingEvidence = ['context', 'mechanism', 'consequence', 'headline_pairing'].filter(
      (key) => !str(evidence[key]),
    );
    if (missingEvidence.length > 0) {
      blockers.push({
        code: 'semantic_evidence_missing',
        message: `Vision scores lack visible-pixel evidence for: ${missingEvidence.join(', ')}.`,
        blocker: true,
      });
    }
  }
  const scores = {
    overall,
    metaphor_fit: num(dimensions.metaphor_fit, overall),
    no_text: num(dimensions.no_text, overall),
    craft: num(dimensions.craft, overall),
    brand_safe: num(dimensions.brand_safe, overall),
    news_legibility: newsLegibility,
    context_fidelity: contextFidelity,
    mechanism_legibility: mechanismLegibility,
    consequence_legibility: consequenceLegibility,
    instant_comprehension: instantComprehension,
    semantic_min: semanticMin,
  };
  const newsFloor = newsLegibilityThreshold(scoreThreshold);
  const hasOffNews = blockers.some((b) => b.code === 'off_news');
  const semanticPass =
    !options.requireStorySemantics ||
    (contextFidelity >= newsFloor &&
      mechanismLegibility >= newsFloor &&
      consequenceLegibility >= newsFloor &&
      instantComprehension >= newsFloor);
  const passed =
    blockers.length === 0 &&
    !hasOffNews &&
    overall >= scoreThreshold &&
    newsLegibility >= newsFloor &&
    semanticPass;
  return {
    passed,
    scores,
    blockers,
    notes: str(parsed.notes),
    repairDirective: passed ? undefined : parseRepair(parsed.repair),
  };
}
