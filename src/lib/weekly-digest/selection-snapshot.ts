/**
 * Shared weekly-selection plumbing: turning a week of approved daily items into
 * scored digest candidates, and turning a pick into the stored story snapshot.
 *
 * Extracted from the social composer so the "rebuild selection" action runs the
 * *same* code the scheduled composer runs. Two implementations of this mapping
 * would drift, and a rebuild that selects differently from the nightly job is
 * worse than no rebuild button at all.
 */

import 'server-only';

import type { Json } from '@/lib/database.types';
import {
  citationUrlsFromUnknown,
  factCountFromUnknown,
  WEEKLY_SELECTION_VERSION,
  type DigestCandidate,
  type ScoredDigestCandidate,
} from '../../../pipeline/weekly-digest';
import { canonicalSourceName, placementForRank } from './content-studio';
import { seedStoryContent, type SeedStorySource } from './seed-content';

export interface WeeklySourceBrief {
  id: string;
  date: string;
  slug: string;
}

export interface WeeklySourceItem extends SeedStorySource {
  id: string;
  brief_id: string;
  article_id?: string;
  canonical_item_id?: string | null;
  rank: number;
  slug: string;
  impact_level: string | null;
  category_slug: string | null;
  title_en: string;
  title_uk: string;
  why_matters_en: string;
  why_matters_uk: string;
  facts_en: Json | null;
  facts_uk: Json | null;
  citations?: Json | null;
  card_image_url: string | null;
}

export interface WeeklySourceArticle {
  id: string;
  source_name: string;
  url: string;
  composite_score: number | null;
  score_cross_source: number | null;
  score_breadth: number | null;
  score_version: number | null;
  cluster_id: string | null;
  mentions_count: number | null;
}

function text(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function weeklyCandidates(
  items: readonly WeeklySourceItem[],
  briefs: readonly WeeklySourceBrief[],
  articles: readonly WeeklySourceArticle[],
): DigestCandidate[] {
  const dateByBrief = new Map(briefs.map((brief) => [brief.id, brief.date]));
  const articleById = new Map(articles.map((article) => [article.id, article]));
  return items.flatMap((item) => {
    const article = item.article_id ? articleById.get(item.article_id) : undefined;
    const briefDate = dateByBrief.get(item.brief_id);
    if (!article || !briefDate || !item.slug || !item.article_id) return [];
    return [
      {
        id: item.id,
        articleId: item.article_id,
        canonicalItemId: item.canonical_item_id ?? null,
        title_en: text(item.title_en),
        title_uk: text(item.title_uk),
        summary_en: text(item.summary_en),
        summary_uk: text(item.summary_uk),
        why_matters_en: text(item.why_matters_en),
        why_matters_uk: text(item.why_matters_uk),
        impact_level: item.impact_level,
        category_slug: item.category_slug,
        itemSlug: item.slug,
        date: briefDate,
        rank: item.rank,
        citationUrls: citationUrlsFromUnknown(item.citations),
        factsEnCount: factCountFromUnknown(item.facts_en),
        factsUkCount: factCountFromUnknown(item.facts_uk),
        sourceName: article.source_name,
        sourceUrl: article.url,
        compositeScore: article.composite_score,
        crossSourceScore: article.score_cross_source,
        breadthScore: article.score_breadth,
        scoreVersion: article.score_version,
        clusterId: article.cluster_id,
        mentionsCount: article.mentions_count ?? 1,
      },
    ];
  });
}

export interface WeeklyStorySnapshotInput {
  item: WeeklySourceItem;
  scored: ScoredDigestCandidate | undefined;
  rank: number;
  briefSlug: string | null;
  briefDate: string | null;
}

/**
 * The stored story snapshot. Seeded copy comes from the daily item's long-form
 * fields (`seedStoryContent`) — never a duplicate of a neighbouring field.
 */
export function weeklyStorySnapshot(input: WeeklyStorySnapshotInput): Json {
  const { item, scored, rank } = input;
  const seedEn = seedStoryContent(item, 'en');
  const seedUk = seedStoryContent(item, 'uk');
  return {
    title_en: item.title_en,
    title_uk: item.title_uk,
    summary_en: item.summary_en,
    summary_uk: item.summary_uk,
    why_en: item.why_matters_en,
    why_uk: item.why_matters_uk,
    body_en: seedEn.body,
    body_uk: seedUk.body,
    practical_en: seedEn.practical,
    practical_uk: seedUk.practical,
    takeaway_en: seedEn.takeaway,
    takeaway_uk: seedUk.takeaway,
    facts_en: item.facts_en,
    facts_uk: item.facts_uk,
    placement: placementForRank(rank),
    item_slug: item.slug,
    brief_slug: input.briefSlug,
    brief_date: input.briefDate,
    card_image_url: item.card_image_url,
    editorial_selection: scored
      ? {
          version: WEEKLY_SELECTION_VERSION,
          score: scored.score,
          diversity_penalty: scored.diversityPenalty,
          adjusted_score: scored.adjustedScore,
          breakdown: scored.breakdown,
          reasons: scored.reasons,
          source_name: canonicalSourceName(scored.candidate.sourceUrl),
          source_url: scored.candidate.sourceUrl,
          cluster_id: scored.candidate.clusterId,
          impact_level: scored.candidate.impact_level,
          category_slug: scored.candidate.category_slug,
          citation_urls: scored.candidate.citationUrls,
        }
      : null,
  } as unknown as Json;
}
