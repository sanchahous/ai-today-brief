import { NextResponse, type NextRequest } from 'next/server';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import { runWeeklyDigestGenerationJobs } from '@/lib/weekly-digest/generation-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Supabase pg_net waits up to 55 seconds. Story image generation and PDF
// rasterization are intentionally claimed one at a time so the request remains
// inside that lease while the five-minute cron drains the queue progressively.
const GENERATION_BATCH_SIZE = 1;

export async function POST(request: NextRequest) {
  if (!isInternalSocialRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runWeeklyDigestGenerationJobs(GENERATION_BATCH_SIZE));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'weekly_generation_failed' },
      { status: 500 },
    );
  }
}
