import { NextResponse, type NextRequest } from 'next/server';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SHORT_RUNNING_GENERATION_JOB_TYPES } from '@/lib/weekly-digest/generation-control';
import { dispatchQueuedWeeklyGenerationJobs } from '@/lib/weekly-digest/github-dispatch';
import { runWeeklyDigestGenerationJobs } from '@/lib/weekly-digest/generation-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A master run performs EN writing, UK adaptation and an independent critic
// sequentially. Keep the platform limit explicit so Hobby staging and production
// execute the same contract and stale-lock recovery remains predictable.
// Confirmed 2026-08-03: this plan is capped at 300s (Vercel rejects the build
// above it on Hobby) -- social_copy's six-channel loop must checkpoint per
// channel instead of relying on a longer single invocation.
export const maxDuration = 300;

// Supabase pg_net waits up to 55 seconds. The remaining Vercel work is claimed
// one at a time so PDF rasterization cannot exhaust the request lease. Semantic
// story images use dedicated long-lived workers because their provider/vision
// loop no longer fits this serverless budget.
const GENERATION_BATCH_SIZE = 1;
const GITHUB_DISPATCH_BATCH_SIZE = 10;

interface ReaperRpc {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

async function reapStaleAttempts() {
  const db = getSupabaseAdmin() as unknown as ReaperRpc;
  const { data, error } = await db.rpc('reap_stale_weekly_digest_generation_attempts');
  if (error) throw new Error(`[weekly-generation] reaper: ${error.message}`);
  return data;
}

export async function POST(request: NextRequest) {
  if (!isInternalSocialRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    // Dispatch long jobs at the start of the poll. A short Vercel render can
    // consume the entire request budget, so putting dispatch after it stranded
    // otherwise-independent work until the next cron (or forever on a 504).
    const [reaper, generation, githubDispatch] = await Promise.all([
      reapStaleAttempts(),
      runWeeklyDigestGenerationJobs(
        GENERATION_BATCH_SIZE,
        [...SHORT_RUNNING_GENERATION_JOB_TYPES],
        {
          backend: 'vercel',
        },
      ),
      dispatchQueuedWeeklyGenerationJobs(GITHUB_DISPATCH_BATCH_SIZE),
    ]);
    return NextResponse.json({
      ...generation,
      reaper,
      githubDispatched: githubDispatch.dispatched > 0,
      githubDispatchCount: githubDispatch.dispatched,
      githubDispatchError: githubDispatch.error,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'weekly_generation_failed' },
      { status: 500 },
    );
  }
}
