/**
 * Segmentation of the weekly master into independently generated,
 * independently checkpointed units.
 *
 * The old master was two enormous LLM calls: one ~20k-token English package
 * and one ~20k-token Ukrainian package. Anything that went wrong at minute 12
 * -- a timeout, one stray quote in the opening brace, one failed quality
 * dimension -- threw away the whole locale and cost another half hour. There
 * was no smaller unit to retry, so every problem escalated to "run it all
 * again".
 *
 * A segment is that smaller unit: one story, or the article frame (every
 * article-level field). Each is written by its own short call, validated on
 * its own, persisted on its own, and retried or repaired on its own. A run
 * that dies after nine of sixteen segments resumes at the tenth.
 *
 * Deliberately pure (no `server-only`, no provider imports) so the plan and
 * the assembly are unit-testable without touching a model.
 */

import type {
  WeeklyArticleMaster,
  WeeklyLocale,
  WeeklyMasterStory,
  WeeklyPlacement,
} from './content-studio';

/** Every article-level field: what the `frame` segment produces. */
export type MasterFrame = Omit<WeeklyArticleMaster, 'locale' | 'stories'>;

export const MASTER_FRAME_FIELDS = [
  'title',
  'seoTitle',
  'metaDescription',
  'ogTitle',
  'ogDescription',
  'standfirst',
  'theme',
  'intro',
  'editorNote',
  'keyTakeaways',
  'topics',
  'entities',
  'internalLinks',
  'conclusion',
] as const satisfies readonly (keyof MasterFrame)[];

export const MASTER_STORY_FIELDS = [
  'headline',
  'summary',
  'hook',
  'body',
  'why',
  'practical',
  'limitation',
  'takeaway',
  'editorsView',
  'discussionQuestion',
  'claimIds',
] as const satisfies readonly (keyof WeeklyMasterStory)[];

export type MasterFrameField = (typeof MASTER_FRAME_FIELDS)[number];
export type MasterStoryField = (typeof MASTER_STORY_FIELDS)[number];

export type MasterSegment =
  | {
      kind: 'story';
      locale: WeeklyLocale;
      revisionItemId: string;
      placement: WeeklyPlacement;
      rank: number;
    }
  | { kind: 'frame'; locale: WeeklyLocale };

export interface MasterSegmentStoryInput {
  revisionItemId: string;
  placement: WeeklyPlacement;
  rank: number;
}

/**
 * Stable, content-addressable key for one segment. Used as the map key in the
 * durable run state, so it must stay identical across resumes of the same
 * plan -- never fold anything mutable (attempt counts, timestamps) into it.
 */
export function masterSegmentKey(segment: MasterSegment): string {
  return segment.kind === 'frame'
    ? `${segment.locale}:frame`
    : `${segment.locale}:story:${segment.revisionItemId}`;
}

/** Human-readable label for the job timeline and log lines. */
export function masterSegmentLabel(segment: MasterSegment): string {
  const locale = segment.locale.toUpperCase();
  return segment.kind === 'frame'
    ? `${locale} edition frame`
    : `${locale} ${segment.placement} story #${segment.rank}`;
}

/**
 * Ordered plan: every English story, then the English frame, then the same
 * for Ukrainian.
 *
 * The frame comes last on purpose. The old single-call writer had to commit
 * to an edition theme before it had written a single story, which is the
 * documented root of the forced-umbrella defect (an abstract "The Agentic
 * Shift" title stapled onto three unrelated developments -- see the
 * 2026-08-09 audit). Writing the frame after the stories means the throughline
 * is derived from what the edition actually says.
 *
 * Ukrainian follows English entirely, because each Ukrainian segment adapts
 * its English counterpart.
 */
export function masterSegmentPlan(stories: MasterSegmentStoryInput[]): MasterSegment[] {
  const ordered = [...stories].sort((left, right) => left.rank - right.rank);
  const forLocale = (locale: WeeklyLocale): MasterSegment[] => [
    ...ordered.map(
      (story): MasterSegment => ({
        kind: 'story',
        locale,
        revisionItemId: story.revisionItemId,
        placement: story.placement,
        rank: story.rank,
      }),
    ),
    { kind: 'frame', locale },
  ];
  return [...forLocale('en'), ...forLocale('uk')];
}

/**
 * Rebuilds a full article from its segments, in the plan's story order.
 *
 * Story order and identity come from `order` (derived from the approved
 * revision items), never from the model's output -- `story_set_mismatch` and
 * `placement_mismatch` simply cannot happen when the assembler owns the list.
 */
export function assembleArticle(
  locale: WeeklyLocale,
  frame: MasterFrame,
  storiesByRevisionItemId: Map<string, WeeklyMasterStory>,
  order: MasterSegmentStoryInput[],
): WeeklyArticleMaster {
  const stories = [...order]
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => {
      const story = storiesByRevisionItemId.get(entry.revisionItemId);
      if (!story) throw new Error(`Missing ${locale} story segment for ${entry.revisionItemId}.`);
      // placement is structural, not editorial: take it from the approved
      // revision item rather than trusting whatever the writer echoed back.
      return { ...story, revisionItemId: entry.revisionItemId, placement: entry.placement };
    });
  return { locale, ...frame, stories };
}

export function frameFromArticle(article: WeeklyArticleMaster): MasterFrame {
  const { locale: _locale, stories: _stories, ...frame } = article;
  return frame;
}

/**
 * Word budget for one story body, by placement. The deterministic
 * `story_length` check in content-studio.ts uses the same numbers; sending
 * them into each story's own prompt is what makes a per-story call able to
 * hit them, where one 2,500-word blob could not.
 *
 * The upper bound is deliberately tighter than the check's own 650/140: the
 * `article_length` gate (2,000–3,000 words across the whole edition) is what
 * a per-story writer can most easily blow through, since no single call can
 * see the running total. Aiming each body low inside its legal range leaves
 * the edition room to land inside the article budget below.
 */
export function storyBodyWordTarget(placement: WeeklyPlacement): { min: number; max: number } {
  return placement === 'feature' ? { min: 400, max: 520 } : { min: 80, max: 120 };
}

/**
 * Word allowance for a story's supporting fields (hook/why/practical/
 * limitation/takeaway), which `article_length` counts but `story_length`
 * does not. Without an explicit cap these quietly doubled a feature story's
 * contribution and pushed editions past 3,000 words -- the single most
 * frequent non-blocking gate miss.
 */
export function storySupportWordCap(placement: WeeklyPlacement): number {
  return placement === 'feature' ? 150 : 70;
}

export interface MasterFrameWordTargets {
  standfirst: number;
  intro: number;
  editorNote: number;
  conclusion: number;
}

export const MASTER_FRAME_WORD_TARGETS: MasterFrameWordTargets = {
  standfirst: 30,
  intro: 150,
  editorNote: 50,
  conclusion: 120,
};

/**
 * Projected edition word count if every segment writes to the middle of its
 * budget. Exists so the numbers above stay demonstrably inside the 2,000–3,000
 * `article_length` gate as the story mix changes (three features plus three or
 * four radar items) rather than being three independent guesses that happen to
 * agree today -- see the accompanying test.
 */
export function projectedArticleWords(stories: MasterSegmentStoryInput[]): number {
  const frame = Object.values(MASTER_FRAME_WORD_TARGETS).reduce((sum, value) => sum + value, 0);
  return stories.reduce((sum, story) => {
    const placement: WeeklyPlacement = story.rank <= 3 ? 'feature' : 'radar';
    const body = storyBodyWordTarget(placement);
    return sum + (body.min + body.max) / 2 + storySupportWordCap(placement) * 0.75;
  }, frame);
}
