import { NextResponse, type NextRequest } from 'next/server';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SHORT_RUNNING_GENERATION_JOB_TYPES } from '@/lib/weekly-digest/generation-control';
import { dispatchQueuedWeeklyGenerationJob } from '@/lib/weekly-digest/github-dispatch';
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

// Supabase pg_net waits up to 55 seconds. Story image generation and PDF
// rasterization are intentionally claimed one at a time so the request remains
// inside that lease while the five-minute cron drains the queue progressively.
const GENERATION_BATCH_SIZE = 1;

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
    const [reaper, generation] = await Promise.all([
      reapStaleAttempts(),
      runWeeklyDigestGenerationJobs(
        GENERATION_BATCH_SIZE,
        [...SHORT_RUNNING_GENERATION_JOB_TYPES],
        {
          backend: 'vercel',
        },
      ),
    ]);
    let githubDispatched = false;
    let githubDispatchError: string | null = null;
    try {
      githubDispatched = await dispatchQueuedWeeklyGenerationJob();
    } catch (error) {
      githubDispatchError =
        error instanceof Error ? error.message.slice(0, 500) : 'github_dispatch_failed';
    }
    return NextResponse.json({ ...generation, reaper, githubDispatched, githubDispatchError });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'weekly_generation_failed' },
      { status: 500 },
    );
  }
}
