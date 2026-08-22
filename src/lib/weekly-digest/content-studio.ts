import { createHash } from 'node:crypto';
import { clipToMaxChars } from './clip-text';
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

export const METADATA_MAX_CHARS = {
  seoTitle: 65,
  metaDescription: 160,
  ogTitle: 70,
  ogDescription: 200,
} as const;

function clipArticleMetadata(article: WeeklyArticleMaster): WeeklyArticleMaster {
  return {
    ...article,
    seoTitle: clipToMaxChars(article.seoTitle, METADATA_MAX_CHARS.seoTitle),
    metaDescription: clipToMaxChars(article.metaDescription, METADATA_MAX_CHARS.metaDescription),
    ogTitle: clipToMaxChars(article.ogTitle, METADATA_MAX_CHARS.ogTitle),
    ogDescription: clipToMaxChars(article.ogDescription, METADATA_MAX_CHARS.ogDescription),
  };
}

/** Hard-enforces meta/OG budgets on write, not only in the quality checker. */
export function enforceMetadataMaxChars(bundle: WeeklyMasterBundle): WeeklyMasterBundle {
  return {
    en: clipArticleMetadata(bundle.en),
    uk: clipArticleMetadata(bundle.uk),
  };
}

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

/** `9,9` (Ukrainian decimal comma) and `1 000` (thin/NBSP grouping) must
 * compare equal to `9.9` and `1000`, or every localized number looks changed. */
function numericValue(raw: string): string {
  return String(Number(raw.replace(/[\s  ]/g, '').replace(',', '.')));
}

function magnitudes(text: string, pattern: RegExp): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of text.matchAll(pattern)) {
    const digits = match.slice(1).find(Boolean);
    if (!digits) continue;
    const value = numericValue(digits);
    if (value !== 'NaN' && !found.has(value)) found.set(value, match[0].trim());
  }
  return found;
}

// `\b` and `\w` stay ASCII-only even under /u, so a Cyrillic word never gets
// a trailing boundary and `раз(?:ів)?\b` silently never matches. Every
// Ukrainian suffix here ends with an explicit "not another Cyrillic letter"
// lookahead instead.
const NOT_CYRILLIC = '(?![\\u0400-\\u04FF])';

const MULTIPLIER_PATTERNS = {
  en: /(\d+(?:[.,]\d+)?)\s*(?:x\b|×|-fold\b|\s+times\b)/giu,
  uk: new RegExp(
    // раз / рази / разів / разу / раза — «у 1,5 раза» is as ordinary as
    // «у 600 разів», and missing it would silently disable this direction.
    `(?:у|в)\\s+(\\d+(?:[.,]\\d+)?)\\s+раз(?:и|ів|у|а)?${NOT_CYRILLIC}|(\\d+(?:[.,]\\d+)?)\\s*(?:x\\b|×)`,
    'giu',
  ),
} as const;

const PERCENT_PATTERNS = {
  en: /(\d+(?:[.,]\d+)?)\s*(?:%|percent\b)/giu,
  uk: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:%|відсотк[\\u0400-\\u04FF]*)`, 'giu'),
} as const;

/**
 * Catches the multiplier↔percentage swap between locales — an order-of-
 * magnitude error that reads as a fluent sentence, so neither a human skim
 * nor the critic's `parity` dimension reliably stops it. Live example
 * (sandbox run 2026-08-09): EN "Claude Code's 600x Energy Bill" became UK
 * «Рахунки Claude Code на 600% більше». 600% is roughly 7x, not 600x, and
 * the same edition's UK standfirst said «в 600 разів» correctly — so the
 * article contradicted itself and still scored 88/100 on parity.
 *
 * Deliberately narrow: the magnitude must be a percentage here, a multiple in
 * the other locale, and *not* a percentage there — so an edition that
 * genuinely carries both "600x energy" and "600% growth" in both locales
 * passes untouched, while an idiomatic «на 100%» only ever fires if the other
 * locale really says "100x". Everything softer is left to the critic.
 *
 * The check does not require the offending locale to be internally
 * consistent: the live case contradicted itself (title «600%», standfirst
 * «в 600 разів»), which is exactly the shape a self-consistency guard would
 * have waved through.
 */
function numericParityIssues(bundle: WeeklyMasterBundle): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  const joined = {
    en: articleTextFields(bundle.en)
      .map((field) => field.value)
      .join('\n'),
    uk: articleTextFields(bundle.uk)
      .map((field) => field.value)
      .join('\n'),
  };

  for (const [locale, other] of [
    ['uk', 'en'],
    ['en', 'uk'],
  ] as const) {
    const percents = magnitudes(joined[locale], PERCENT_PATTERNS[locale]);
    const otherMultipliers = magnitudes(joined[other], MULTIPLIER_PATTERNS[other]);
    const otherPercents = magnitudes(joined[other], PERCENT_PATTERNS[other]);
    for (const [value, span] of percents) {
      // A swap, not a coincidence: the other locale calls this magnitude a
      // multiple and never states it as a percentage of its own.
      if (!otherMultipliers.has(value) || otherPercents.has(value)) continue;
      const field = articleTextFields(bundle[locale]).find((candidate) =>
        candidate.value.includes(span),
      );
      issues.push({
        code: 'numeric_parity',
        message: `${locale.toUpperCase()} states ${span} where ${other.toUpperCase()} states a ${value}x multiple — a percentage and a multiple are not the same magnitude.`,
        blocker: true,
        locale,
        ...(field?.field ? { field: field.field } : {}),
        ...(field?.revisionItemId ? { revisionItemId: field.revisionItemId } : {}),
        span,
        suggestedFix: `Express it as a multiple, matching ${other.toUpperCase()} (${locale === 'uk' ? `«у ${value} разів»` : `"${value}x"`}), not as a percentage.`,
      });
    }
  }
  return issues;
}

/**
 * Latin letters visually identical (or near-identical) to a Cyrillic letter
 * -- the homoglyph set a model most often drops into an otherwise-Ukrainian
 * word. Live case (2026-08-22): a Latin "e" typed where "е" belongs pinned
 * `naturalness` at 55 for a revision the critic otherwise scored 90 across
 * every other dimension ("наймeншим" instead of "найменшим"). Mapping only
 * characters with a true visual twin keeps this from ever touching a
 * genuine mixed-script token like "Claude-подібний".
 */
const LATIN_TO_CYRILLIC_HOMOGLYPH: Record<string, string> = {
  a: 'а',
  e: 'е',
  i: 'і',
  o: 'о',
  p: 'р',
  c: 'с',
  x: 'х',
  y: 'у',
  A: 'А',
  B: 'В',
  E: 'Е',
  H: 'Н',
  I: 'І',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  X: 'Х',
  Y: 'У',
};

const CYRILLIC_LETTER_RE = /[Ѐ-ӿ]/;
const PURE_CYRILLIC_WORD_RE = /^[Ѐ-ӿ'’-]+$/u;
/** A "word" for homoglyph purposes: letters plus the punctuation that legitimately sits inside one (apostrophe, hyphen). */
const HOMOGLYPH_WORD_RE = /[\p{L}'’-]+/gu;

/**
 * A word that already contains a Cyrillic letter, and turns fully Cyrillic
 * once every homoglyph in it is swapped, is a corrupted Ukrainian word, not
 * a deliberate mixed-script token: a real product name in Latin script
 * (e.g. "iOS", "Alibaba") has no Cyrillic letters to begin with, and a
 * genuine compound like "Claude-подібний" keeps un-mappable Latin letters
 * (l, d, u...) after the swap, which fails the "fully Cyrillic" check below.
 */
function homoglyphFixFor(word: string): string | null {
  if (!CYRILLIC_LETTER_RE.test(word)) return null;
  let swappedAny = false;
  const fixed = [...word]
    .map((character) => {
      const swap = LATIN_TO_CYRILLIC_HOMOGLYPH[character];
      if (!swap) return character;
      swappedAny = true;
      return swap;
    })
    .join('');
  if (!swappedAny || !PURE_CYRILLIC_WORD_RE.test(fixed)) return null;
  return fixed;
}

/**
 * Deterministic, zero-cost catch for a Latin look-alike character spliced
 * into a Cyrillic word -- generation noise the critic only sometimes
 * notices, and that `UKRAINIAN_LANGUAGE_RESIDUE` cannot catch (it matches
 * whole known-bad words, not single wrong characters). Coded
 * `language_mechanics` with a literal `suggestedFix` so it flows through the
 * same free mechanical splice as a critic-found language error, instead of
 * costing a full-field LLM rewrite for what is always exactly one character.
 */
function homoglyphIssues(article: WeeklyArticleMaster): WeeklyQualityIssue[] {
  const issues: WeeklyQualityIssue[] = [];
  for (const textField of articleTextFields(article)) {
    for (const match of textField.value.matchAll(HOMOGLYPH_WORD_RE)) {
      const word = match[0];
      const fixed = homoglyphFixFor(word);
      if (!fixed) continue;
      issues.push({
        code: 'language_mechanics',
        message: `Ukrainian word "${word}" contains a Latin look-alike character instead of its Cyrillic counterpart.`,
        blocker: true,
        locale: 'uk',
        field: textField.field,
        ...(textField.revisionItemId ? { revisionItemId: textField.revisionItemId } : {}),
        span: word,
        suggestedFix: fixed,
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
        // A vague "rewrite to N-M words" instruction reliably under-cuts a body
        // that is far outside the target -- the repair model trims a sentence
        // or two rather than restructuring, and burns its attempt budget
        // without landing in range (live case: a 1,203-word feature body given
        // only two repair attempts against a 400-650 target). Naming the exact
        // delta and explicitly permitting paragraph-level cuts, not just line
        // edits, gives the model a concrete target instead of a direction.
        const tooLong = wordCount > target[1];
        const delta = tooLong ? wordCount - target[1] : target[0] - wordCount;
        const instruction = tooLong
          ? `Cut at least ${delta} words from the current ${wordCount}-word body down to ${target[0]}–${target[1]}. Remove whole paragraphs or sub-plots rather than trimming individual sentences -- a ${Math.round((delta / wordCount) * 100)}% cut needs structural editing.`
          : `Expand the current ${wordCount}-word body by at least ${delta} words up to ${target[0]}–${target[1]}, adding detail grounded in this story's approved claims. Never invent facts to reach the target.`;
        issues.push({
          code: 'story_length',
          message: `${story.placement} story is ${wordCount} words; target is ${target[0]}–${target[1]}.`,
          blocker: false,
          locale,
          revisionItemId: itemId,
          field: 'body',
          suggestedFix: instruction,
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
  // `editors_view_missing` above only requires the block on feature stories,
  // so a radar story picking one up in just one locale slipped past every
  // per-locale check -- the exact structure drift a live critic flagged at
  // `parity: 75` on 2026-08-22 (EN radar W5/W6/W7 empty, UK radar W5/W6/W7
  // carrying substantive commentary). Whichever locale skips it, both must
  // agree.
  for (const itemId of itemIds) {
    const enStory = bundle.en.stories.find((story) => story.revisionItemId === itemId);
    const ukStory = bundle.uk.stories.find((story) => story.revisionItemId === itemId);
    if (!enStory || !ukStory) continue;
    const enHasView = Boolean(enStory.editorsView.trim());
    const ukHasView = Boolean(ukStory.editorsView.trim());
    if (enHasView === ukHasView) continue;
    const missingLocale: WeeklyLocale = enHasView ? 'uk' : 'en';
    issues.push({
      code: 'editors_view_locale_mismatch',
      message: `The ${missingLocale.toUpperCase()} article has no editorsView for this story while the other locale does -- both locales must carry the same speculation block, or neither should.`,
      blocker: true,
      locale: missingLocale,
      revisionItemId: itemId,
      field: 'editorsView',
      suggestedFix: `Adapt the other locale's editorsView speculation into ${missingLocale.toUpperCase()} for this story (60-110 words, in this story's own voice).`,
    });
  }
  issues.push(...detectTemplateLeaks(bundle));
  issues.push(...promptCopyIssues(bundle));
  issues.push(...metadataQualityIssues(bundle));
  issues.push(...ambiguousEnergyClaimIssues(bundle));
  issues.push(...ukrainianLanguageIssues(bundle.uk));
  issues.push(...homoglyphIssues(bundle.uk));
  issues.push(...numericParityIssues(bundle));
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

/**
 * True when the *evaluator* misbehaved rather than the copy being bad: seven
 * identical scores (a lazy default) or a malformed dimension set.
 *
 * Worth distinguishing, because there is nothing in the article to repair in
 * that case -- the right response is to score it again, which is exactly what
 * the old loop could not do. It treated an unreliable verdict as a terminal
 * quality failure and threw away the edition over the critic's own laziness.
 */
export function criticVerdictLooksUnreliable(
  report: Pick<WeeklyContentQualityReport, 'dimensions'>,
): boolean {
  const received = new Set(report.dimensions.map((dimension) => dimension.name));
  const wellFormed =
    report.dimensions.length === REQUIRED_QUALITY_DIMENSIONS.length &&
    received.size === REQUIRED_QUALITY_DIMENSIONS.length &&
    REQUIRED_QUALITY_DIMENSIONS.every((name) => received.has(name));
  return !wellFormed || looksLikeUniformCriticRubberStamp(report.dimensions);
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
 * `naturalness` is pinned at 55 by the rubric whenever a `language_mechanics`
 * blocker exists (see CRITIC_RUBRIC in editorial-llm.ts: "a single objective
 * language error caps naturalness at 55"). Once the mechanical splice pass
 * (applyLanguageMechanicsFixes) has spliced in every such blocker's own
 * verbatim replacement and none remain in the report, the cap it explains no
 * longer holds -- but only a fresh critic call can say the copy is
 * *excellent*, so this raises the score to exactly the pass floor, never
 * higher, and only when the fix pass actually touched Ukrainian copy this
 * round and no other issue in the report still targets `naturalness`.
 *
 * Without this, a mechanically-fixed typo left the stale pre-fix score in
 * place: the owner saw "naturalness 55" on a draft whose only cited defect
 * had already been repaired, `Fix remaining issues` had nothing left to
 * fix, and each regenerate produced a fresh single-word error that repeated
 * the same stuck-at-55 outcome (five straight revisions, 2026-08-16..22).
 */
export function liftNaturalnessCapAfterLanguageFixes(
  report: WeeklyContentQualityReport,
  fixedLocales: ReadonlySet<WeeklyLocale>,
): WeeklyContentQualityReport {
  if (!fixedLocales.has('uk')) return report;
  const stillBlocked = report.issues.some(
    (issue) => issue.code === 'language_mechanics' && issue.blocker && issue.locale === 'uk',
  );
  if (stillBlocked) return report;
  return {
    ...report,
    dimensions: report.dimensions.map((dimension) =>
      dimension.name === 'naturalness' && dimension.score < NATURALNESS_PARITY_MIN_SCORE
        ? {
            ...dimension,
            score: NATURALNESS_PARITY_MIN_SCORE,
            note: `${dimension.note} (language_mechanics blocker mechanically fixed; score lifted to the pass floor pending the next critic pass.)`,
          }
        : dimension,
    ),
  };
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
  report: {
    dimensions: ReadonlyArray<Pick<WeeklyQualityDimension, 'name' | 'score' | 'note'>>;
  },
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

function isQualityDimensionName(value: unknown): value is WeeklyQualityDimension['name'] {
  return (
    value === 'engagement' ||
    value === 'voice' ||
    value === 'clarity' ||
    value === 'trust' ||
    value === 'usefulness' ||
    value === 'naturalness' ||
    value === 'parity'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Whether the Master quality panel should offer **Fix remaining issues**.
 * True for any coded issue (blocker or warning), a below-floor dimension,
 * an overall score under the gate, or leftover factual flags. Warnings such
 * as `story_length` are not Ship blockers, but they are exactly the work
 * the owner asked the writer to do from the amber cards.
 */
export function qualityReportNeedsRepair(
  report: {
    issues: readonly unknown[];
    dimensions: ReadonlyArray<Pick<WeeklyQualityDimension, 'name' | 'score' | 'note'>>;
    score?: number;
    factualFlags?: readonly string[];
  },
): boolean {
  if (report.issues.length > 0) return true;
  if ((report.factualFlags ?? []).length > 0) return true;
  if (typeof report.score === 'number' && report.score < OVERALL_MIN_SCORE) return true;
  return editorialQualityRetryGuidance(report).length > 0;
}

/** Loose JSONB `content` from `content_quality_report` artifacts. */
export function qualityContentNeedsRepair(content: unknown): boolean {
  if (!isPlainObject(content)) return false;
  const rawIssues = Array.isArray(content.issues) ? content.issues : [];
  const factualFlags = Array.isArray(content.factualFlags)
    ? content.factualFlags.filter((flag): flag is string => typeof flag === 'string')
    : [];
  const score = typeof content.score === 'number' ? content.score : undefined;
  const dimensions: WeeklyQualityDimension[] = [];
  if (Array.isArray(content.dimensions)) {
    for (const entry of content.dimensions) {
      if (!isPlainObject(entry) || !isQualityDimensionName(entry.name)) continue;
      const dimScore = Number(entry.score);
      if (!Number.isFinite(dimScore)) continue;
      dimensions.push({
        name: entry.name,
        score: dimScore,
        note: typeof entry.note === 'string' ? entry.note : '',
      });
    }
  }
  return qualityReportNeedsRepair({
    issues: rawIssues,
    dimensions,
    factualFlags,
    ...(score !== undefined ? { score } : {}),
  });
}
