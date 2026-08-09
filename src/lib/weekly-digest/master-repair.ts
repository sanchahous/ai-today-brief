/**
 * Turns a quality report into a list of *fragments to repair*, and splices
 * repaired fragments back into the bundle.
 *
 * The old loop had exactly one repair move: rewrite an entire article (and,
 * for an English fix, re-adapt the entire Ukrainian article from it) and
 * re-run the full critic. Two of those were allowed, after which the job
 * failed and half an hour of paid generation was thrown away. Worse, the move
 * was gated behind `reportIsRevisable`, so a single unmapped issue code, one
 * factual flag, or a lazy uniform critic verdict skipped repair entirely and
 * went straight to failure.
 *
 * A blocker is not a reason to abandon an edition. It names a field, usually
 * quotes the offending span, and often carries a suggested fix -- which is
 * everything needed to rewrite that one field in a call that costs a fraction
 * of a cent and returns in seconds. This module is the mapping from "what the
 * critic complained about" to "which fragment to send back to the model".
 *
 * Pure: no provider calls, no `server-only`. The engine (master-engine.ts)
 * owns the loop; this file owns the addressing.
 */

import type {
  WeeklyArticleMaster,
  WeeklyContentQualityReport,
  WeeklyLocale,
  WeeklyMasterBundle,
  WeeklyMasterStory,
  WeeklyQualityIssue,
} from './content-studio';
import {
  MASTER_FRAME_FIELDS,
  MASTER_STORY_FIELDS,
  type MasterFrameField,
  type MasterStoryField,
} from './master-segments';

export type RepairField = MasterStoryField | MasterFrameField;

export interface RepairTarget {
  locale: WeeklyLocale;
  /** null addresses an article-level (frame) field. */
  revisionItemId: string | null;
  field: RepairField;
}

export interface RepairTask {
  target: RepairTarget;
  issues: WeeklyQualityIssue[];
  /** 1 = must fix to pass the gate; 2 = quality improvement that rides along. */
  priority: 1 | 2;
}

export interface UnresolvedIssue {
  code: string;
  message: string;
  blocker: boolean;
  locale?: WeeklyLocale;
  revisionItemId?: string;
  field?: string;
  /** Why the loop stopped working on it -- shown to the owner, never silently dropped. */
  reason: 'unmappable' | 'attempts_exhausted' | 'repair_failed' | 'deadline' | 'rounds_exhausted';
}

/** Fields whose value is a list of strings rather than prose. */
const LIST_FIELDS = new Set<RepairField>(['claimIds', 'keyTakeaways', 'topics', 'entities']);

const STORY_FIELD_SET = new Set<string>(MASTER_STORY_FIELDS);
const FRAME_FIELD_SET = new Set<string>(MASTER_FRAME_FIELDS);

/**
 * `internalLinks` is an object array with its own shape contract and no
 * quality check that ever targets it; keeping it out of the repairable set
 * means a repair response can always be validated as text or a string list.
 */
export function isRepairableField(field: string): field is RepairField {
  return field !== 'internalLinks' && (STORY_FIELD_SET.has(field) || FRAME_FIELD_SET.has(field));
}

export function isListRepairField(field: RepairField): boolean {
  return LIST_FIELDS.has(field);
}

export function repairTargetKey(target: RepairTarget): string {
  return `${target.locale}:${target.revisionItemId ?? 'frame'}:${target.field}`;
}

export function describeRepairTarget(target: RepairTarget): string {
  return target.revisionItemId
    ? `${target.locale.toUpperCase()} story ${target.revisionItemId.slice(0, 8)} · ${target.field}`
    : `${target.locale.toUpperCase()} frame · ${target.field}`;
}

function storyOf(
  article: WeeklyArticleMaster,
  revisionItemId: string,
): WeeklyMasterStory | undefined {
  return article.stories.find((story) => story.revisionItemId === revisionItemId);
}

export function readRepairValue(
  bundle: WeeklyMasterBundle,
  target: RepairTarget,
): string | string[] | null {
  const article = bundle[target.locale];
  const source = target.revisionItemId ? storyOf(article, target.revisionItemId) : article;
  if (!source) return null;
  const value = (source as unknown as Record<string, unknown>)[target.field];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value as string[];
  }
  return null;
}

/** Immutable splice: returns a new bundle with exactly one field replaced. */
export function applyRepairValue(
  bundle: WeeklyMasterBundle,
  target: RepairTarget,
  value: string | string[],
): WeeklyMasterBundle {
  const article = bundle[target.locale];
  const next: WeeklyArticleMaster = target.revisionItemId
    ? {
        ...article,
        stories: article.stories.map((story) =>
          story.revisionItemId === target.revisionItemId
            ? ({ ...story, [target.field]: value } as WeeklyMasterStory)
            : story,
        ),
      }
    : ({ ...article, [target.field]: value } as WeeklyArticleMaster);
  return { ...bundle, [target.locale]: next };
}

const SPAN_MIN_CHARS = 12;

/**
 * Finds which field contains a verbatim span. The critic rubric requires any
 * dimension scored below 80 to quote the offending text rather than paraphrase
 * it, so a low dimension score usually carries its own address -- this turns
 * that quote into a precise target instead of a whole-article rewrite.
 */
export function locateSpan(bundle: WeeklyMasterBundle, span: string): RepairTarget | null {
  const needle = span.trim();
  if (needle.length < SPAN_MIN_CHARS) return null;
  for (const locale of ['en', 'uk'] as const) {
    const article = bundle[locale];
    for (const field of MASTER_FRAME_FIELDS) {
      if (!isRepairableField(field)) continue;
      const value = article[field];
      if (typeof value === 'string' && value.includes(needle)) {
        return { locale, revisionItemId: null, field };
      }
      if (Array.isArray(value) && value.some((entry) => String(entry).includes(needle))) {
        return { locale, revisionItemId: null, field };
      }
    }
    for (const story of article.stories) {
      for (const field of MASTER_STORY_FIELDS) {
        const value = story[field];
        if (typeof value === 'string' && value.includes(needle)) {
          return { locale, revisionItemId: story.revisionItemId, field };
        }
      }
    }
  }
  return null;
}

/** Longest quoted or dash-delimited fragment in a free-text note/flag. */
export function spanCandidatesFrom(text: string): string[] {
  const quoted = [...text.matchAll(/[«"“”']([^«»"“”']{12,240})[»"“”']/gu)].map((match) => match[1]!);
  return quoted
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length >= SPAN_MIN_CHARS)
    .sort((left, right) => right.length - left.length);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * Default fields to work on when an issue names no field and quotes no
 * locatable span. Chosen per dimension from what that dimension actually
 * scores (see CRITIC_RUBRIC in editorial-llm.ts): `usefulness` grades the
 * `practical` field, `engagement` grades openings, and so on. Deliberately
 * narrow -- a broad fallback would rewrite the whole edition for one vague
 * complaint, which is the behavior this refactor exists to remove.
 */
const DIMENSION_FALLBACK_FIELDS: Record<string, MasterStoryField[]> = {
  engagement: ['hook', 'body'],
  voice: ['body'],
  clarity: ['body'],
  trust: ['body'],
  usefulness: ['practical'],
  naturalness: ['body'],
  parity: ['body'],
};

const DIMENSION_LOCALE: Record<string, WeeklyLocale | null> = {
  naturalness: 'uk',
  parity: 'uk',
};

interface PlanContext {
  /** Stories the fallback paths are allowed to touch, highest value first. */
  featureIds: string[];
  maxFallbackStories: number;
}

function fallbackTargetsForDimension(
  bundle: WeeklyMasterBundle,
  dimension: string,
  context: PlanContext,
): RepairTarget[] {
  const fields = DIMENSION_FALLBACK_FIELDS[dimension] ?? ['body'];
  const locales: WeeklyLocale[] = DIMENSION_LOCALE[dimension]
    ? [DIMENSION_LOCALE[dimension]!]
    : ['en'];
  const storyIds = context.featureIds.slice(0, context.maxFallbackStories);
  return locales.flatMap((locale) =>
    storyIds.flatMap((revisionItemId) =>
      fields
        .filter((field) => readRepairValue(bundle, { locale, revisionItemId, field }) !== null)
        .map((field): RepairTarget => ({ locale, revisionItemId, field })),
    ),
  );
}

/**
 * `article_length` is the one issue whose fix is inherently spread across
 * several fields. Target the bodies that are themselves out of range first;
 * if every body is individually fine, the overall miss is distributed, so
 * take the longest (too long) or shortest (too short) bodies instead.
 */
function articleLengthTargets(
  bundle: WeeklyMasterBundle,
  locale: WeeklyLocale,
  message: string,
  context: PlanContext,
): RepairTarget[] {
  const tooLong = /is\s+([\d,]+)\s+words/.exec(message.replace(/ /g, ' '));
  const actual = tooLong ? Number(tooLong[1]!.replace(/,/g, '')) : null;
  const overLength = actual === null ? true : actual > 3_000;
  const stories = bundle[locale].stories.map((story) => ({
    revisionItemId: story.revisionItemId,
    words: wordCount(story.body),
    placement: story.placement,
  }));
  const outOfRange = stories.filter(({ words, placement }) => {
    const [min, max] = placement === 'feature' ? [400, 650] : [80, 140];
    return words < min || words > max;
  });
  const chosen = (outOfRange.length ? outOfRange : [...stories])
    .sort((left, right) => (overLength ? right.words - left.words : left.words - right.words))
    .slice(0, context.maxFallbackStories);
  return chosen.map(({ revisionItemId }) => ({ locale, revisionItemId, field: 'body' as const }));
}

function targetsForIssue(
  bundle: WeeklyMasterBundle,
  issue: WeeklyQualityIssue,
  context: PlanContext,
): RepairTarget[] {
  const locale = issue.locale;

  // 1. Fully addressed by the issue itself -- the common case for every
  //    deterministic check and for a well-formed critic issue.
  if (locale && issue.field && isRepairableField(issue.field)) {
    const target: RepairTarget = {
      locale,
      revisionItemId: issue.revisionItemId ?? null,
      field: issue.field,
    };
    if (readRepairValue(bundle, target) !== null) return [target];
  }

  // 2. Quoted span, no usable field.
  const spans = [
    ...(issue.span ? [issue.span] : []),
    ...spanCandidatesFrom(`${issue.message} ${issue.suggestedFix ?? ''}`),
  ];
  for (const span of spans) {
    const located = locateSpan(bundle, span);
    if (located && (!locale || located.locale === locale)) return [located];
  }

  // 3. Code-specific fallbacks for the issues that name no single field.
  if (issue.code === 'article_length' && locale) {
    return articleLengthTargets(bundle, locale, issue.message, context);
  }
  if (issue.code === 'duplicate_editorial_fields' && locale && issue.revisionItemId) {
    return (['practical', 'takeaway'] as const).map((field) => ({
      locale,
      revisionItemId: issue.revisionItemId!,
      field,
    }));
  }
  if (issue.code.startsWith('dimension_low_score:')) {
    return fallbackTargetsForDimension(bundle, issue.code.split(':')[1] ?? '', context);
  }
  if (issue.code.startsWith('template_leak:') && locale) {
    return issue.revisionItemId
      ? [{ locale, revisionItemId: issue.revisionItemId, field: 'body' }]
      : fallbackTargetsForDimension(bundle, 'voice', context).filter(
          (target) => target.locale === locale,
        );
  }
  return [];
}

export interface RepairPlan {
  tasks: RepairTask[];
  /** Issues no target could be derived for -- surfaced, never dropped. */
  unmapped: UnresolvedIssue[];
}

/**
 * Groups a report's issues by the fragment that has to change.
 *
 * Every issue ends up either in a task or in `unmapped`; nothing is silently
 * discarded, because an issue the loop cannot address is exactly what the
 * owner needs to see on the review card.
 */
export function planRepairTasks(
  bundle: WeeklyMasterBundle,
  report: Pick<WeeklyContentQualityReport, 'issues' | 'factualFlags'>,
  options: {
    featureIds: string[];
    /** Targets already tried too many times -- excluded so a round can't spin. */
    exhaustedTargetKeys?: ReadonlySet<string>;
    maxFallbackStories?: number;
    includeNonBlocking?: boolean;
  },
): RepairPlan {
  const context: PlanContext = {
    featureIds: options.featureIds,
    maxFallbackStories: options.maxFallbackStories ?? 3,
  };
  const exhausted = options.exhaustedTargetKeys ?? new Set<string>();
  const byTarget = new Map<string, RepairTask>();
  const unmapped: UnresolvedIssue[] = [];

  const factualIssues: WeeklyQualityIssue[] = report.factualFlags.map((flag) => ({
    // Grounding problems used to disqualify repair entirely (reportIsRevisable
    // returned false on any factual flag), which meant the single most
    // fixable class of defect -- a sentence asserting more than the evidence
    // supports -- always cost a full regenerate. A field rewrite that is
    // handed the story's claims and excerpts is precisely the right fix.
    code: 'factual_flag',
    message: flag,
    blocker: true,
  }));

  const candidates = [...report.issues, ...factualIssues].filter(
    (issue) => issue.blocker || options.includeNonBlocking !== false,
  );

  for (const issue of candidates) {
    const allTargets = targetsForIssue(bundle, issue, context);
    const targets = allTargets.filter((target) => !exhausted.has(repairTargetKey(target)));
    if (!targets.length) {
      unmapped.push({
        code: issue.code,
        message: issue.message,
        blocker: issue.blocker,
        ...(issue.locale ? { locale: issue.locale } : {}),
        ...(issue.revisionItemId ? { revisionItemId: issue.revisionItemId } : {}),
        ...(issue.field ? { field: issue.field } : {}),
        reason: allTargets.length ? 'attempts_exhausted' : 'unmappable',
      });
      continue;
    }
    for (const target of targets) {
      const key = repairTargetKey(target);
      const existing = byTarget.get(key);
      if (existing) {
        existing.issues.push(issue);
        if (issue.blocker) existing.priority = 1;
        continue;
      }
      byTarget.set(key, { target, issues: [issue], priority: issue.blocker ? 1 : 2 });
    }
  }

  const tasks = [...byTarget.values()].sort((left, right) => left.priority - right.priority);
  return { tasks, unmapped };
}

/**
 * The Ukrainian counterpart of a repaired English field. English repairs land
 * first (Ukrainian is an adaptation of English, not an independent draft), so
 * every English fix schedules a matching Ukrainian re-adaptation of that one
 * field -- which is what keeps the locales in parity without re-adapting the
 * entire Ukrainian article, the move that used to turn a one-field English fix
 * into a second full-length paid call.
 */
export function ukrainianCounterpart(target: RepairTarget): RepairTarget | null {
  if (target.locale !== 'en') return null;
  return PARITY_BEARING_FIELDS.has(target.field) ? { ...target, locale: 'uk' } : null;
}

/**
 * Fields where an English change makes the Ukrainian copy factually stale.
 *
 * Deliberately excludes `claimIds` (copied structurally, never re-adapted),
 * the four framing/metadata fields (each locale has its own character budget
 * and its own natural phrasing, and neither carries facts the other must
 * match) and the `topics`/`entities` label lists.
 */
const PARITY_BEARING_FIELDS = new Set<RepairField>([
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
  'title',
  'standfirst',
  'theme',
  'intro',
  'editorNote',
  'conclusion',
  'keyTakeaways',
]);
