export interface WeeklyEditorialSourceItem {
  id: string;
  category_slug: string | null;
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  why_matters_en?: string | null;
  why_matters_uk?: string | null;
  facts_en?: unknown;
  facts_uk?: unknown;
}

export interface WeeklyStoryEditorialDraft {
  id: string;
  body_en: string;
  body_uk: string;
  practical_en: string;
  practical_uk: string;
  takeaway_en: string;
  takeaway_uk: string;
}

export interface WeeklyIssueEditorialDraft {
  editor_note_en: string;
  editor_note_uk: string;
  key_takeaways_en: string[];
  key_takeaways_uk: string[];
}

export interface WeeklyEditorialDraft extends WeeklyIssueEditorialDraft {
  stories: WeeklyStoryEditorialDraft[];
}

type Locale = 'en' | 'uk';

interface CategoryActions {
  en: string;
  uk: string;
  labelEn: string;
  labelUk: string;
}

const DEFAULT_CATEGORY: CategoryActions = {
  en: 'Use this as a small, reversible research task before changing a production workflow.',
  uk: 'Використайте це як невелике оборотне дослідження перед зміною production-процесу.',
  labelEn: 'AI engineering',
  labelUk: 'AI-інженерія',
};

const CATEGORY_ACTIONS: Record<string, CategoryActions> = {
  'tools-and-releases': {
    en: 'Run a small pilot of the reported capability and compare time, quality, and cost with your current workflow before rollout.',
    uk: 'Проведіть невеликий пілот описаної можливості та порівняйте час, якість і вартість із поточним процесом перед впровадженням.',
    labelEn: 'tools and releases',
    labelUk: 'інструменти та релізи',
  },
  'tutorials-and-guides': {
    en: 'Turn the described steps into a short internal playbook, then validate them on a non-critical workflow.',
    uk: 'Перетворіть описані кроки на короткий внутрішній плейбук і перевірте їх на некритичному процесі.',
    labelEn: 'tutorials and guides',
    labelUk: 'туторіали та гайди',
  },
  optimization: {
    en: 'Measure the reported change on a representative task and record cost, latency, and output quality before changing production defaults.',
    uk: 'Виміряйте описану зміну на репрезентативному завданні й зафіксуйте вартість, затримку та якість результату перед зміною production-налаштувань.',
    labelEn: 'optimization',
    labelUk: 'оптимізація',
  },
  'agents-and-mcp': {
    en: 'Prototype the integration in a sandbox with explicit permissions and failure handling before connecting it to production tools.',
    uk: 'Створіть прототип інтеграції в ізольованому середовищі з явними дозволами та обробкою збоїв перед підключенням до production-інструментів.',
    labelEn: 'agents and MCP',
    labelUk: 'агенти та MCP',
  },
  'vibe-coding': {
    en: 'Try the workflow on one bounded task, keep a review checkpoint, and compare the result with your existing engineering standard.',
    uk: 'Спробуйте workflow на одному обмеженому завданні, залиште точку рев’ю та порівняйте результат із наявним інженерним стандартом.',
    labelEn: 'AI-assisted development',
    labelUk: 'AI-асистована розробка',
  },
  'creative-ai': {
    en: 'Test the approach on a clearly licensed, low-risk asset and review the output for brand, factual, and rights constraints.',
    uk: 'Перевірте підхід на чітко ліцензованому низькоризиковому активі та перегляньте результат щодо бренду, фактів і прав.',
    labelEn: 'creative AI',
    labelUk: 'креативний AI',
  },
  'local-llms': {
    en: 'Benchmark the reported approach on your own hardware and representative prompts before making privacy, cost, or deployment decisions.',
    uk: 'Перевірте описаний підхід на власному обладнанні та репрезентативних промптах перед рішеннями щодо приватності, вартості чи розгортання.',
    labelEn: 'local LLMs',
    labelUk: 'локальні LLM',
  },
  'career-and-money': {
    en: 'Use the reported change to update one concrete learning or delivery plan, then validate demand with a small real-world test.',
    uk: 'Використайте описану зміну, щоб оновити один конкретний план навчання чи delivery, а потім перевірте попит невеликим реальним тестом.',
    labelEn: 'career and business',
    labelUk: 'кар’єра та бізнес',
  },
  'models-and-research': {
    en: 'Reproduce the reported result on a representative workload before using it to make a model-selection or architecture decision.',
    uk: 'Відтворіть описаний результат на репрезентативному навантаженні перед вибором моделі чи архітектурним рішенням.',
    labelEn: 'models and research',
    labelUk: 'моделі та дослідження',
  },
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function unique(values: Iterable<string>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = clean(value);
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function factStrings(value: unknown): string[] {
  if (typeof value === 'string') return unique([value]);
  if (!Array.isArray(value)) return [];
  return unique(
    value.flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const record = entry as Record<string, unknown>;
      const label = clean(record.label);
      const factValue = clean(record.value);
      if (label && factValue) return [`${label}: ${factValue}`];
      return [record.fact, record.text, record.content, record.claim, record.value].flatMap(
        (candidate) => (typeof candidate === 'string' ? [candidate] : []),
      );
    }),
  );
}

function categoryFor(item: WeeklyEditorialSourceItem) {
  return CATEGORY_ACTIONS[item.category_slug ?? ''] ?? DEFAULT_CATEGORY;
}

function factsFor(item: WeeklyEditorialSourceItem, locale: Locale) {
  return factStrings(locale === 'uk' ? item.facts_uk : item.facts_en);
}

function summaryFor(item: WeeklyEditorialSourceItem, locale: Locale) {
  return clean(locale === 'uk' ? item.summary_uk : item.summary_en);
}

function titleFor(item: WeeklyEditorialSourceItem, locale: Locale) {
  return clean(locale === 'uk' ? item.title_uk : item.title_en);
}

function whyFor(item: WeeklyEditorialSourceItem, locale: Locale) {
  return clean(locale === 'uk' ? item.why_matters_uk : item.why_matters_en);
}

function bodyFor(item: WeeklyEditorialSourceItem, locale: Locale) {
  const summary = summaryFor(item, locale);
  const facts = factsFor(item, locale);
  const source = unique([summary, ...facts]).slice(0, 3);
  if (source.length > 0) return source.join(' ');
  return titleFor(item, locale);
}

function takeawayFor(item: WeeklyEditorialSourceItem, locale: Locale) {
  return whyFor(item, locale) || summaryFor(item, locale) || titleFor(item, locale);
}

function issueCategories(items: readonly WeeklyEditorialSourceItem[], locale: Locale) {
  return unique(
    items.map((item) => (locale === 'uk' ? categoryFor(item).labelUk : categoryFor(item).labelEn)),
  )
    .slice(0, 3)
    .join(locale === 'uk' ? ', ' : ', ');
}

function editorNote(items: readonly WeeklyEditorialSourceItem[], locale: Locale) {
  const categories = issueCategories(items, locale);
  if (locale === 'uk') {
    return `Цей випуск об’єднує ${items.length} перевірених новин про ${categories}. Почніть із фактів і коротких висновків до кожної історії, а практичні кроки перевіряйте на власному процесі перед змінами в production.`;
  }
  return `This edition brings together ${items.length} approved developments across ${categories}. Start with the facts and concise takeaway for each story, then validate the practical next step in your own workflow before changing production.`;
}

function keyTakeaways(items: readonly WeeklyEditorialSourceItem[], locale: Locale) {
  return items.map((item) => `${titleFor(item, locale)} — ${takeawayFor(item, locale)}`);
}

function assertStoryCount(items: readonly WeeklyEditorialSourceItem[]) {
  if (items.length < 3 || items.length > 7) {
    throw new Error('A Weekly Digest editorial draft requires 3 to 7 stories.');
  }
}

/**
 * Produces a reviewable starting draft from approved, already-bilingual source
 * content. It deliberately makes no network or model calls and never adds
 * source-specific claims beyond the supplied summary, why-it-matters text, and
 * facts. Category templates are generic next-step guidance.
 */
export function createWeeklyEditorialDraft(
  items: readonly WeeklyEditorialSourceItem[],
): WeeklyEditorialDraft {
  assertStoryCount(items);

  return {
    stories: items.map((item) => {
      const category = categoryFor(item);
      return {
        id: item.id,
        body_en: bodyFor(item, 'en'),
        body_uk: bodyFor(item, 'uk'),
        practical_en: category.en,
        practical_uk: category.uk,
        takeaway_en: takeawayFor(item, 'en'),
        takeaway_uk: takeawayFor(item, 'uk'),
      };
    }),
    editor_note_en: editorNote(items, 'en'),
    editor_note_uk: editorNote(items, 'uk'),
    key_takeaways_en: keyTakeaways(items, 'en'),
    key_takeaways_uk: keyTakeaways(items, 'uk'),
  };
}
