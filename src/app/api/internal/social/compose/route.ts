import { NextResponse, type NextRequest } from 'next/server';
import { composeDailySocial, composeWeeklySocial } from '@/lib/social/composer';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import { SOCIAL_TIME_ZONE } from '@/lib/social/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function kyivDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isSunday(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

export async function POST(request: NextRequest) {
  if (!isInternalSocialRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    date?: unknown;
    includeWeekly?: unknown;
  };
  const date =
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : kyivDate();
  try {
    const daily = await composeDailySocial(date);
    const weekly =
      body.includeWeekly === true || isSunday(date) ? await composeWeeklySocial(date) : null;
    return NextResponse.json({ date, daily, weekly });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'compose_failed' },
      { status: 500 },
    );
  }
}
