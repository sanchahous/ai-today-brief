/**
 * Retroactive semantic-duplicate scan over the published archive.
 * Usage: npx tsx pipeline/scripts/dedup-scan.ts [--dry-run] [--backfill]
 *          [--window-days N] [--max-distance N] [--max-pairs N]
 *
 * See pipeline/dedup-scan.ts for the full flow. `--backfill` widens the scan
 * to every pair in the window (recent_days=0) instead of just pairs whose
 * later side published recently — use it for a one-time sweep of the archive.
 *
 * Merge strategy follows `--backfill`: without it (the nightly default), a
 * confirmed later duplicate is hard-deleted (it just published, unlikely to
 * be indexed yet). With `--backfill`, it's redirected via `canonical_item_id`
 * instead — safer for older articles Google may already have indexed.
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient } from '../db';
import { runDedupScan } from '../dedup-scan';
import { logError, logEvent } from '../log';

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}

function intFlag(argv: string[], name: string, fallback: number): number {
  const raw = flagValue(argv, name);
  const n = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function floatFlag(argv: string[], name: string, fallback: number): number {
  const raw = flagValue(argv, name);
  const n = raw !== undefined ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

async function main(): Promise<void> {
  const argv = process.argv;
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  const options = {
    dryRun: argv.includes('--dry-run'),
    backfill: argv.includes('--backfill'),
    windowDays: intFlag(argv, 'window-days', 45),
    maxDistance: floatFlag(argv, 'max-distance', 0.3),
    maxPairs: intFlag(argv, 'max-pairs', 200),
  };

  logEvent('info', 'dedup_scan', 'Starting dedup scan', options);

  const result = await runDedupScan(db, config, options);

  logEvent('info', 'dedup_scan', 'Dedup scan complete', {
    pairs_candidate: result.pairsCandidate,
    pairs_confirmed: result.pairsConfirmed,
    clusters: result.clusters,
    merged: result.merged,
    merge_action: result.mergeAction,
    model: result.model,
    dry_run: options.dryRun,
  });

  if (options.dryRun && result.mergedIds.length > 0) {
    console.log(
      result.mergeAction === 'delete' ? 'Would delete (dupe, kept canonical):' : 'Would redirect (dupe → canonical):',
    );
    for (const [dupe, canonical] of result.mergedIds) console.log(`  ${dupe} → ${canonical}`);
  }
}

main().catch((e) => {
  logError('dedup_scan', 'Dedup scan failed', e);
  process.exit(1);
});
