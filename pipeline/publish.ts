/**
 * Stage 4 — Publish. Upserts articles, resolves the day's brief pack, syncs items.
 * Each published pack is a separate brief row; the site aggregates packs by date.
 */

import {
  resolveBriefForPipeline,
  syncBriefItems,
  syncBriefItemConcepts,
  upsertArticles,
  type ArticleScores,
  type PipelineDb,
} from './db';
import type { FetchedArticle } from './sources/http';
import type { DraftBrief } from './summarize';
import { logEvent } from './log';

export interface PublishResult {
  briefId: string;
  edition: number;
  itemCount: number;
  insertedCount: number;
  isNewPack: boolean;
}

export async function publish(
  db: PipelineDb,
  date: string,
  fetched: FetchedArticle[],
  brief: DraftBrief,
  generatedBy: string,
  scoresByUrl?: ArticleScores,
): Promise<PublishResult> {
  const articleIdByUrl = await upsertArticles(db, fetched, scoresByUrl);
  const resolved = await resolveBriefForPipeline(db, date, brief, generatedBy);
  const { synced, inserted } = await syncBriefItems(
    db,
    resolved.id,
    brief.items,
    articleIdByUrl,
  );
  const conceptLinks = await syncBriefItemConcepts(db, resolved.id);
  logEvent('info', 'publish', resolved.isNewPack ? 'New brief pack written' : 'Draft pack refreshed', {
    brief_id: resolved.id,
    date,
    edition: resolved.edition,
    synced,
    inserted,
    concept_links: conceptLinks,
    status: 'draft',
  });
  return {
    briefId: resolved.id,
    edition: resolved.edition,
    itemCount: synced,
    insertedCount: inserted,
    isNewPack: resolved.isNewPack,
  };
}
