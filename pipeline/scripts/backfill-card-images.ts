/**
 * Backfill `brief_items.card_image_url` for published items that predate the
 * card-image pipeline wiring (PR #129, 2026-06-25, which passed the Cloudflare
 * Workers AI secrets to the daily job). Items published before that have a NULL
 * card_image_url and render the branded duotone OG fallback; this fills them in.
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/backfill-card-images.ts [--dry-run]
 *        npx tsx --env-file=.env.local pipeline/scripts/backfill-card-images.ts --reencode-png [--dry-run]
 *
 * Idempotent: fillCardImages skips items that already have an image (or are
 * rejected), so re-running never regenerates or double-charges. `--reencode-png`
 * rewrites stored PNG origins to JPEG without an image-model call (no Cloudflare).
 */
import { loadPipelineConfig } from '../config';
import { fillCardImages, reencodeStoredCardOrigins } from '../card-image';
import { createServiceClient, type PipelineDb } from '../db';
import { logError, logEvent } from '../log';

const SLEEP_BETWEEN_BRIEFS_MS = 1_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Published briefs that still have at least one imageable item without a card. */
async function briefsMissingCardImages(db: PipelineDb): Promise<string[]> {
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
    .select('brief_id, slug, card_image_url, review_status')
    .in('brief_id', ids);
  if (iErr) throw new Error(`backfill items: ${iErr.message}`);

  // Mirror fillCardImages' own pending filter: slug present, not rejected, no card yet.
  const pending = new Set<string>();
  for (const it of items ?? []) {
    if (it.slug && it.review_status !== 'rejected' && !it.card_image_url) {
      pending.add(it.brief_id);
    }
  }
  // Preserve chronological order from the briefs query.
  return ids.filter((id) => pending.has(id));
}

async function main(): Promise<void> {
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const reencodePng = process.argv.includes('--reencode-png');
  if (reencodePng) {
    const stats = await reencodeStoredCardOrigins(db, { dryRun: config.dryRun });
    logEvent('info', 'publish', 'Card origin reencode finished', stats);
    return;
  }

  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    logEvent('warn', 'publish', 'Card-image backfill skipped — Cloudflare creds unset');
    return;
  }

  const briefIds = await briefsMissingCardImages(db);
  logEvent('info', 'publish', 'Card-image backfill started', { briefs: briefIds.length });
  if (briefIds.length === 0) return;

  if (config.dryRun) {
    logEvent('info', 'publish', 'Dry-run — no images written', { briefs: briefIds.length });
    return;
  }

  let generated = 0;
  let failed = 0;
  for (const briefId of briefIds) {
    const stats = await fillCardImages(db, briefId, {
      cloudflareAccountId: config.cloudflareAccountId,
      cloudflareApiToken: config.cloudflareApiToken,
      geminiApiKey: config.geminiApiKey,
      geminiImageModel: config.geminiImageModel,
      cloudflareImageModel: config.cloudflareImageModel,
      openRouterApiKey: config.openRouterApiKey,
    });
    generated += stats.generated;
    failed += stats.failed;
    logEvent('info', 'publish', 'Brief card images filled', { brief_id: briefId, ...stats });
    await sleep(SLEEP_BETWEEN_BRIEFS_MS);
  }
  logEvent('info', 'publish', 'Card-image backfill complete', {
    briefs: briefIds.length,
    generated,
    failed,
  });
}

main().catch((error) => {
  logError('publish', 'Card-image backfill failed', error);
  process.exit(1);
});
