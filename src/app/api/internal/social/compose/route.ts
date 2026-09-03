import { NextResponse, type NextRequest } from 'next/server';
import { composeRecentDailySocial, composeWeeklySocial } from '@/lib/social/composer';
import { isInternalSocialRequest } from '@/lib/social/internal-auth';
import { kyivDateFor, SOCIAL_TIME_ZONE } from '@/lib/social/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isSunday(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function isSundayMorningInKyiv(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SOCIAL_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  return weekday === 'Sun' && Number.isInteger(hour) && hour >= 9;
}

export async function POST(request: NextRequest) {
  if (!isInternalSocialRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    date?: unknown;
    includeWeekly?: unknown;
    windowDays?: unknown;
  };
  const now = new Date();
  const date =
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : kyivDateFor(now);
  const windowDays =
    typeof body.windowDays === 'number' && Number.isInteger(body.windowDays) && body.windowDays > 0
      ? body.windowDays
      : undefined;
  try {
    const daily = await composeRecentDailySocial({ endDate: date, now, windowDays });
    const weekly =
      body.includeWeekly === true || (isSunday(date) && isSundayMorningInKyiv())
        ? await composeWeeklySocial(date)
        : null;
    return NextResponse.json({ date, daily, weekly });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'compose_failed' },
      { status: 500 },
    );
  }
}
