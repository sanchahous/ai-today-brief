import { createHash } from 'node:crypto';

export const DAILY_VISUAL_POLICY_ID = 'daily-editorial-visual-v1';
/** The owner-approved hard cap for every metered daily-visual provider call. */
export const DAILY_VISUAL_MONTHLY_CAP_MICRO_USD = 5_000_000;
export const DAILY_VISUAL_MAX_CALENDAR_DAYS_PER_MONTH = 31;

/**
 * Each external call reserves its whole declared ceiling before it starts.
 * The values deliberately leave room for a primary image, a repair image,
 * one director call and both vision stages for both images on every calendar
 * day of the longest month.
 */
export const DAILY_VISUAL_DIRECTION_MAX_COST_MICRO_USD = 10_000;
export const DAILY_VISUAL_PRIMARY_MAX_COST_MICRO_USD = 50_000;
export const DAILY_VISUAL_REPAIR_MAX_COST_MICRO_USD = 50_000;
export const DAILY_VISUAL_IMAGE_ONLY_QA_MAX_COST_MICRO_USD = 12_000;
export const DAILY_VISUAL_STORY_SEMANTIC_QA_MAX_COST_MICRO_USD = 12_000;
export const DAILY_VISUAL_MANUAL_HIGH_MAX_COST_MICRO_USD = 180_000;

export const DAILY_VISUAL_BUDGET_STEPS = [
  'direction',
  'ai_primary',
  'ai_repair',
  'qa_image_only',
  'qa_story_semantic',
  'manual_high',
] as const;

export type DailyVisualBudgetStep = (typeof DAILY_VISUAL_BUDGET_STEPS)[number];

const DAILY_VISUAL_BUDGET_STEP_MAX_COST_MICRO_USD = {
  direction: DAILY_VISUAL_DIRECTION_MAX_COST_MICRO_USD,
  ai_primary: DAILY_VISUAL_PRIMARY_MAX_COST_MICRO_USD,
  ai_repair: DAILY_VISUAL_REPAIR_MAX_COST_MICRO_USD,
  qa_image_only: DAILY_VISUAL_IMAGE_ONLY_QA_MAX_COST_MICRO_USD,
  qa_story_semantic: DAILY_VISUAL_STORY_SEMANTIC_QA_MAX_COST_MICRO_USD,
  // A future owner-directed high-quality render is still constrained by the
  // same monthly ledger. It is not part of automatic daily production.
  manual_high: DAILY_VISUAL_MANUAL_HIGH_MAX_COST_MICRO_USD,
} as const satisfies Record<DailyVisualBudgetStep, number>;

export function dailyVisualBudgetStepMaxCost(step: DailyVisualBudgetStep): number {
  return DAILY_VISUAL_BUDGET_STEP_MAX_COST_MICRO_USD[step];
}

/** Maximum automatic run: director + primary/repair + two QA stages each. */
export const DAILY_VISUAL_AUTOMATED_DAY_MAX_COST_MICRO_USD =
  DAILY_VISUAL_DIRECTION_MAX_COST_MICRO_USD +
  DAILY_VISUAL_PRIMARY_MAX_COST_MICRO_USD +
  DAILY_VISUAL_REPAIR_MAX_COST_MICRO_USD +
  2 *
    (DAILY_VISUAL_IMAGE_ONLY_QA_MAX_COST_MICRO_USD +
      DAILY_VISUAL_STORY_SEMANTIC_QA_MAX_COST_MICRO_USD);

export const DAILY_VISUAL_AUTOMATED_MONTH_MAX_COST_MICRO_USD =
  DAILY_VISUAL_AUTOMATED_DAY_MAX_COST_MICRO_USD * DAILY_VISUAL_MAX_CALENDAR_DAYS_PER_MONTH;

/**
 * A direction outage may leave the reviewable branded fallback as the only
 * candidate. An AAL2 owner gets exactly one bounded recovery attempt: it
 * creates a fresh direction, one primary image and both QA stages, but never
 * spends the optional repair slot. The first direction reservation is left
 * intact for reconciliation, so this amount must fit beside it inside the
 * normal $0.158 automatic-day ceiling.
 */
export const DAILY_VISUAL_DIRECTION_RETRY_ATTEMPT = 1;
export const DAILY_VISUAL_DIRECTION_RETRY_MAX_COST_MICRO_USD =
  DAILY_VISUAL_DIRECTION_MAX_COST_MICRO_USD +
  DAILY_VISUAL_PRIMARY_MAX_COST_MICRO_USD +
  DAILY_VISUAL_IMAGE_ONLY_QA_MAX_COST_MICRO_USD +
  DAILY_VISUAL_STORY_SEMANTIC_QA_MAX_COST_MICRO_USD;

export const DAILY_VISUAL_DIRECTION_RETRY_STEPS = [
  'direction',
  'ai_primary',
  'qa_image_only',
  'qa_story_semantic',
] as const satisfies readonly DailyVisualBudgetStep[];

export function isDailyVisualDirectionRetryMode(value: unknown): boolean {
  return value === 'direction_once';
}

export interface DailyVisualStory {
  id: string;
  rank: number;
  titleEn: string;
  titleUk: string;
  summaryEn: string;
  summaryUk: string;
  whyEn: string;
  whyUk: string;
}

export interface DailyVisualSnapshot {
  editorialDate: string;
  leadBriefId: string;
  canonicalSlug: string;
  titleEn: string;
  titleUk: string;
  introEn: string;
  introUk: string;
  stories: DailyVisualStory[];
}

export interface DailyVisualDirection {
  displayTitleEn: string;
  displayTitleUk: string;
  visualThesisEn: string;
  visualThesisUk: string;
  overlayStatEn: string | null;
  overlayStatUk: string | null;
  subject: string;
  action: string;
  setting: string;
  mechanism: string;
  consequence: string;
  scene: string;
}

// The daily director has a $0.010 call ceiling. Keep the frozen source
// context materially useful but bounded before it reaches a metered model:
// even a one-token-per-character language remains comfortably below the
// input allowance left after its 900-token response cap.
const DAILY_VISUAL_DIRECTION_TITLE_CONTEXT_MAX_CHARS = 600;
const DAILY_VISUAL_DIRECTION_INTRO_CONTEXT_MAX_CHARS = 1_600;
const DAILY_VISUAL_DIRECTION_STORY_TITLE_MAX_CHARS = 480;
const DAILY_VISUAL_DIRECTION_STORY_SUMMARY_MAX_CHARS = 1_200;
const DAILY_VISUAL_DIRECTION_STORY_WHY_MAX_CHARS = 1_200;

function nonEmptyString(value: unknown, maximum = 4_000): string | null {
  if (typeof value !== 'string') return null;
  const normalized = compact(value);
  return normalized && normalized.length <= maximum ? normalized : null;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function excerpt(value: string, maximum: number): string {
  const normalized = compact(value);
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function validShortTitle(value: unknown): value is string {
  return typeof value === 'string' && compact(value).length >= 8 && compact(value).length <= 96;
}

function validThesis(value: unknown): value is string {
  return typeof value === 'string' && compact(value).length >= 16 && compact(value).length <= 280;
}

function validScenePart(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && compact(value).length >= min && compact(value).length <= max;
}

function optionalStat(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = compact(value);
  return normalized && normalized.length <= 42 ? normalized : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Re-hydrate only the frozen, typed facts that were captured at the editorial
 * cutoff. Admin actions use this rather than reading mutable briefs again, so
 * a later correction cannot quietly change the visual or its social package.
 */
export function parseDailyVisualSnapshot(value: unknown): DailyVisualSnapshot | null {
  const snapshot = record(value);
  if (!snapshot || !Array.isArray(snapshot.stories)) return null;
  const editorialDate = nonEmptyString(snapshot.editorialDate, 10);
  const leadBriefId = nonEmptyString(snapshot.leadBriefId, 160);
  const canonicalSlug = nonEmptyString(snapshot.canonicalSlug, 220);
  const titleEn = nonEmptyString(snapshot.titleEn);
  const titleUk = nonEmptyString(snapshot.titleUk);
  const introEn = nonEmptyString(snapshot.introEn);
  const introUk = nonEmptyString(snapshot.introUk);
  if (
    !editorialDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(editorialDate) ||
    !leadBriefId ||
    !canonicalSlug ||
    !titleEn ||
    !titleUk ||
    !introEn ||
    !introUk
  ) {
    return null;
  }
  const stories: DailyVisualStory[] = [];
  for (const rawStory of snapshot.stories) {
    const story = record(rawStory);
    const rank = story?.rank;
    const id = nonEmptyString(story?.id, 160);
    const storyTitleEn = nonEmptyString(story?.titleEn);
    const storyTitleUk = nonEmptyString(story?.titleUk);
    const summaryEn = nonEmptyString(story?.summaryEn);
    const summaryUk = nonEmptyString(story?.summaryUk);
    const whyEn = nonEmptyString(story?.whyEn);
    const whyUk = nonEmptyString(story?.whyUk);
    if (
      !id ||
      !Number.isInteger(rank) ||
      typeof rank !== 'number' ||
      !storyTitleEn ||
      !storyTitleUk ||
      !summaryEn ||
      !summaryUk ||
      !whyEn ||
      !whyUk
    ) {
      return null;
    }
    stories.push({
      id,
      rank,
      titleEn: storyTitleEn,
      titleUk: storyTitleUk,
      summaryEn,
      summaryUk,
      whyEn,
      whyUk,
    });
  }
  if (stories.length === 0) return null;
  return {
    editorialDate,
    leadBriefId,
    canonicalSlug,
    titleEn,
    titleUk,
    introEn,
    introUk,
    stories,
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1]?.trim() ?? trimmed;
  const first = fenced.indexOf('{');
  const last = fenced.lastIndexOf('}');
  if (first === -1 || last <= first) return null;
  try {
    return record(JSON.parse(fenced.slice(first, last + 1)) as unknown);
  } catch {
    return null;
  }
}

function storiesForDirection(snapshot: DailyVisualSnapshot): string {
  return snapshot.stories
    .slice(0, 3)
    .map((story, index) => {
      const title = excerpt(
        story.titleEn || story.titleUk,
        DAILY_VISUAL_DIRECTION_STORY_TITLE_MAX_CHARS,
      );
      const summary = excerpt(
        story.summaryEn || story.summaryUk,
        DAILY_VISUAL_DIRECTION_STORY_SUMMARY_MAX_CHARS,
      );
      const why = excerpt(story.whyEn || story.whyUk, DAILY_VISUAL_DIRECTION_STORY_WHY_MAX_CHARS);
      return `${index + 1}. ${title}\nWhat changed: ${summary}\nWhy it matters: ${why}`;
    })
    .join('\n\n');
}

/**
 * The director chooses one explanatory claim for the day. It is deliberately
 * not invited to merge story props into a collage; the public title and model
 * scene have to tell the same causal story.
 */
export function buildDailyVisualDirectionInstruction(snapshot: DailyVisualSnapshot): string {
  return [
    'You are the editorial visual director for AI Today Brief.',
    'Find ONE main causal thesis that helps a developer understand today’s daily AI brief.',
    'Do not make a collage, a list of news props, a dashboard, a split screen, or a literal illustration of every story.',
    'Choose one dominant subject, one visible action, and one visible outcome in a connected physical or technically grounded scene.',
    'The image must still make sense with no caption. It may use an official product/UI reference only when it is factual evidence, but this generated image must contain no text, letters, labels, logos, fake UI, code, charts, robots, or humanoid mascots.',
    'Return exactly one JSON object. `displayTitleEn` and `displayTitleUk` are editorial adaptations, not translations; each is 8–96 characters and states the daily idea. `visualThesis*` explains what changed and why in one concise sentence. `overlayStat*` is null unless exactly one source-supported number is essential. `scene` is 35–100 English words and names only visible objects/actions.',
    '{"displayTitleEn":"","displayTitleUk":"","visualThesisEn":"","visualThesisUk":"","overlayStatEn":null,"overlayStatUk":null,"subject":"","action":"","setting":"","mechanism":"","consequence":"","scene":""}',
    '',
    `Editorial date: ${snapshot.editorialDate}`,
    `English edition title: ${excerpt(snapshot.titleEn, DAILY_VISUAL_DIRECTION_TITLE_CONTEXT_MAX_CHARS)}`,
    `Ukrainian edition title: ${excerpt(snapshot.titleUk, DAILY_VISUAL_DIRECTION_TITLE_CONTEXT_MAX_CHARS)}`,
    `English intro: ${excerpt(snapshot.introEn, DAILY_VISUAL_DIRECTION_INTRO_CONTEXT_MAX_CHARS)}`,
    `Ukrainian intro: ${excerpt(snapshot.introUk, DAILY_VISUAL_DIRECTION_INTRO_CONTEXT_MAX_CHARS)}`,
    'Approved stories:',
    storiesForDirection(snapshot) || '(No stories)',
  ].join('\n');
}

/** Strict parse: malformed director output never becomes an automatic visual. */
export function parseDailyVisualDirection(text: string): DailyVisualDirection | null {
  const value = extractJson(text);
  if (!value) return null;
  const required = [
    ['displayTitleEn', validShortTitle],
    ['displayTitleUk', validShortTitle],
    ['visualThesisEn', validThesis],
    ['visualThesisUk', validThesis],
    ['subject', (entry: unknown) => validScenePart(entry, 6, 180)],
    ['action', (entry: unknown) => validScenePart(entry, 6, 180)],
    ['setting', (entry: unknown) => validScenePart(entry, 6, 220)],
    ['mechanism', (entry: unknown) => validScenePart(entry, 10, 260)],
    ['consequence', (entry: unknown) => validScenePart(entry, 10, 260)],
    ['scene', (entry: unknown) => validScenePart(entry, 35, 700)],
  ] as const;
  if (required.some(([key, check]) => !check(value[key]))) return null;
  return {
    displayTitleEn: compact(value.displayTitleEn as string),
    displayTitleUk: compact(value.displayTitleUk as string),
    visualThesisEn: compact(value.visualThesisEn as string),
    visualThesisUk: compact(value.visualThesisUk as string),
    overlayStatEn: optionalStat(value.overlayStatEn),
    overlayStatUk: optionalStat(value.overlayStatUk),
    subject: compact(value.subject as string),
    action: compact(value.action as string),
    setting: compact(value.setting as string),
    mechanism: compact(value.mechanism as string),
    consequence: compact(value.consequence as string),
    scene: compact(value.scene as string),
  };
}

/** A transparent fallback direction: usable for owner review, never auto-selected. */
export function fallbackDailyVisualDirection(snapshot: DailyVisualSnapshot): DailyVisualDirection {
  const lead = snapshot.stories[0];
  const titleEn = compact(
    lead?.titleEn || lead?.titleUk || snapshot.titleEn || 'The daily AI shift',
  );
  const titleUk = compact(
    lead?.titleUk || lead?.titleEn || snapshot.titleUk || 'Головний зсув дня в AI',
  );
  return {
    displayTitleEn: titleEn.slice(0, 96),
    displayTitleUk: titleUk.slice(0, 96),
    visualThesisEn: compact(lead?.summaryEn || snapshot.introEn || titleEn).slice(0, 280),
    visualThesisUk: compact(lead?.summaryUk || snapshot.introUk || titleUk).slice(0, 280),
    overlayStatEn: null,
    overlayStatUk: null,
    subject: 'a single technical workbench with one clearly active pathway',
    action: 'one selected component sends a finished result through the pathway',
    setting: 'a calm, materially grounded engineering workspace at dusk',
    mechanism: 'a narrow active route is visibly separated from the inactive surrounding system',
    consequence:
      'the completed result reaches a practical destination while unused complexity remains quiet',
    scene:
      'A single compact technical workbench centers one tangible active pathway through a modular system. One selected component moves a finished result to a practical destination while the surrounding inactive structure stays visibly quiet; restrained editorial lighting, one connected scene, no words or interface panels.',
  };
}

export function buildDailyVisualImagePrompt(direction: DailyVisualDirection): string {
  return [
    `Editorial illustration for AI Today Brief. Policy ${DAILY_VISUAL_POLICY_ID}.`,
    `Daily thesis: ${direction.visualThesisEn}`,
    `Subject: ${direction.subject}.`,
    `Action: ${direction.action}.`,
    `Mechanism visibly causing the outcome: ${direction.mechanism}.`,
    `Outcome: ${direction.consequence}.`,
    `Setting: ${direction.setting}.`,
    `Scene: ${direction.scene}`,
    'Compose one coherent 16:9 editorial scene, not a collage. Keep all semantic evidence inside the central 78% width and 68% height so responsive contain framing preserves the whole story.',
    'One dominant subject, one visible action, one visible outcome. Use material, specific objects and a calm premium magazine treatment; leave quiet negative space only as atmosphere.',
    'Do not generate text, letters, numbers, labels, logos, watermarks, screen UI, code, dashboards, charts, split panels, comic panels, paper clutter, generic humanoid robots, robotic arms, glowing brains, floating data streams, generic server aisles, or a staged product reveal.',
    'No overlay text: deterministic social layout adds the display title separately.',
  ].join('\n');
}

export function buildDailyVisualRepairPrompt(
  direction: DailyVisualDirection,
  patches: readonly string[],
): string {
  const concretePatches = patches.map(compact).filter(Boolean).slice(0, 4);
  return [
    buildDailyVisualImagePrompt(direction),
    'Repair this same causal story; do not introduce a second scene or a new metaphor.',
    concretePatches.length
      ? `Required concrete corrections: ${concretePatches.join(' | ')}`
      : 'Required concrete correction: make the causal mechanism and practical outcome plainly visible.',
  ].join('\n');
}

function stableStories(stories: DailyVisualStory[]) {
  return [...stories]
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    .map((story) => ({
      id: story.id,
      rank: story.rank,
      titleEn: compact(story.titleEn),
      titleUk: compact(story.titleUk),
      summaryEn: compact(story.summaryEn),
      summaryUk: compact(story.summaryUk),
      whyEn: compact(story.whyEn),
      whyUk: compact(story.whyUk),
    }));
}

/** Stable source hash makes cron/manual retries agree on the exact same day. */
export function hashDailyVisualSnapshot(snapshot: DailyVisualSnapshot): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        editorialDate: snapshot.editorialDate,
        leadBriefId: snapshot.leadBriefId,
        canonicalSlug: snapshot.canonicalSlug,
        titleEn: compact(snapshot.titleEn),
        titleUk: compact(snapshot.titleUk),
        introEn: compact(snapshot.introEn),
        introUk: compact(snapshot.introUk),
        stories: stableStories(snapshot.stories),
      }),
    )
    .digest('hex');
}

export function dailyVisualAltText(direction: DailyVisualDirection, locale: 'en' | 'uk'): string {
  const title = locale === 'uk' ? direction.displayTitleUk : direction.displayTitleEn;
  const thesis = locale === 'uk' ? direction.visualThesisUk : direction.visualThesisEn;
  return compact(`${title}. ${thesis}`).slice(0, 240);
}
