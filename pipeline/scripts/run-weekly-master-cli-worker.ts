/**
 * Drains `editorial_master` jobs through the normal generation worker, but
 * from a host where the Claude Code CLI subscription provider actually works
 * (a GitHub Actions runner — Vercel has no `claude` binary). Reuses
 * `runWeeklyDigestGenerationJobs` unchanged; the only difference from the
 * Vercel route is the job-type filter and where this process runs.
 *
 * Must run via `node --conditions=react-server --import tsx <this file>` —
 * generation-worker.ts imports `server-only`, which throws under a plain
 * `tsx` invocation outside Next's own build (see package.json's
 * `weekly:pdf:sample` script for the same pattern).
 */

import { runWeeklyDigestGenerationJobs } from '../../src/lib/weekly-digest/generation-worker';
import { logError, logEvent } from '../log';

const STAGE = 'weekly-master-cli-worker';
const BATCH_LIMIT = 2;
const MAX_BATCHES = 5;

// getSupabaseAdmin() (src/lib/supabase-admin.ts) resolves the URL/key from
// SCRAPPER_BASE_URL/SCRAPPER_SERVICE_KEY first, falling back to
// NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. This check must accept
// either pair -- requiring only the fallback names made every run fail before
// generation ever started once #168 switched this workflow to the
// SCRAPPER_* production secrets.
function requiredEnvPair(primary: string, fallback: string, label: string): void {
  if (!process.env[primary]?.trim() && !process.env[fallback]?.trim()) {
    throw new Error(`${label} is required: set ${primary} or ${fallback}.`);
  }
}

async function main(): Promise<void> {
  requiredEnvPair('SCRAPPER_BASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'Supabase URL');
  requiredEnvPair('SCRAPPER_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'Supabase service key');

  let totalClaimed = 0;
  let totalFailed = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { claimed, results } = await runWeeklyDigestGenerationJobs(BATCH_LIMIT, [
      'editorial_master',
    ]);
    totalClaimed += claimed;
    for (const result of results) {
      if (result.outcome === 'failed') totalFailed += 1;
      logEvent(result.outcome === 'failed' ? 'warn' : 'info', STAGE, 'editorial_master job finished', {
        job_id: result.id,
        outcome: result.outcome,
        error: result.error,
      });
    }
    if (claimed === 0) break;
  }
  logEvent('info', STAGE, 'drain complete', { claimed: totalClaimed, failed: totalFailed });
}

main().catch((error) => {
  logError(STAGE, 'worker run failed', error);
  process.exit(1);
});
