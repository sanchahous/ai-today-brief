/**
 * Re-runs weekly story selection for a digest that already exists.
 *
 * The scheduled composer picks the stories once, at creation time. Until now
 * there was no way to redo that: a selection built by an older algorithm, or
 * before a daily brief in the same week finished review, was frozen for the
 * life of the digest. This runs the current selector over the same week and
 * mints a new active revision from the result.
 *
 * Deliberately destructive about downstream state: different stories mean the
 * previous revision's research packs, article, images and social copy no longer
 * describe this digest, so the RPC drops the digest back to `in_review` and
 * clears approvals. The old revision itself is never mutated — it stays in the
 * version list.
 */

import 'server-only';

import type { Json } from '@/lib/database.types';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadApprovedRange } from '@/lib/social/composer';
import {
  buildDigestSelectionContext,
  selectEditorialDigestItems,
} from '../../../pipeline/weekly-digest';
import { weeklyCandidates, weeklyStorySnapshot } from './selection-snapshot';

export interface RebuildSelectionResult {
  revisionId: string;
  selectedCount: number;
  candidateCount: number;
  eligibleCount: number;
  /** Stories in the rebuilt digest that were not in the previous revision. */
  addedCount: number;
  /** Stories dropped from the previous revision. */
  removedCount: number;
}

const MIN_STORIES = 3;

function snapshotField(snapshot: Json, key: string): string | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, Json | undefined>)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function rebuildWeeklySelection(
  weeklyDigestId: string,
): Promise<RebuildSelectionResult> {
  const db = getSupabaseAdmin();
  const { data: digest, error: digestError } = await db
    .from('weekly_digests')
    .select('id, week_start, week_end, status, active_revision_id')
    .eq('id', weeklyDigestId)
    .single();
  if (digestError || !digest) throw new Error('The Weekly Digest was not found.');
  if (!digest.active_revision_id) {
    throw new Error('This Weekly Digest has no active revision to replace yet.');
  }
  if (['publishing', 'published', 'cancelled'].includes(digest.status)) {
    throw new Error('A published or cancelled Weekly Digest can no longer be rebuilt.');
  }

  const { briefs, items, articles } = await loadApprovedRange(digest.week_start, digest.week_end);
  const selection = selectEditorialDigestItems(weeklyCandidates(items, briefs, articles));
  const context = buildDigestSelectionContext(selection);
  if (selection.selected.length < MIN_STORIES) {
    throw new Error(
      `Only ${selection.selected.length} of ${items.length} approved stories passed the evidence gates — at least ${MIN_STORIES} are required.`,
    );
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const briefById = new Map(briefs.map((brief) => [brief.id, brief]));
  const picks = selection.selected.flatMap(({ candidate }, index) => {
    const item = itemById.get(candidate.id);
    return item ? [{ item, scored: selection.selected[index]!, rank: index + 1 }] : [];
  });

  const { data: previousItems } = await db
    .from('weekly_digest_revision_items')
    .select('brief_item_id')
    .eq('revision_id', digest.active_revision_id);
  const previousIds = new Set(
    (previousItems ?? []).flatMap((row) => (row.brief_item_id ? [row.brief_item_id] : [])),
  );
  const nextIds = new Set(picks.map(({ item }) => item.id));

  const { error: runError } = await db.from('weekly_digest_selection_runs').insert({
    weekly_digest_id: weeklyDigestId,
    algorithm_version: selection.version,
    rationale_version: context.rationale.version,
    week_start: digest.week_start,
    week_end: digest.week_end,
    candidate_count: context.rationale.metrics.candidateCount,
    eligible_count: context.rationale.metrics.eligibleCount,
    rejected_count: context.rationale.metrics.rejectedCount,
    selected_count: context.rationale.metrics.selectedCount,
    rationale: context.rationale as unknown as Json,
    candidate_pool: context.candidates as unknown as Json,
  });
  if (runError) throw new Error(`Selection run could not be saved: ${runError.message}`);

  const snapshots = picks.map(({ item, scored, rank }) => ({
    briefItemId: item.id,
    rank,
    snapshot: weeklyStorySnapshot({
      item,
      scored,
      rank,
      briefSlug: briefById.get(item.brief_id)?.slug ?? null,
      briefDate: briefById.get(item.brief_id)?.date ?? null,
    }),
  }));

  await db.from('weekly_digest_items').delete().eq('weekly_digest_id', weeklyDigestId);
  const { error: itemsError } = await db.from('weekly_digest_items').insert(
    snapshots.map((entry) => ({
      weekly_digest_id: weeklyDigestId,
      brief_item_id: entry.briefItemId,
      rank: entry.rank,
      snapshot: entry.snapshot,
    })),
  );
  if (itemsError) throw new Error(`Selected stories could not be saved: ${itemsError.message}`);

  const rpcItems = snapshots.map((entry) => {
    const snapshot = entry.snapshot;
    const sourceUrl = ((): string | null => {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
      const selectionMeta = (snapshot as Record<string, Json | undefined>).editorial_selection;
      if (!selectionMeta || typeof selectionMeta !== 'object' || Array.isArray(selectionMeta)) {
        return null;
      }
      const url = (selectionMeta as Record<string, Json | undefined>).source_url;
      return typeof url === 'string' ? url : null;
    })();
    const sourceName = ((): string => {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 'Source';
      const selectionMeta = (snapshot as Record<string, Json | undefined>).editorial_selection;
      if (!selectionMeta || typeof selectionMeta !== 'object' || Array.isArray(selectionMeta)) {
        return 'Source';
      }
      const name = (selectionMeta as Record<string, Json | undefined>).source_name;
      return typeof name === 'string' && name.trim() ? name : 'Source';
    })();
    return {
      brief_item_id: entry.briefItemId,
      rank: entry.rank,
      title_en: snapshotField(snapshot, 'title_en'),
      title_uk: snapshotField(snapshot, 'title_uk'),
      summary_en: snapshotField(snapshot, 'summary_en'),
      summary_uk: snapshotField(snapshot, 'summary_uk'),
      body_en: snapshotField(snapshot, 'body_en'),
      body_uk: snapshotField(snapshot, 'body_uk'),
      why_en: snapshotField(snapshot, 'why_en'),
      why_uk: snapshotField(snapshot, 'why_uk'),
      practical_en: snapshotField(snapshot, 'practical_en'),
      practical_uk: snapshotField(snapshot, 'practical_uk'),
      takeaway_en: snapshotField(snapshot, 'takeaway_en'),
      takeaway_uk: snapshotField(snapshot, 'takeaway_uk'),
      event_date: snapshotField(snapshot, 'brief_date'),
      sources: sourceUrl ? [{ name: sourceName, url: sourceUrl }] : [],
      source_snapshot: snapshot,
    };
  });

  const { data: revisionId, error: rpcError } = await db.rpc('rebuild_weekly_digest_selection', {
    p_weekly_digest_id: weeklyDigestId,
    p_items: rpcItems as unknown as Json,
    p_reason: `selection_rebuild:${selection.version}`,
  });
  if (rpcError || typeof revisionId !== 'string') {
    throw new Error(`The rebuilt selection could not be saved: ${rpcError?.message ?? 'no revision returned'}`);
  }

  return {
    revisionId,
    selectedCount: picks.length,
    candidateCount: context.rationale.metrics.candidateCount,
    eligibleCount: context.rationale.metrics.eligibleCount,
    addedCount: [...nextIds].filter((id) => !previousIds.has(id)).length,
    removedCount: [...previousIds].filter((id) => !nextIds.has(id)).length,
  };
}
