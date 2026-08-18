import type { SocialLocale } from '@/lib/social/types';
import type { WeeklyArticleMaster, WeeklyMasterBundle } from './content-studio';

function uniqueFacts(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const value of values) {
    const fact = value?.trim();
    if (!fact) continue;
    const key = fact.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(fact);
  }
  return facts;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function claimTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    const row = record(entry);
    for (const key of ['text', 'fact', 'claim', 'value']) {
      if (typeof row[key] === 'string' && row[key].trim()) return [row[key].trim()];
    }
    return [];
  });
}

export function weeklySocialArticleFacts(
  bundle: WeeklyMasterBundle,
  locale: SocialLocale,
): string[] {
  const article = locale === 'uk' ? bundle.uk : bundle.en;
  return articleFactsFromMaster(article);
}

export function articleFactsFromMaster(article: WeeklyArticleMaster): string[] {
  return uniqueFacts([
    article.title,
    article.standfirst,
    article.theme,
    article.intro,
    article.editorNote,
    ...article.keyTakeaways,
    article.conclusion,
    ...article.stories.flatMap((story) => [
      story.headline,
      story.summary,
      story.hook,
      story.body,
      story.why,
      story.practical,
      story.limitation,
      story.takeaway,
      story.editorsView,
    ]),
  ]);
}

export function articleFactsFromUnknownContent(content: unknown): string[] {
  const row = record(content);
  const takeaways = Array.isArray(row.keyTakeaways)
    ? row.keyTakeaways.filter((entry): entry is string => typeof entry === 'string')
    : Array.isArray(row.key_takeaways)
      ? row.key_takeaways.filter((entry): entry is string => typeof entry === 'string')
      : [];
  const stories = Array.isArray(row.stories) ? row.stories.map(record) : [];
  return uniqueFacts([
    typeof row.title === 'string' ? row.title : null,
    typeof row.standfirst === 'string' ? row.standfirst : null,
    typeof row.theme === 'string' ? row.theme : null,
    typeof row.intro === 'string' ? row.intro : null,
    typeof row.editorNote === 'string' ? row.editorNote : null,
    ...takeaways,
    typeof row.conclusion === 'string' ? row.conclusion : null,
    ...stories.flatMap((story) => [
      typeof story.headline === 'string' ? story.headline : null,
      typeof story.summary === 'string' ? story.summary : null,
      typeof story.hook === 'string' ? story.hook : null,
      typeof story.body === 'string' ? story.body : null,
      typeof story.why === 'string' ? story.why : null,
      typeof story.practical === 'string' ? story.practical : null,
      typeof story.limitation === 'string' ? story.limitation : null,
      typeof story.takeaway === 'string' ? story.takeaway : null,
      typeof story.editorsView === 'string' ? story.editorsView : null,
    ]),
  ]);
}

export interface WeeklySocialFactItem {
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  why_en?: string | null;
  why_uk?: string | null;
  practical_en?: string | null;
  practical_uk?: string | null;
  takeaway_en?: string | null;
  takeaway_uk?: string | null;
  source_snapshot?: unknown;
}

function itemFacts(item: WeeklySocialFactItem, locale: SocialLocale): string[] {
  const snapshot = record(item.source_snapshot);
  const claims =
    locale === 'uk'
      ? claimTexts(snapshot.facts_uk ?? snapshot.claims_uk ?? snapshot.claims)
      : claimTexts(snapshot.facts_en ?? snapshot.claims ?? snapshot.facts);
  return uniqueFacts([
    locale === 'uk' ? item.title_uk : item.title_en,
    locale === 'uk' ? item.summary_uk : item.summary_en,
    locale === 'uk' ? item.why_uk : item.why_en,
    locale === 'uk' ? item.practical_uk : item.practical_en,
    locale === 'uk' ? item.takeaway_uk : item.takeaway_en,
    ...claims,
  ]);
}

export function buildWeeklySocialFactSnapshot(input: {
  locale: SocialLocale;
  bundle?: WeeklyMasterBundle | null;
  articleContent?: unknown;
  items: WeeklySocialFactItem[];
}): string[] {
  const articleFacts = input.bundle
    ? weeklySocialArticleFacts(input.bundle, input.locale)
    : articleFactsFromUnknownContent(input.articleContent);
  return uniqueFacts([...articleFacts, ...input.items.flatMap((item) => itemFacts(item, input.locale))]);
}
