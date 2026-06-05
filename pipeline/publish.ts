/**
 * Stage 4 — Publish. Writes the day's work to Supabase as a **draft**: upsert the
 * raw articles (audit trail + FK targets), upsert the brief on its unique date,
 * and replace its items wholesale. A human flips `briefs.status` to 'published'
 * (the editorial gate — curation moat + AI Act human oversight). Idempotent: a
 * second run for the same date refreshes the draft instead of duplicating it.
 */

import {
  replaceBriefItems,
  upsertArticles,
  upsertBriefDraft,
  type PipelineDb,
} from './db';
import type { FetchedArticle } from './sources/http';
import type { DraftBrief } from './summarize';
import { logEvent } from './log';

export interface PublishResult {
  briefId: string;
  itemCount: number;
}

export async function publish(
  db: PipelineDb,
  date: string,
  fetched: FetchedArticle[],
  brief: DraftBrief,
  generatedBy: string,
): Promise<PublishResult> {
  const articleIdByUrl = await upsertArticles(db, fetched);
  const briefId = await upsertBriefDraft(db, date, brief, generatedBy);
  const itemCount = await replaceBriefItems(db, briefId, brief.items, articleIdByUrl);
  logEvent('info', 'publish', 'Draft brief written', {
    brief_id: briefId,
    date,
    items: itemCount,
    status: 'draft',
  });
  return { briefId, itemCount };
}
