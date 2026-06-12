/**
 * Backfill `brief_item_embeddings` for published briefs that predate the
 * semantic-dedup pipeline (everything before 2026-06-06 has no embeddings,
 * so a resurfacing story from that window would not be caught).
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/backfill-embeddings.ts [--dry-run]
 *
 * Idempotent: storeItemEmbeddings upserts on brief_item_id, and briefs whose
 * items are already fully embedded are skipped without an API call.
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient, storeItemEmbeddings, type PipelineDb } from '../db';
import { createEmbedder } from '../embeddings';
import { logError, logEvent } from '../log';

const SLEEP_BETWEEN_BRIEFS_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function briefsMissingEmbeddings(db: PipelineDb): Promise<string[]> {
  const { data: briefs, error: bErr } = await db
    .from('briefs')
    .select('id')
    .eq('status', 'published')
    .order('date', { ascending: true });
  if (bErr) throw new Error(`backfill briefs: ${bErr.message}`);
  const ids = (briefs ?? []).map((b) => b.id);
  if (ids.length === 0) return [];

  const { data: items, error: iErr } = await db
    .from('brief_items')
    .select('id, brief_id')
    .in('brief_id', ids);
  if (iErr) throw new Error(`backfill items: ${iErr.message}`);

  // brief_item_embeddings is not in the generated Database type yet.
  const { data: embedded, error: eErr } = await (db as any)
    .from('brief_item_embeddings')
    .select('brief_item_id');
  if (eErr) throw new Error(`backfill embeddings: ${(eErr as { message: string }).message}`);
  const done = new Set(
    ((embedded ?? []) as { brief_item_id: string }[]).map((r) => r.brief_item_id),
  );

  const pending = new Set<string>();
  for (const it of items ?? []) {
    if (!done.has(it.id)) pending.add(it.brief_id);
  }
  // Preserve chronological order from the briefs query.
  return ids.filter((id) => pending.has(id));
}

async function main(): Promise<void> {
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  const briefIds = await briefsMissingEmbeddings(db);
  logEvent('info', 'embed', 'Embedding backfill started', { briefs: briefIds.length });
  if (briefIds.length === 0) return;

  if (config.dryRun) {
    logEvent('info', 'embed', 'Dry-run — no embeddings written', { briefs: briefIds.length });
    return;
  }

  const embed = createEmbedder(config.geminiApiKey);
  let total = 0;
  for (const briefId of briefIds) {
    const stored = await storeItemEmbeddings(db, briefId, embed);
    total += stored;
    logEvent('info', 'embed', 'Brief embedded', { brief_id: briefId, stored });
    await sleep(SLEEP_BETWEEN_BRIEFS_MS);
  }
  logEvent('info', 'embed', 'Embedding backfill complete', { briefs: briefIds.length, total });
}

main().catch((error) => {
  logError('embed', 'Embedding backfill failed', error);
  process.exit(1);
});
