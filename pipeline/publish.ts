/**
 * Stage 4 — Publish. Writes the day's work to Supabase as a **draft**: upsert the
 * raw articles (audit trail + FK targets), upsert the brief on its unique date,
 * and replace its items wholesale. A human flips `briefs.status` to 'published'
 * (the editorial gate — curation moat + AI Act human oversight). Idempotent: a
 * second run for the same date refreshes the draft instead of duplicating it.
 */

import {
  getBriefByDate,
  replaceBriefItems,
  syncBriefItemConcepts,
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
  /** True when the write was skipped because the date's brief is already published. */
  skipped?: boolean;
}

/**
 * Safety guard: never let a re-run overwrite a brief a human already published.
 * A still-`draft` brief for the same date is the idempotent-refresh case and is
 * NOT a conflict.
 */
export function isPublishedConflict(existing: { status: string } | null | undefined): boolean {
  return existing?.status === 'published';
}

export async function publish(
  db: PipelineDb,
  date: string,
  fetched: FetchedArticle[],
  brief: DraftBrief,
  generatedBy: string,
): Promise<PublishResult> {
  const existing = await getBriefByDate(db, date);
  if (isPublishedConflict(existing)) {
    logEvent('warn', 'publish', 'Brief already published for this date — skipping to avoid overwrite', {
      date,
      brief_id: existing!.id,
    });
    return { briefId: existing!.id, itemCount: 0, skipped: true };
  }

  const articleIdByUrl = await upsertArticles(db, fetched);
  const briefId = await upsertBriefDraft(db, date, brief, generatedBy);
  const itemCount = await replaceBriefItems(db, briefId, brief.items, articleIdByUrl);
  const conceptLinks = await syncBriefItemConcepts(db, briefId);
  logEvent('info', 'publish', 'Draft brief written', {
    brief_id: briefId,
    date,
    items: itemCount,
    concept_links: conceptLinks,
    status: 'draft',
  });
  return { briefId, itemCount };
}
