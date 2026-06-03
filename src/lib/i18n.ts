import type { Lang } from '@/lib/site';

/** UI strings. Every user-facing label ships in both EN and UK in the same change. */
export const STRINGS = {
  en: {
    eyebrow: 'Daily AI-engineering brief',
    heroLede:
      'Curated, human-edited signal for people who build with AI — models, frameworks, MLOps. One brief a day. No hype.',
    nav: {
      news: 'News',
      concepts: 'Concepts',
      agents: 'Agents & MCP',
      vibeCoding: 'Vibe coding',
      tools: 'Tools',
    },
    subscribe: 'Subscribe',
    todaysBrief: 'Today’s brief',
    allNews: 'All news',
    sampleBadge: 'Sample — connect Supabase env to go live',
    editedBy: 'Edited by',
    whyItMatters: 'Why it matters',
    keyTakeaways: 'Key takeaways',
    source: 'Source',
    readOriginal: 'Read the original',
    home: 'Home',
    search: 'Search',
    searchPlaceholder: 'Search the archive…',
    noResults: 'Nothing found.',
    conceptsLede: 'Evergreen explainers for the building blocks of AI engineering.',
    relatedCoverage: 'Related coverage',
    officialSite: 'Official site',
    lastUpdated: 'Last updated',
    legalDraft: 'Draft — pending legal review. Honest first-draft wording, not legal advice.',
    about: 'About',
    aiDisclosure: 'AI disclosure',
    privacy: 'Privacy',
    terms: 'Terms',
    footerTagline: 'The daily AI-engineering brief. Built in public. EN · UK.',
    rights: 'All rights reserved.',
  },
  uk: {
    eyebrow: 'Щоденний бриф з AI-інженерії',
    heroLede:
      'Курований, відредагований людиною сигнал для тих, хто будує з AI — моделі, фреймворки, MLOps. Один бриф на день. Без хайпу.',
    nav: {
      news: 'Новини',
      concepts: 'Концепти',
      agents: 'Агенти й MCP',
      vibeCoding: 'Vibe coding',
      tools: 'Інструменти',
    },
    subscribe: 'Підписатися',
    todaysBrief: 'Бриф сьогодні',
    allNews: 'Усі новини',
    sampleBadge: 'Зразок — підключіть Supabase env для живих даних',
    editedBy: 'Редактор —',
    whyItMatters: 'Чому це важливо',
    keyTakeaways: 'Ключові висновки',
    source: 'Джерело',
    readOriginal: 'Читати першоджерело',
    home: 'Головна',
    search: 'Пошук',
    searchPlaceholder: 'Пошук в архіві…',
    noResults: 'Нічого не знайдено.',
    conceptsLede: 'Evergreen-пояснення про будівельні блоки AI-інженерії.',
    relatedCoverage: 'Пов’язані матеріали',
    officialSite: 'Офіційний сайт',
    lastUpdated: 'Оновлено',
    legalDraft:
      'Чернетка — очікує юридичного рев’ю. Чесне формулювання-чернетка, не юридична консультація.',
    about: 'Про нас',
    aiDisclosure: 'AI-розкриття',
    privacy: 'Приватність',
    terms: 'Умови',
    footerTagline: 'Щоденний бриф з AI-інженерії. Build in public. EN · UK.',
    rights: 'Усі права захищені.',
  },
} as const;

export function getStrings(lang: Lang) {
  return STRINGS[lang];
}
