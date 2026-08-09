/**
 * Runs exactly one long Weekly Digest job through the normal generation worker
 * from a host where the Claude Code CLI subscription
 * provider actually works (a GitHub Actions runner — Vercel has no `claude`
 * binary). Both stages prefer the same $0-marginal-cost provider ladder, so
 * they share this worker rather than each needing their own dispatch route.
 * The job id + dispatch token are fenced by PostgreSQL, so a late or duplicate
 * GitHub run cannot complete a lease claimed by a newer worker.
 *
 * Must run via `node --conditions=react-server --import tsx <this file>` —
 * generation-worker.ts imports `server-only`, which throws under a plain
 * `tsx` invocation outside Next's own build (see package.json's
 * `weekly:pdf:sample` script for the same pattern).
 */

import { runWeeklyDigestGenerationJobs } from '../../src/lib/weekly-digest/generation-worker';
import { logError, logEvent } from '../log';

const STAGE = 'weekly-master-cli-worker';
const LONG_JOB_TYPES = ['editorial_master', 'social_copy', 'video_script'];

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

  const jobId = process.env.WEEKLY_GENERATION_JOB_ID?.trim();
  const dispatchToken = process.env.WEEKLY_GENERATION_DISPATCH_TOKEN?.trim();
  if (!jobId || !dispatchToken) {
    throw new Error('WEEKLY_GENERATION_JOB_ID and WEEKLY_GENERATION_DISPATCH_TOKEN are required.');
  }
  const { claimed, results } = await runWeeklyDigestGenerationJobs(1, [...LONG_JOB_TYPES], {
    backend: 'github_actions',
    jobId,
    dispatchToken,
    externalRunId: process.env.GITHUB_RUN_ID?.trim(),
    externalRunUrl: process.env.GITHUB_RUN_URL?.trim(),
  });
  for (const result of results) {
    logEvent(
      result.outcome === 'failed' ? 'warn' : 'info',
      STAGE,
      `${result.jobType ?? 'weekly'} job finished`,
      {
        job_id: result.id,
        outcome: result.outcome,
        error: result.error,
      },
    );
  }
  if (claimed !== 1) {
    throw new Error(`Expected to claim dispatched job ${jobId}, claimed ${claimed}.`);
  }
  logEvent('info', STAGE, 'single job complete', { job_id: jobId, claimed });
}

main().catch((error) => {
  logError(STAGE, 'worker run failed', error);
  process.exit(1);
});
