/**
 * Stage 4 — Publish. Upserts articles, the day's brief, and syncs brief_items.
 * Published briefs stay published; new items append as `pending` for review.
 * Draft briefs get a full slug sync (reorder + drop removed slugs).
 */

import {
  getBriefByDate,
  syncBriefItems,
  syncBriefItemConcepts,
  upsertArticles,
  upsertBriefForDate,
  type PipelineDb,
} from './db';
import type { FetchedArticle } from './sources/http';
import type { DraftBrief } from './summarize';
import { logEvent } from './log';

export interface PublishResult {
  briefId: string;
  itemCount: number;
  insertedCount: number;
  briefWasPublished: boolean;
}

export async function publish(
  db: PipelineDb,
  date: string,
  fetched: FetchedArticle[],
  brief: DraftBrief,
  generatedBy: string,
): Promise<PublishResult> {
  const existing = await getBriefByDate(db, date);
  const appendOnly = existing?.status === 'published';

  const articleIdByUrl = await upsertArticles(db, fetched);
  const briefId = await upsertBriefForDate(db, date, brief, generatedBy, existing?.status);
  const { synced, inserted } = await syncBriefItems(db, briefId, brief.items, articleIdByUrl, {
    appendOnly,
  });
  const conceptLinks = await syncBriefItemConcepts(db, briefId);
  logEvent('info', 'publish', appendOnly ? 'Published brief appended' : 'Draft brief written', {
    brief_id: briefId,
    date,
    synced,
    inserted,
    concept_links: conceptLinks,
    status: appendOnly ? 'published' : 'draft',
  });
  return {
    briefId,
    itemCount: synced,
    insertedCount: inserted,
    briefWasPublished: appendOnly,
  };
}
