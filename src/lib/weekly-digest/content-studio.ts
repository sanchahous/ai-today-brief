import { createHash } from 'node:crypto';
import { bannedPhrasesFor, exemplarFor } from './editorial-voice';

export const WEEKLY_CONTENT_STUDIO_VERSION = 'weekly-content-studio-v2.1';
export const WEEKLY_MASTER_SPEC_VERSION = 'weekly-master-v7';
export const WEEKLY_VIDEO_MANIFEST_VERSION = 'weekly-video-v3';
/** video_script is a standalone job/artifact stage since PR6 -- separate version from the manifest. */
export const WEEKLY_VIDEO_SCRIPT_SCHEMA_VERSION = 'weekly-video-script-v1';
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

export interface WeeklyMasterBundle {
  en: WeeklyArticleMaster;
  uk: WeeklyArticleMaster;
}

/**
 * TV-news-format scene (PR6, editorial quality overhaul). Replaces the old
 * WeeklyNarrationPlan scene shape (id/purpose/voiceover/onScreenText/
 * visualBrief), which had no act structure and no per-scene story link --
 * the video repo's renderer mapped scenes to story images by `index %
 * assets.length`, which is why a scene about one story could render another
 * story's illustration. `revisionItemId` fixes that at the source.
 */
export interface WeeklyVideoScene {
  id: string;
  kind: 'cold_open' | 'anchor' | 'broll' | 'outro';
  /** null for cold_open/anchor/outro scenes that aren't tied to one story. */
  revisionItemId: string | null;
  voiceover: string;
  onScreenText: string;
  /** Living b-roll generation prompt, weekly reportage house style (pipeline/card-image.ts buildWeeklyPrompt). */
  scenePrompt: string;
  durationSeconds: number;
}

export interface WeeklyVideoScript {
  title: string;
  hook: string;
  narration: string;
  scenes: WeeklyVideoScene[];
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

function normalizedWords(value: string) {
  return normalizedComparable(value).split(/\s+/).filter(Boolean);
}

function firstSharedWordSequence(value: string, reference: string, wordCount = 12) {
  const candidateWords = normalizedWords(value);
  const referenceWords = normalizedWords(reference);
  if (candidateWords.length < wordCount || referenceWords.length < wordCount) return null;
  const referenceSequences = new Set<string>();
  for (let index = 0; index <= referenceWords.length - wordCount; index += 1) {
    referenceSequences.add(referenceWords.slice(index, index + wordCount).join(' '));
  }
  for (let index = 0; index <= candidateWords.length - wordCount; index += 1) {
    const sequence = candidateWords.slice(index, index + wordCount).join(' ');
    if (referenceSequences.has(sequence)) return sequence;
  }
  return null;
}

type ArticleTextField = {
  field: string;
  value: string;
  revisionItemId?: string;
};

function articleTextFields(article: WeeklyArticleMaster): ArticleTextField[] {
  const articleFields: ArticleTextField[] = [
    ['title', article.title],
    ['seoTitle', article.seoTitle],
    ['metaDescription', article.metaDescription],
    ['ogTitle', article.ogTitle],
    ['ogDescription', article.ogDescription],
    ['standfirst', article.standfirst],
    ['theme', article.theme],
    ['intro', article.intro],
    ['editorNote', article.editorNote],
    ['conclusion', article.conclusion],
    ...article.keyTakeaways.map((value) => ['keyTakeaways', value]),
  ].map(([field, value]) => ({ field, value }));
  const storyFields = article.stories.flatMap((story) =>
    (
      [
        ['headline', story.headline],
        ['summary', story.summary],
        ['hook', story.hook],
        ['body', story.body],
        ['why', story.why],
        ['practical', story.practical],
        ['limitation', story.limitation],
        ['takeaway', story.takeaway],
        ['editorsView', story.editorsView],
        ['discussionQuestion', story.discussionQuestion],
      ] as Array<[string, string]>
    ).map(([field, value]) => ({ field, value, revisionItemId: story.revisionItemId })),
  );
  return [...articleFields, ...storyFields];
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

const ARTICLE_LEVEL_TEMPLATE_LEAK_FIELDS = [
  'standfirst',
  'intro',
  'editorNote',
  'conclusion',
] as const;

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

const METADATA_MAX_CHARS = {
  seoTitle: 65,
  metaDescription: 160,
  ogTitle: 70,
  ogDescription: 200,
} as const;

const ABSTRACT_EDITION_TITLE_PATTERNS: Record<WeeklyLocale, RegExp[]> = {
  en: [/\bthe agentic shift\b/i, /\b(?:the )?new era of\b/i, /\bthe future of\b/i],
  uk: [/зсув до агентів/iu, /нова ера/iu, /майбутнє (?:ші|ai)/iu],
};

const UKRAINIAN_LANGUAGE_RESIDUE: Array<{ pattern: RegExp; replacement: string }> = [
  {
    // "score" deliberately excluded: an established dev-community loanword
    // (benchmark score, model score) the house voice keeps in English, not
    // untranslated residue.
    pattern:
      /\b(?:hours?|minutes?|seconds?|thousandths|kilowatt-hours?|billions?|millions?)\b|\b\d[\d,.]*\s+to\s+\d[\d,.]*/i,
    replacement: 'Перекладіть слово й локалізуйте одиницю або числовий діапазон українською.',
  },
  {
    pattern:
      /\b\d{1,3}(?:,\d{3})+\b|\b\d+\.\d+\s*(?:%|мільярд[а-яіїєґ]*|мільйон[а-яіїєґ]*|кВт|Вт|токен[а-яіїєґ]*)/iu,
    replacement: 'Локалізуйте число українською: пробіл для тисяч і кома для десяткового дробу.',
  },
  {
    pattern: /\beditorsView\b/,
    replacement: 'Використайте читацьку назву «Погляд редакції», а не внутрішнє ім’я поля.',
  },
  {
    pattern:
      /(?:доп['’]яти|притеча|енерговитраження|нехтої|компактизац[а-яіїєґ]*|декорен[а-яіїєґ]*)/iu,
    replacement: 'Замініть зламане або неіснуюче слово нормативним українським відповідником.',
  },
  {
    pattern: /[а-яіїєґ]+ется(?![а-яіїєґ])/iu,
    replacement: 'Виправте російське закінчення на нормативну українську форму.',
  },
  {
    // "мейнтейнер" deliberately excluded: standard Ukrainian dev-community
    // loanword the target audience actually uses, not an office-calque like
    // "інтеракція" -> "взаємодія".
    pattern: /(?:інтеракці[яєїю]|інтеракцій)/iu,
    replacement: 'Використайте зрозумілий український відповідник: «взаємодія».',
  },
];

function promptCopyIssues(bundle: WeeklyMasterBundle): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  for (const locale of ['en', 'uk'] as const) {
    const reference = exemplarFor(locale).opening;
    for (const textField of articleTextFields(bundle[locale])) {
      const sharedSequence = firstSharedWordSequence(textField.value, reference);
      if (!sharedSequence) continue;
      issues.push({
        code: 'prompt_exemplar_copy',
        message:
          'Published copy repeats a full phrase from the prompt’s legacy style exemplar instead of using this edition’s evidence.',
        blocker: true,
        locale,
        field: textField.field,
        ...(textField.revisionItemId ? { revisionItemId: textField.revisionItemId } : {}),
        span: sharedSequence,
        suggestedFix:
          'Rewrite this field from the approved stories. Do not reuse the exemplar’s incident, actors, chronology, or wording.',
      });
    }
  }
  return issues;
}

function metadataQualityIssues(bundle: WeeklyMasterBundle): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  for (const locale of ['en', 'uk'] as const) {
    const article = bundle[locale];
    for (const [field, maximum] of Object.entries(METADATA_MAX_CHARS) as Array<
      [keyof typeof METADATA_MAX_CHARS, number]
    >) {
      const value = article[field];
      if ([...value].length <= maximum) continue;
      issues.push({
        code: 'metadata_length',
        message: `${field} is ${[...value].length} characters; maximum is ${maximum}.`,
        blocker: true,
        locale,
        field,
        suggestedFix: `Shorten ${field} to ${maximum} characters or fewer without removing the concrete news hook.`,
      });
    }
    for (const field of ['title', 'theme'] as const) {
      const abstractTitle = ABSTRACT_EDITION_TITLE_PATTERNS[locale]
        .map((pattern) => pattern.exec(article[field])?.[0])
        .find(Boolean);
      if (abstractTitle) {
        issues.push({
          code: 'abstract_edition_title',
          message:
            'The edition framing is an abstract theme label; it does not tell a reader which concrete stories are inside.',
          blocker: true,
          locale,
          field,
          span: abstractTitle,
          suggestedFix:
            'Name two or three concrete actors, products, results, or consequences from the lead stories.',
        });
      }
    }
    const standfirstBoilerplate =
      locale === 'en'
        ? /^(?:a )?weekly digest\b/i.exec(article.standfirst)?.[0]
        : /^щотижневий дайджест/iu.exec(article.standfirst)?.[0];
    if (standfirstBoilerplate) {
      issues.push({
        code: 'standfirst_boilerplate',
        message:
          'The standfirst spends its opening on format boilerplate instead of the issue’s news value.',
        blocker: true,
        locale,
        field: 'standfirst',
        span: standfirstBoilerplate,
        suggestedFix:
          'Open with the issue’s strongest concrete development and why it matters now.',
      });
    }
  }
  return issues;
}

/**
 * Only fires on an explicit "N times more energy" comparison, not on the bare
 * word "energy" -- an earlier version flagged any energy-adjacent framing
 * (a headline about an energy deal, an energy-cost debate) with no
 * comparison to justify. The concrete unit only needs to appear somewhere in
 * the article, not the same field as the multiplier, since a headline has no
 * room for both a hook and "kWh".
 */
function ambiguousEnergyClaimIssues(bundle: WeeklyMasterBundle): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  for (const locale of ['en', 'uk'] as const) {
    const fields = articleTextFields(bundle[locale]);
    const hasConcreteUnitAnywhere = fields.some((textField) =>
      locale === 'en'
        ? /\b(?:electricity|electrical|kwh|watt-hours?|power consumption)\b/i.test(
            textField.value,
          )
        : /(?:електроенергі|кВт|Вт·?год|ват-год)/iu.test(textField.value),
    );
    if (hasConcreteUnitAnywhere) continue;
    for (const textField of fields) {
      const comparison =
        locale === 'en'
          ? /\b\d+\s*(?:x|times?)\s+more energy\b/i.exec(textField.value)?.[0]
          : /в \d+ раз(?:и|ів)? більше енергії/iu.exec(textField.value)?.[0];
      if (!comparison) continue;
      issues.push({
        code: 'ambiguous_energy_claim',
        message:
          'The story claims a multiple of “energy” without naming electricity, the measured unit, or workload anywhere in the article.',
        blocker: true,
        locale,
        field: textField.field,
        ...(textField.revisionItemId ? { revisionItemId: textField.revisionItemId } : {}),
        span: comparison,
        suggestedFix:
          'Name the estimated electricity use and unit (for example kWh per session) somewhere in the story, and attribute it to the specific measured workload.',
      });
    }
  }
  return issues;
}

function ukrainianLanguageIssues(article: WeeklyArticleMaster): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  for (const textField of articleTextFields(article)) {
    for (const rule of UKRAINIAN_LANGUAGE_RESIDUE) {
      const match = rule.pattern.exec(textField.value);
      if (!match) continue;
      issues.push({
        code: 'uk_language_residue',
        message:
          'The Ukrainian copy contains an untranslated, malformed, Russian, or internal-only word.',
        blocker: true,
        locale: 'uk',
        field: textField.field,
        ...(textField.revisionItemId ? { revisionItemId: textField.revisionItemId } : {}),
        span: match[0],
        suggestedFix: rule.replacement,
      });
    }
  }
  return issues;
}

function editorNoteClaimIssues(bundle: WeeklyMasterBundle): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  const patterns: Record<WeeklyLocale, RegExp> = {
    en: /\boriginal research\b/i,
    uk: /оригінальн(?:их|і) дослідженн(?:ях|я)/iu,
  };
  for (const locale of ['en', 'uk'] as const) {
    const span = patterns[locale].exec(bundle[locale].editorNote)?.[0];
    if (!span) continue;
    issues.push({
      code: 'unsupported_editorial_claim',
      message:
        'The editor note claims original research even though this edition is a synthesis of cited external primary sources.',
      blocker: true,
      locale,
      field: 'editorNote',
      span,
      suggestedFix:
        'Say that stories are based on cited primary sources and that editorial analysis is labeled separately.',
    });
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
        // Small misses remain editorial warnings, but a draft more than 10%
        // above the upper bound is too long to approve as-is. The first live
        // v6 run reached 3,703 EN / 3,351 UK words and still passed.
        blocker: articleWordCount < 1_800 || articleWordCount > 3_300,
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
              suggestedFix:
                'Tighten or extend the speculation to 60–110 words without restating the body.',
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
  issues.push(...detectTemplateLeaks(bundle));
  issues.push(...promptCopyIssues(bundle));
  issues.push(...metadataQualityIssues(bundle));
  issues.push(...ambiguousEnergyClaimIssues(bundle));
  issues.push(...ukrainianLanguageIssues(bundle.uk));
  issues.push(...editorNoteClaimIssues(bundle));
  return issues;
}

/** Spoken-word pacing used to check a scene's claimed duration against its actual narration length. */
const VIDEO_WORDS_PER_SECOND = 2.6;
const VIDEO_WPS_TOLERANCE = 0.2;

/**
 * Validates a TV-news-format video script (PR6, editorial quality
 * overhaul). The load-bearing check is `scene_narration_mismatch`: it kills
 * the documented root cause of the "silent slideshow" (the LLM inventing a
 * `durationSeconds` that satisfies the 360-480s total while writing
 * voiceover text far too short for that runtime -- see
 * ai-today-brief-video's 2026-08-05-professional-ai-video-guide.md, which
 * measured ~1,000 chars ≈ 97s of actual speech against a claimed 420s
 * manifest). A scene's duration must now be within ±20% of what its own
 * voiceover word count would actually take to read aloud at ~2.6 words/sec.
 */
export function validateVideoScript(
  script: WeeklyVideoScript,
  expectedStories: Array<{
    revisionItemId: string;
    placement: WeeklyPlacement;
    claimIds: string[];
  }>,
): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  const featureIds = expectedStories
    .filter((story) => story.placement === 'feature')
    .map((story) => story.revisionItemId);
  const featureClaimIds = new Map(
    expectedStories
      .filter((story) => story.placement === 'feature')
      .map((story) => [story.revisionItemId, new Set(story.claimIds)]),
  );
  const knownStoryIds = new Set(expectedStories.map((story) => story.revisionItemId));

  if (script.shorts.length !== 3) {
    issues.push({
      code: 'shorts_count',
      message: 'The video script must include exactly three Ukrainian Shorts.',
      blocker: true,
    });
  }
  const shortIds = script.shorts.map((short) => short.revisionItemId);
  if (
    script.shorts.some(
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

  const totalSeconds = script.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (!Number.isFinite(totalSeconds) || totalSeconds < 360 || totalSeconds > 480) {
    issues.push({
      code: 'video_duration',
      message: `Scene plan totals ${totalSeconds || 0}s; required range is 360–480s.`,
      blocker: true,
    });
  }

  const brollScenes = script.scenes.filter((scene) => scene.kind === 'broll');
  const brollStoryIds = new Set(brollScenes.map((scene) => scene.revisionItemId));
  if (
    script.scenes.length < 5 ||
    brollScenes.length < 3 ||
    !featureIds.every((id) => brollStoryIds.has(id))
  ) {
    issues.push({
      code: 'scene_structure',
      message:
        'The script needs a cold open, an anchor intro, one broll segment per Top 3 story, and an outro.',
      blocker: true,
    });
  }

  for (const scene of script.scenes) {
    if (
      !Number.isFinite(scene.durationSeconds) ||
      scene.durationSeconds <= 0 ||
      scene.durationSeconds > 180
    ) {
      issues.push({
        code: 'scene_duration',
        message: `Scene ${scene.id} duration ${scene.durationSeconds}s is outside the 1–180s range.`,
        blocker: true,
        field: 'durationSeconds',
      });
      continue;
    }
    const wordCount = words(scene.voiceover);
    const expectedSeconds = wordCount / VIDEO_WORDS_PER_SECOND;
    const lowerBound = expectedSeconds * (1 - VIDEO_WPS_TOLERANCE);
    const upperBound = expectedSeconds * (1 + VIDEO_WPS_TOLERANCE);
    if (scene.durationSeconds < lowerBound || scene.durationSeconds > upperBound) {
      issues.push({
        code: 'scene_narration_mismatch',
        message: `Scene ${scene.id} claims ${scene.durationSeconds}s but its voiceover is ${wordCount} words (~${expectedSeconds.toFixed(0)}s at ${VIDEO_WORDS_PER_SECOND} words/sec). Write narration long enough to fill the claimed duration, or shorten the duration to match.`,
        blocker: true,
        field: 'voiceover',
      });
    }
    if (
      scene.kind === 'broll' &&
      !(scene.revisionItemId && knownStoryIds.has(scene.revisionItemId))
    ) {
      issues.push({
        code: 'scene_story_link',
        message: `broll scene ${scene.id} must reference a real revisionItemId from this edition.`,
        blocker: true,
        field: 'revisionItemId',
      });
    }
    if (scene.kind !== 'broll' && scene.revisionItemId) {
      issues.push({
        code: 'scene_story_link',
        message: `${scene.kind} scene ${scene.id} is not story-specific; revisionItemId should be null.`,
        blocker: false,
        field: 'revisionItemId',
      });
    }
    for (const rule of bannedPhrasesFor('en')) {
      if (rule.pattern.test(scene.voiceover)) {
        issues.push({
          code: `template_leak:${rule.code}`,
          message: `Scene ${scene.id} voiceover: ${rule.message}`,
          blocker: true,
          field: 'voiceover',
        });
      }
    }
  }

  for (const short of script.shorts) {
    for (const field of ['hook', 'context', 'insight', 'takeaway'] as const) {
      for (const rule of bannedPhrasesFor('uk')) {
        if (rule.pattern.test(short[field])) {
          issues.push({
            code: `template_leak:${rule.code}`,
            message: `Short ${short.revisionItemId} ${field}: ${rule.message}`,
            blocker: true,
            field,
          });
        }
      }
    }
  }

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
 *
 * The seven voice_register/engagement_structure/clarity_unclear/trust_
 * attribution/usefulness_generic/naturalness_calque/language_mechanics codes are the critic's
 * own controlled vocabulary for non-factual issues (see criticPrompt,
 * editorial-llm.ts) -- added after a live shadow run against the rejected
 * 2026-07-27 edition (2026-08-06) showed the critic otherwise invents
 * ad-hoc codes like "VOICE_TEMPLATE_LEAK" that never match this set, which
 * would silently route a purely-prose failure to a full regenerate instead
 * of a targeted revise.
 */
const REVISABLE_ISSUE_CODES = new Set([
  'generic_practical',
  'editors_view_length',
  'editors_view_missing',
  'discussion_question_missing',
  'duplicate_editorial_fields',
  'article_length',
  'story_length',
  'voice_register',
  'engagement_structure',
  'clarity_unclear',
  'trust_attribution',
  'usefulness_generic',
  'naturalness_calque',
  'language_mechanics',
  'prompt_exemplar_copy',
  'metadata_length',
  'abstract_edition_title',
  'standfirst_boilerplate',
  'ambiguous_energy_claim',
  'uk_language_residue',
  'unsupported_editorial_claim',
]);

/** Below this, a uniform score reads as a lazy default rather than earned excellence. */
const RUBBER_STAMP_CEILING_SCORE = 95;

/**
 * Catches any identical-across-the-board score (not only the literal 90 the
 * 2026-08-06 shadow run produced) as a likely lazy default, while carving
 * out an escape valve for a genuinely outstanding, evenly-strong draft: a
 * uniform score at or above RUBBER_STAMP_CEILING_SCORE is treated as earned.
 */
function looksLikeUniformCriticRubberStamp(
  dimensions: Pick<WeeklyQualityDimension, 'name' | 'score'>[],
) {
  const receivedDimensions = new Set(dimensions.map((dimension) => dimension.name));
  const wellFormed =
    dimensions.length === REQUIRED_QUALITY_DIMENSIONS.length &&
    receivedDimensions.size === REQUIRED_QUALITY_DIMENSIONS.length &&
    REQUIRED_QUALITY_DIMENSIONS.every((name) => receivedDimensions.has(name));
  if (!wellFormed) return false;
  const [firstScore] = dimensions.map((dimension) => dimension.score);
  return (
    firstScore < RUBBER_STAMP_CEILING_SCORE &&
    dimensions.every((dimension) => dimension.score === firstScore)
  );
}

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
  // This is an evaluator failure, not an article field that the writer can
  // safely line-edit. The live v6 critic returned seven identical 90s while
  // missing obvious spelling, grammar and prompt-copy defects.
  if (looksLikeUniformCriticRubberStamp(report.dimensions)) return false;
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
    failures.push(
      `${report.factualFlags.length} unresolved factual flag(s): ${report.factualFlags.join('; ')}`,
    );
  }
  const blockers = report.issues.filter((issue) => issue.blocker);
  if (blockers.length > 0) {
    failures.push(
      `${blockers.length} blocking issue(s): ${blockers.map((issue) => issue.code).join(', ')}`,
    );
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
  if (looksLikeUniformCriticRubberStamp(report.dimensions)) {
    failures.push(
      `all seven critic dimensions received the identical ${report.dimensions[0]!.score}/100; the evaluator must score and justify each dimension independently`,
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
