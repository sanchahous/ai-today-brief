import { NextResponse, type NextRequest } from 'next/server';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import { runWeeklyDigestGenerationJobs } from '@/lib/weekly-digest/generation-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A master run performs EN writing, UK adaptation and an independent critic
// sequentially; social_copy writes+critiques six channels independently. Both
// can outrun 300s once a provider fallback is involved (e.g. Gemini down,
// every call forced onto slower OpenRouter streaming). 800s is the documented
// ceiling for Pro + Fluid Compute; if the plan doesn't support it Vercel caps
// it at deploy time.
export const maxDuration = 800;

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
