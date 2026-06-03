/**
 * Long-form editorial content (About / methodology / trust copy + subscribe
 * value props). Kept out of copy.ts so that file stays a flat "chrome label"
 * dictionary while multi-paragraph prose lives here as structured data.
 * Every string is publish-ready in Ukrainian (primary) and English.
 */
import type { Lang, IconKey } from './data';

type Bi = Record<Lang, string>;

/** About → "how it works" — the curation pipeline, shown as numbered steps. */
export interface MethodStep {
  title: Bi;
  body: Bi;
}

export const METHODOLOGY: MethodStep[] = [
  {
    title: { uk: 'Збір', en: 'Collect' },
    body: {
      uk: 'Щодня автоматично читаємо сотні джерел: офіційні блоги лабораторій і вендорів, релізи на GitHub, arXiv, технічні медіа та профільні спільноти.',
      en: 'Every day we automatically read hundreds of sources: official lab and vendor blogs, GitHub releases, arXiv, tech media and developer communities.',
    },
  },
  {
    title: { uk: 'Ранжування', en: 'Rank' },
    body: {
      uk: 'Прозора формула зважує швидкість обговорення, згадки в кількох джерелах, авторитет джерела та свіжість — щоб нагору виходило справді важливе, а не найгучніше.',
      en: 'A transparent formula weighs discussion velocity, cross-source mentions, source authority and freshness — so what surfaces is what matters, not what is loudest.',
    },
  },
  {
    title: { uk: 'Аналіз', en: 'Summarise' },
    body: {
      uk: 'Для кожної відібраної новини модель готує чернетку: коротке резюме, блок «чому це важливо» та ключові висновки — українською й англійською.',
      en: 'For each selected story a model drafts a short summary, a “why it matters” block and key takeaways — in Ukrainian and English.',
    },
  },
  {
    title: { uk: 'Редактура людиною', en: 'Human review' },
    body: {
      uk: 'Перед публікацією бриф проходить через редактора-людину: перевірка фактів, тон, відсів дублів і хайпу. Публікуємо вибране, а не все підряд.',
      en: 'Before publishing, the brief passes a human editor: fact-checks, tone, de-duplication and hype removal. We publish the selected few, not everything.',
    },
  },
  {
    title: { uk: 'Публікація', en: 'Publish' },
    body: {
      uk: 'Затверджений бриф виходить на сайт, у email-дайджест і Telegram. Кожна новина має посилання на першоджерело й позначку про участь AI.',
      en: 'The approved brief ships to the site, the email digest and Telegram. Every story links to its primary source and carries an AI-involvement label.',
    },
  },
];

export const SOURCES: Bi[] = [
  { uk: 'Офіційні блоги AI-лабораторій і вендорів', en: 'Official AI lab & vendor blogs' },
  { uk: 'Релізи та changelog на GitHub', en: 'GitHub releases & changelogs' },
  { uk: 'arXiv та дослідницькі препринти', en: 'arXiv & research preprints' },
  { uk: 'Технічні медіа й розсилки', en: 'Tech media & newsletters' },
  { uk: 'Профільні спільноти (HN, Reddit, Discord)', en: 'Developer communities (HN, Reddit, Discord)' },
];

/** About → intro paragraphs. */
export const ABOUT_INTRO: Bi[] = [
  {
    uk: 'AI Brief — щоденний curated-дайджест найважливіших новин зі світу штучного інтелекту, зроблений для розробників, AI-практиків і tech-лідів. Ми не женемося за обсягом: обробляємо десятки матеріалів усередині, а публікуємо лише ті, що реально змінюють вашу роботу.',
    en: 'AI Brief is a daily curated digest of the most important AI news, made for developers, AI practitioners and tech leads. We don’t chase volume: we process dozens of items internally and publish only the ones that actually change how you work.',
  },
  {
    uk: 'Наш підхід — швидкість і консистентність плюс жива людська редактура. AI допомагає читати й сумаризувати, але рішення «що важливо» та фінальна вичитка лишаються за людиною. Так ми тримаємо довіру, на якій будується продукт.',
    en: 'Our approach is speed and consistency plus live human editing. AI helps read and summarise, but the “what matters” decision and the final edit stay with a human. That is how we keep the trust the product is built on.',
  },
];

/** About → AI-disclosure policy bullets (E-E-A-T + AI Act art. 50 intent). */
export const DISCLOSURE_POINTS: Bi[] = [
  {
    uk: 'Чернетки резюме й перекладів готує мовна модель; кожен опублікований матеріал вичитує редактор-людина.',
    en: 'A language model drafts summaries and translations; a human editor reviews every published item.',
  },
  {
    uk: 'Кожна новина має видиме посилання на першоджерело — ми агрегуємо й пояснюємо, а не видаємо чуже за своє.',
    en: 'Every story carries a visible link to its primary source — we aggregate and explain, we don’t pass others’ work off as our own.',
  },
  {
    uk: 'Участь AI позначена машинозчитувано та для людини — відповідно до духу EU AI Act (art. 50, застосовується з 02.08.2026).',
    en: 'AI involvement is labelled both machine-readably and for humans — in the spirit of the EU AI Act (art. 50, applicable from 2026-08-02).',
  },
];

/** Subscribe landing → value props. */
export interface Benefit {
  icon: IconKey;
  title: Bi;
  body: Bi;
}

export const SUBSCRIBE_BENEFITS: Benefit[] = [
  {
    icon: 'optimization',
    title: { uk: '5 хвилин замість годин', en: '5 minutes, not hours' },
    body: {
      uk: 'Один лист щоранку з топ-новинами та аналізом. Ми читаємо сотні джерел, щоб ви не мусили.',
      en: 'One email each morning with the top stories and analysis. We read hundreds of sources so you don’t have to.',
    },
  },
  {
    icon: 'tools',
    title: { uk: 'Сигнал, а не шум', en: 'Signal, not noise' },
    body: {
      uk: 'Лише те, що змінює вашу роботу: релізи інструментів, агенти, дослідження та практичні гайди.',
      en: 'Only what changes your work: tool releases, agents, research and practical guides.',
    },
  },
  {
    icon: 'career',
    title: { uk: 'Без спаму, повний контроль', en: 'No spam, full control' },
    body: {
      uk: 'Підтвердження через double opt-in, відписка в один клік, жодного продажу даних третім сторонам.',
      en: 'Double opt-in confirmation, one-click unsubscribe, and we never sell your data to third parties.',
    },
  },
];

// ─── Advertise / media kit ────────────────────────────────────────────────────
// Mock numbers for the prototype — the real media kit ships once the list grows.

export interface AdStat {
  value: string;
  label: Bi;
}

export const AUDIENCE_STATS: AdStat[] = [
  { value: '24,800+', label: { uk: 'підписників', en: 'subscribers' } },
  { value: '>40%', label: { uk: 'open rate', en: 'open rate' } },
  { value: '78%', label: { uk: 'розробники й tech-ліди', en: 'developers & tech leads' } },
  { value: 'EN · UK', label: { uk: 'двомовна аудиторія', en: 'bilingual audience' } },
];

export interface AdSlot {
  name: Bi;
  placement: Bi;
  note: Bi;
}

export const AD_INVENTORY: AdSlot[] = [
  {
    name: { uk: 'Основний спонсор розсилки', en: 'Primary newsletter sponsor' },
    placement: { uk: 'Email · над згином', en: 'Email · above the fold' },
    note: { uk: '1 на випуск · нативний блок із disclosure', en: '1 per issue · native, disclosed' },
  },
  {
    name: { uk: 'Deep-dive розміщення', en: 'Deep-dive placement' },
    placement: { uk: 'Email + сайт', en: 'Email + site' },
    note: { uk: 'Розгорнутий формат · 3–6× ставки', en: 'Long-form · 3–6× the primary rate' },
  },
  {
    name: { uk: 'Нативний слот у фіді', en: 'Native feed unit' },
    placement: { uk: 'Сайт · стрічка новин', en: 'Site · news feed' },
    note: { uk: 'Позначено «Партнерський», із трекінгом CTR', en: 'Labelled “Sponsored”, CTR-tracked' },
  },
  {
    name: { uk: 'Слот на сторінці матеріалу', en: 'Item-page slot' },
    placement: { uk: 'Сайт · перманлінк', en: 'Site · permalink' },
    note: { uk: 'Контекстне розміщення за темою', en: 'Contextual, by topic' },
  },
];

export const ADVERTISE_BENEFITS: Bi[] = [
  {
    uk: 'Залучена нішева аудиторія розробників і AI-практиків, а не випадковий трафік.',
    en: 'An engaged, niche audience of developers and AI practitioners — not random traffic.',
  },
  {
    uk: 'Нативні, чесно позначені розміщення, що не ламають досвід читання.',
    en: 'Native, clearly disclosed placements that don’t break the reading experience.',
  },
  {
    uk: 'Прозора звітність: реальні impressions і CTR із власної аналітики.',
    en: 'Transparent reporting: real impressions and CTR from our own analytics.',
  },
];
