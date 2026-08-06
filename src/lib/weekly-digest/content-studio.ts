import { createHash } from 'node:crypto';
import { bannedPhrasesFor } from './editorial-voice';

export const WEEKLY_CONTENT_STUDIO_VERSION = 'weekly-content-studio-v2.1';
export const WEEKLY_MASTER_SPEC_VERSION = 'weekly-master-v6';
export const WEEKLY_VIDEO_MANIFEST_VERSION = 'weekly-video-v2';
/** Primary-source excerpt stored on research packs and fed to writer/critic. */
export const WEEKLY_RESEARCH_EXCERPT_MAX_CHARS = 12_000;
export const WEEKLY_RESEARCH_SCHEMA_VERSION = 'weekly-research-v3' as const;

export type WeeklyContentStudioMode = 'off' | 'shadow' | 'production';

export function resolveWeeklyContentStudioMode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'shadow') return 'shadow';
  if (['1', 'true', 'on', 'production'].includes(normalized ?? '')) return 'production';
  return 'off';
}

export type WeeklyPlacement = 'feature' | 'radar';
export type WeeklyLocale = 'en' | 'uk';

export interface ResearchEvidence {
  url: string;
  sourceName: string;
  domain: string;
  primary: boolean;
  extractedText: string;
  ogImage: string | null;
}

export interface ResearchClaim {
  id: string;
  text: string;
  kind: 'fact' | 'number' | 'named_claim' | 'context';
  evidenceUrls: string[];
}

export interface WeeklyResearchPack {
  schemaVersion: typeof WEEKLY_RESEARCH_SCHEMA_VERSION | 'weekly-research-v2';
  digestId: string;
  revisionId: string;
  revisionItemId: string;
  placement: WeeklyPlacement;
  primarySource: ResearchEvidence;
  corroboratingSources: ResearchEvidence[];
  claims: ResearchClaim[];
  context: string[];
  contradictions: string[];
  limitations: string[];
  risks: string[];
  researchedAt: string;
}

export interface WeeklyMasterStory {
  revisionItemId: string;
  placement: WeeklyPlacement;
  headline: string;
  summary: string;
  hook: string;
  body: string;
  why: string;
  practical: string;
  limitation: string;
  takeaway: string;
  claimIds: string[];
  /**
   * Editor's-view speculation block, required for feature stories only (see
   * SPECULATION_SPEC_* in editorial-voice.ts). Empty string for radar items.
   */
  editorsView: string;
  /** Closing discussion question, required for feature stories only. */
  discussionQuestion: string;
}

export interface WeeklyArticleMaster {
  locale: WeeklyLocale;
  title: string;
  seoTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  standfirst: string;
  theme: string;
  intro: string;
  editorNote: string;
  keyTakeaways: string[];
  topics: string[];
  entities: string[];
  internalLinks: Array<{ anchor: string; query: string }>;
  conclusion: string;
  stories: WeeklyMasterStory[];
}

export interface WeeklyNarrationPlan {
  title: string;
  hook: string;
  narration: string;
  scenes: Array<{
    id: string;
    purpose: string;
    voiceover: string;
    onScreenText: string;
    visualBrief: string;
    factIds: string[];
    durationSeconds: number;
  }>;
  shorts: Array<{
    revisionItemId: string;
    locale: 'uk';
    hook: string;
    context: string;
    insight: string;
    takeaway: string;
    factIds: string[];
    durationSeconds: number;
  }>;
}

export interface WeeklyMasterBundle {
  en: WeeklyArticleMaster;
  uk: WeeklyArticleMaster;
  video: WeeklyNarrationPlan;
  socialAngles: Array<{
    channel: string;
    hookAngle: string;
    thesis: string;
    factIds: string[];
  }>;
}

export interface WeeklyQualityDimension {
  // 'engagement'/'voice' replaced 'hook'/'structure' in the PR3 rubric
  // redesign -- the old pair scored surface hook quality and JSON-shape
  // completeness, neither of which caught a 93/100 compliance-register
  // draft. engagement = narrative pull (would a human read past paragraph
  // one); voice = house-style adherence (editorial-voice.ts).
  name: 'engagement' | 'voice' | 'clarity' | 'trust' | 'usefulness' | 'naturalness' | 'parity';
  score: number;
  note: string;
}

export interface WeeklyQualityIssue {
  code: string;
  message: string;
  blocker: boolean;
  locale?: WeeklyLocale;
  revisionItemId?: string;
  field?: string;
  span?: string;
  suggestedFix?: string;
}

export interface WeeklyContentQualityReport {
  schemaVersion: 'weekly-quality-v2';
  score: number;
  dimensions: WeeklyQualityDimension[];
  issues: WeeklyQualityIssue[];
  factualFlags: string[];
  approvedClaimIds: string[];
  checkedAt: string;
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function placementForRank(rank: number): WeeklyPlacement {
  return rank <= 3 ? 'feature' : 'radar';
}

export function canonicalSourceName(input: string): string {
  let hostname: string;
  try {
    hostname = new URL(input).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'Source';
  }
  const known: Record<string, string> = {
    'anthropic.com': 'Anthropic',
    'openai.com': 'OpenAI',
    'deepmind.google': 'Google DeepMind',
    'research.google': 'Google Research',
    'blog.google': 'Google',
    'ai.google': 'Google AI',
    'nvidia.com': 'NVIDIA',
    'github.com': 'GitHub',
    'techcrunch.com': 'TechCrunch',
    'arxiv.org': 'arXiv',
    'huggingface.co': 'Hugging Face',
    'news.ycombinator.com': 'Hacker News',
  };
  for (const [domain, name] of Object.entries(known)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return name;
  }
  const label = hostname.split('.')[0]?.replace(/[-_]+/g, ' ') ?? 'Source';
  return label.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function sourceNameMatchesDomain(name: string, url: string) {
  const expected = canonicalSourceName(url).toLocaleLowerCase();
  const actual = clean(name).toLocaleLowerCase();
  return (
    Boolean(actual) &&
    (actual === expected || actual.includes(expected) || expected.includes(actual))
  );
}

export function contentFingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function words(value: string) {
  return clean(value).split(/\s+/).filter(Boolean).length;
}

function normalizedComparable(value: string) {
  return clean(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const GENERIC_PRACTICAL_PATTERNS = [
  /small, reversible research task/i,
  /run a small pilot/i,
  /representative task.*cost, latency/i,
  /prototype the integration in a sandbox/i,
  /невелике оборотне дослідження/i,
  /проведіть невеликий пілот/i,
  /репрезентативному завданні.*вартість.*затримк/i,
  /прототип інтеграції в ізольованому середовищі/i,
];

const TEMPLATE_LEAK_FIELDS = [
  'body',
  'why',
  'practical',
  'limitation',
  'takeaway',
  'editorsView',
] as const;

const ARTICLE_LEVEL_TEMPLATE_LEAK_FIELDS = ['standfirst', 'intro', 'editorNote', 'conclusion'] as const;

/**
 * Deterministic, zero-cost pre-critic gate: fires a blocker whenever a story
 * or article-level field matches a known template-leak or AI-tell pattern
 * (editorial-voice.ts). Catches the exact register the owner rejected in the
 * 2026-07-27 edition -- e.g. a body paragraph opening "Практичний сценарій:"
 * that just restates the separately-boxed practical field -- before an LLM
 * critic call is even spent checking for it.
 */
export function detectTemplateLeaks(bundle: WeeklyMasterBundle): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  for (const locale of ['en', 'uk'] as const) {
    const article = bundle[locale];
    const rules = bannedPhrasesFor(locale);
    for (const field of ARTICLE_LEVEL_TEMPLATE_LEAK_FIELDS) {
      const value = article[field];
      for (const rule of rules) {
        const match = rule.pattern.exec(value);
        if (!match) continue;
        issues.push({
          code: `template_leak:${rule.code}`,
          message: rule.message,
          blocker: true,
          locale,
          field,
          span: match[0],
        });
      }
    }
    for (const story of article.stories) {
      for (const field of TEMPLATE_LEAK_FIELDS) {
        const value = story[field];
        for (const rule of rules) {
          const match = rule.pattern.exec(value);
          if (!match) continue;
          issues.push({
            code: `template_leak:${rule.code}`,
            message: rule.message,
            blocker: true,
            locale,
            revisionItemId: story.revisionItemId,
            field,
            span: match[0],
          });
        }
      }
    }
  }
  return issues;
}

export function validateMasterBundle(
  bundle: WeeklyMasterBundle,
  researchPacks: WeeklyResearchPack[],
  expectedStories: Array<{
    revisionItemId: string;
    placement: WeeklyPlacement;
    claimIds: string[];
  }> = researchPacks.map((pack) => ({
    revisionItemId: pack.revisionItemId,
    placement: pack.placement,
    claimIds: pack.claims.map((claim) => claim.id),
  })),
): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  const claimIds = new Set(expectedStories.flatMap((story) => story.claimIds));
  const itemIds = expectedStories.map((story) => story.revisionItemId);
  const featureIds = expectedStories
    .filter((story) => story.placement === 'feature')
    .map((story) => story.revisionItemId);
  const radarCount = expectedStories.filter((story) => story.placement === 'radar').length;
  if (featureIds.length !== 3 || radarCount < 3 || radarCount > 4) {
    issues.push({
      code: 'top3_radar_structure',
      message: 'The edition must contain exactly three features and three or four Radar stories.',
      blocker: true,
    });
  }

  for (const locale of ['en', 'uk'] as const) {
    const article = bundle[locale];
    const articleIds = article.stories.map((story) => story.revisionItemId);
    if (
      articleIds.length !== itemIds.length ||
      new Set(articleIds).size !== itemIds.length ||
      articleIds.some((itemId) => !itemIds.includes(itemId))
    ) {
      issues.push({
        code: 'story_set_mismatch',
        message: `${locale.toUpperCase()} master must contain every selected story exactly once and no extras.`,
        blocker: true,
        locale,
      });
    }
    const articleWordCount = words(
      [
        article.standfirst,
        article.intro,
        article.editorNote,
        article.conclusion,
        ...article.stories.flatMap((story) => [
          story.hook,
          story.body,
          story.why,
          story.practical,
          story.limitation,
          story.takeaway,
        ]),
      ].join(' '),
    );
    if (articleWordCount < 2_000 || articleWordCount > 3_000) {
      issues.push({
        code: 'article_length',
        message: `${locale.toUpperCase()} master is ${articleWordCount} words; target is 2,000–3,000.`,
        blocker: false,
        locale,
        suggestedFix: 'Adjust context and analysis without introducing unsupported claims.',
      });
    }
    if (article.locale !== locale) {
      issues.push({
        code: 'locale_mismatch',
        message: `${locale.toUpperCase()} article declares the wrong locale.`,
        blocker: true,
        locale,
      });
    }
    const byId = new Map(article.stories.map((story) => [story.revisionItemId, story]));
    for (const itemId of itemIds) {
      const story = byId.get(itemId);
      if (!story) {
        issues.push({
          code: 'story_missing',
          message: `The ${locale.toUpperCase()} master omitted a selected story.`,
          blocker: true,
          locale,
          revisionItemId: itemId,
        });
        continue;
      }
      const expected = expectedStories.find((candidate) => candidate.revisionItemId === itemId);
      if (expected && story.placement !== expected.placement) {
        issues.push({
          code: 'placement_mismatch',
          message: `Story placement must remain ${expected.placement}.`,
          blocker: true,
          locale,
          revisionItemId: itemId,
          field: 'placement',
        });
      }
      const target = story.placement === 'feature' ? [400, 650] : [80, 140];
      const wordCount = words(story.body);
      if (wordCount < target[0] || wordCount > target[1]) {
        issues.push({
          code: 'story_length',
          message: `${story.placement} story is ${wordCount} words; target is ${target[0]}–${target[1]}.`,
          blocker: false,
          locale,
          revisionItemId: itemId,
          field: 'body',
          suggestedFix: `Rewrite the body to ${target[0]}–${target[1]} words without adding claims.`,
        });
      }
      if (story.placement === 'feature') {
        if (!story.editorsView.trim()) {
          issues.push({
            code: 'editors_view_missing',
            message: 'Every feature story requires an editorsView speculation block.',
            blocker: true,
            locale,
            revisionItemId: itemId,
            field: 'editorsView',
          });
        } else {
          const editorsViewWords = words(story.editorsView);
          if (editorsViewWords < 60 || editorsViewWords > 110) {
            issues.push({
              code: 'editors_view_length',
              message: `editorsView is ${editorsViewWords} words; target is 60–110.`,
              blocker: false,
              locale,
              revisionItemId: itemId,
              field: 'editorsView',
              suggestedFix: 'Tighten or extend the speculation to 60–110 words without restating the body.',
            });
          }
        }
        if (!story.discussionQuestion.trim()) {
          issues.push({
            code: 'discussion_question_missing',
            message: 'Every feature story requires a closing discussionQuestion.',
            blocker: true,
            locale,
            revisionItemId: itemId,
            field: 'discussionQuestion',
          });
        }
      }
      const repeated = [story.why, story.practical, story.takeaway].map(normalizedComparable);
      if (new Set(repeated).size !== repeated.length) {
        issues.push({
          code: 'duplicate_editorial_fields',
          message: 'Why it matters, practical example and takeaway must do different jobs.',
          blocker: true,
          locale,
          revisionItemId: itemId,
          suggestedFix:
            'Make the practical example story-specific and keep the takeaway to one decision.',
        });
      }
      if (GENERIC_PRACTICAL_PATTERNS.some((pattern) => pattern.test(story.practical))) {
        issues.push({
          code: 'generic_practical',
          message: 'The practical example matches a prohibited generic template.',
          blocker: true,
          locale,
          revisionItemId: itemId,
          field: 'practical',
          span: story.practical,
          suggestedFix:
            'Name a concrete actor, workflow, action, constraint and observable outcome.',
        });
      }
      for (const id of story.claimIds) {
        if (!claimIds.has(id)) {
          issues.push({
            code: 'unsupported_claim_id',
            message: `Story references claim ${id}, which is absent from approved research.`,
            blocker: true,
            locale,
            revisionItemId: itemId,
            field: 'claimIds',
            span: id,
          });
        } else if (expected && !expected.claimIds.includes(id)) {
          issues.push({
            code: 'wrong_story_claim_id',
            message: `Story references claim ${id} from a different selected story.`,
            blocker: true,
            locale,
            revisionItemId: itemId,
            field: 'claimIds',
            span: id,
            suggestedFix: 'Use only claim IDs assigned to this revisionItemId.',
          });
        }
      }
      if (story.claimIds.length === 0) {
        issues.push({
          code: 'ungrounded_story',
          message: 'Every story must cite at least one approved claim ID.',
          blocker: true,
          locale,
          revisionItemId: itemId,
          field: 'claimIds',
        });
      }
    }
  }

  const enIds = bundle.en.stories.map(
    (story) => `${story.revisionItemId}:${story.claimIds.join(',')}`,
  );
  const ukIds = bundle.uk.stories.map(
    (story) => `${story.revisionItemId}:${story.claimIds.join(',')}`,
  );
  if (JSON.stringify(enIds) !== JSON.stringify(ukIds)) {
    issues.push({
      code: 'bilingual_claim_parity',
      message: 'English and Ukrainian stories do not preserve the same claim IDs.',
      blocker: true,
      suggestedFix: 'Adapt the prose while preserving story order and exact claim ID arrays.',
    });
  }
  if (bundle.video.shorts.length !== 3) {
    issues.push({
      code: 'shorts_count',
      message: 'The narration plan must include exactly three Ukrainian Shorts.',
      blocker: true,
    });
  }
  const narrationSeconds = bundle.video.scenes.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  );
  if (!Number.isFinite(narrationSeconds) || narrationSeconds < 360 || narrationSeconds > 480) {
    issues.push({
      code: 'video_duration',
      message: `Long-form scene plan totals ${narrationSeconds || 0}s; required range is 360–480s.`,
      blocker: true,
    });
  }
  const shortIds = bundle.video.shorts.map((short) => short.revisionItemId);
  const featureClaimIds = new Map(
    expectedStories
      .filter((story) => story.placement === 'feature')
      .map((story) => [story.revisionItemId, new Set(story.claimIds)]),
  );
  if (
    bundle.video.shorts.some(
      (short) =>
        short.locale !== 'uk' ||
        short.durationSeconds < 35 ||
        short.durationSeconds > 50 ||
        !featureIds.includes(short.revisionItemId) ||
        short.factIds.length === 0 ||
        short.factIds.some((factId) => !featureClaimIds.get(short.revisionItemId)?.has(factId)),
    ) ||
    new Set(shortIds).size !== 3
  ) {
    issues.push({
      code: 'shorts_contract',
      message: 'Each Top 3 story needs one 35–50s Ukrainian Short grounded in approved fact IDs.',
      blocker: true,
    });
  }
  if (
    bundle.video.scenes.length < 4 ||
    bundle.video.scenes.some(
      (scene) =>
        !Number.isFinite(scene.durationSeconds) ||
        scene.durationSeconds <= 0 ||
        scene.durationSeconds > 180 ||
        scene.factIds.some((factId) => !claimIds.has(factId)),
    )
  ) {
    issues.push({
      code: 'scene_grounding',
      message:
        'The long-form plan needs at least four scenes; each must be 1–180s and use approved fact IDs.',
      blocker: true,
    });
  }
  if (
    bundle.socialAngles.some(
      (angle) =>
        angle.factIds.length === 0 || angle.factIds.some((factId) => !claimIds.has(factId)),
    )
  ) {
    issues.push({
      code: 'social_angle_grounding',
      message: 'Every social angle must reference one or more approved fact IDs.',
      blocker: true,
    });
  }
  issues.push(...detectTemplateLeaks(bundle));
  return issues;
}

export const REQUIRED_QUALITY_DIMENSIONS: WeeklyQualityDimension['name'][] = [
  'engagement',
  'voice',
  'clarity',
  'trust',
  'usefulness',
  'naturalness',
  'parity',
];
const GENERAL_DIMENSION_MIN_SCORE = 75;
const NATURALNESS_PARITY_MIN_SCORE = 80;
const OVERALL_MIN_SCORE = 85;

/**
 * Issue codes a targeted revise pass (editorial-llm.ts `reviseArticlePrompt`)
 * can plausibly fix by rewriting one field's prose without touching story
 * set, claims, or structure. Deliberately excludes grounding/structural
 * codes (unsupported_claim_id, story_set_mismatch, shorts_contract,
 * video_duration, scene_grounding, social_angle_grounding, bilingual_claim_
 * parity, top3_radar_structure, locale_mismatch, story_missing, placement_
 * mismatch) -- those mean the writer needs to rethink the story, not
 * reword a sentence, so they always fall through to a full regenerate.
 */
const REVISABLE_ISSUE_CODES = new Set([
  'generic_practical',
  'editors_view_length',
  'editors_view_missing',
  'discussion_question_missing',
  'duplicate_editorial_fields',
  'article_length',
  'story_length',
]);

export function isRevisableIssueCode(code: string): boolean {
  return (
    REVISABLE_ISSUE_CODES.has(code) ||
    code.startsWith('template_leak:') ||
    code.startsWith('dimension_low_score:')
  );
}

/**
 * True when nothing in the report disqualifies a targeted revise pass over a
 * full EN/UK regenerate. Three things disqualify it: any unresolved factual
 * flag (grounding problems always need a full rewrite, never a reword), a
 * malformed dimension set (the critic itself misbehaved -- feed it the same
 * shape again, don't try to patch around it), or any `issues[]` entry whose
 * code isn't in the revisable set (a structural/grounding blocker means the
 * writer needs to rethink the story, not reword a sentence). Note this does
 * NOT require issues.length > 0 -- a report can fail purely on a low
 * dimension score (e.g. voice: 70) with an empty issues array, and that case
 * is exactly what a revise pass should handle.
 */
export function reportIsRevisable(
  report: Pick<WeeklyContentQualityReport, 'issues' | 'factualFlags' | 'dimensions'>,
): boolean {
  if (report.factualFlags.length > 0) return false;
  const receivedDimensions = new Set(report.dimensions.map((dimension) => dimension.name));
  const wellFormedDimensions =
    report.dimensions.length === REQUIRED_QUALITY_DIMENSIONS.length &&
    receivedDimensions.size === REQUIRED_QUALITY_DIMENSIONS.length &&
    REQUIRED_QUALITY_DIMENSIONS.every((name) => receivedDimensions.has(name));
  if (!wellFormedDimensions) return false;
  return report.issues.every((issue) => isRevisableIssueCode(issue.code));
}

/**
 * Every reason `editorialQualityPasses` would reject this report, in plain
 * language naming the specific dimension/value at fault. `throw new Error`
 * call sites should join and surface this list — a bare score/blocker-count
 * summary hides which check actually failed (e.g. an 88/100 report with 0
 * blockers can still fail solely because one dimension missed its own,
 * stricter floor).
 */
export function editorialQualityFailures(report: WeeklyContentQualityReport): string[] {
  const requiredDimensions = new Set(REQUIRED_QUALITY_DIMENSIONS);
  const receivedDimensions = new Set(report.dimensions.map((dimension) => dimension.name));
  const failures: string[] = [];

  if (report.factualFlags.length > 0) {
    failures.push(`${report.factualFlags.length} unresolved factual flag(s): ${report.factualFlags.join('; ')}`);
  }
  const blockers = report.issues.filter((issue) => issue.blocker);
  if (blockers.length > 0) {
    failures.push(`${blockers.length} blocking issue(s): ${blockers.map((issue) => issue.code).join(', ')}`);
  }
  if (report.score < OVERALL_MIN_SCORE) {
    failures.push(`overall score ${report.score}/100 is below the ${OVERALL_MIN_SCORE} minimum`);
  }
  const missingDimensions = REQUIRED_QUALITY_DIMENSIONS.filter(
    (dimension) => !receivedDimensions.has(dimension),
  );
  if (missingDimensions.length > 0) {
    failures.push(`missing required dimension(s): ${missingDimensions.join(', ')}`);
  }
  if (requiredDimensions.size !== receivedDimensions.size && missingDimensions.length === 0) {
    failures.push(
      `expected exactly ${requiredDimensions.size} dimensions, got ${receivedDimensions.size} (duplicate or unexpected entries)`,
    );
  }
  for (const dimension of report.dimensions) {
    if (dimension.score < GENERAL_DIMENSION_MIN_SCORE) {
      failures.push(
        `dimension "${dimension.name}" scored ${dimension.score}/100, below the ${GENERAL_DIMENSION_MIN_SCORE} general minimum`,
      );
    } else if (
      (dimension.name === 'naturalness' || dimension.name === 'parity') &&
      dimension.score < NATURALNESS_PARITY_MIN_SCORE
    ) {
      failures.push(
        `dimension "${dimension.name}" scored ${dimension.score}/100, below the ${NATURALNESS_PARITY_MIN_SCORE} minimum required for naturalness/parity`,
      );
    }
  }
  return failures;
}

export function editorialQualityPasses(report: WeeklyContentQualityReport) {
  return editorialQualityFailures(report).length === 0;
}

/**
 * Turns under-threshold dimensions into retry guidance the writer can act on
 * — unlike `issues[].blocker`, a low dimension score never reached retry
 * guidance before, so a retry after a naturalness/parity-only miss had no
 * instruction to fix and just re-rolled the same prompt. `naturalness` and
 * `parity` are the critic's translation-side dimensions (see the critic
 * prompt in editorial-llm.ts), so they're tagged `locale: 'uk'`; the other
 * five (hook/clarity/trust/usefulness/structure) are English/structural and
 * left locale-less.
 */
export function editorialQualityRetryGuidance(
  report: Pick<WeeklyContentQualityReport, 'dimensions'>,
): Array<{ code: string; message: string; locale?: 'uk' }> {
  const guidance: Array<{ code: string; message: string; locale?: 'uk' }> = [];
  for (const dimension of report.dimensions) {
    const isTranslationDimension = dimension.name === 'naturalness' || dimension.name === 'parity';
    const threshold = isTranslationDimension
      ? NATURALNESS_PARITY_MIN_SCORE
      : GENERAL_DIMENSION_MIN_SCORE;
    if (dimension.score >= threshold) continue;
    guidance.push({
      code: `dimension_low_score:${dimension.name}`,
      message: `The "${dimension.name}" dimension scored ${dimension.score}/100 (needs ${threshold}+). Critic note: ${dimension.note}`,
      ...(isTranslationDimension ? { locale: 'uk' as const } : {}),
    });
  }
  return guidance;
}
