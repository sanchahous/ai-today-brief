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

function requiredEnv(name: string): void {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required.`);
}

async function main(): Promise<void> {
  requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

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
