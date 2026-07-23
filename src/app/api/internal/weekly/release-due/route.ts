import { NextResponse, type NextRequest } from 'next/server';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import {
  releaseDueWeeklyDigests,
  runDueWeeklyDigestPreflights,
} from '@/lib/weekly-digest/release-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isInternalSocialRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const preflight = await runDueWeeklyDigestPreflights(10);
    const release = await releaseDueWeeklyDigests(10);
    return NextResponse.json({ preflight, release });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'weekly_release_failed' },
      { status: 500 },
    );
  }
}
