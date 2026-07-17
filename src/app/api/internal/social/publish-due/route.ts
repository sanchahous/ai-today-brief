import { NextResponse, type NextRequest } from 'next/server';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import { publishDueSocialPosts } from '@/lib/social/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isInternalSocialRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await publishDueSocialPosts(10));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'worker_failed' },
      { status: 500 },
    );
  }
}
