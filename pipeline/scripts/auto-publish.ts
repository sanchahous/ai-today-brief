/**
 * Midnight (Kyiv) auto-publish for draft briefs the owner didn't get to
 * review — sweeps the accumulated pool of drafts from the last N days.
 * Usage: npx tsx pipeline/scripts/auto-publish.ts [--dry-run] [--date YYYY-MM-DD] [--window-days N]
 *
 * See pipeline/auto-publish.ts for the full flow.
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient } from '../db';
import { runAutoPublish, DEFAULT_AUTO_PUBLISH_WINDOW_DAYS } from '../auto-publish';
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

async function main(): Promise<void> {
  const argv = process.argv;
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  const options = {
    dryRun: argv.includes('--dry-run'),
    date: flagValue(argv, 'date'),
    windowDays: intFlag(argv, 'window-days', DEFAULT_AUTO_PUBLISH_WINDOW_DAYS),
  };

  logEvent('info', 'auto_publish', 'Starting auto-publish sweep', options);

  const result = await runAutoPublish(db, config, options);

  logEvent('info', 'auto_publish', 'Auto-publish sweep complete', {
    window_drafts: result.windowDrafts,
    stale_drafts: result.staleDrafts,
    awaiting_review: result.awaitingReview.length,
    dry_run: options.dryRun,
  });

  for (const outcome of result.outcomes) {
    console.log(
      `${outcome.date} pack ${outcome.edition}: ${outcome.action} — approved=${outcome.approved} rejected=${outcome.rejected}` +
        (outcome.hardRejected > 0 ? ` (hard=${outcome.hardRejected})` : '') +
        (outcome.unjudged > 0 ? ` unjudged=${outcome.unjudged}` : '') +
        (outcome.judgeUnavailable ? ' [judge unavailable]' : '') +
        (outcome.judgeError ? ` [judge: ${outcome.judgeError}]` : '') +
        (outcome.error ? ` [error: ${outcome.error}]` : ''),
    );
  }

  // A silent judge used to leave the workflow green. Exit non-zero so the
  // GitHub Actions run is red as well, not just the pipeline_runs row.
  const failed = result.outcomes.filter((o) => o.action === 'error' || o.error || o.judgeError);
  if (failed.length > 0) {
    logError(
      'auto_publish',
      'Auto-publish sweep finished with failures',
      new Error(failed.map((o) => `${o.date}: ${o.judgeError ?? o.error}`).join(' | ')),
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  logError('auto_publish', 'Auto-publish sweep failed', e);
  process.exit(1);
});
