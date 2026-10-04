import { NextResponse } from 'next/server';
import { getDigestArchiveMoreData, type DigestArchiveFilter } from '@/lib/digests-archive';
import { isLang, type Lang } from '@/lib/site';

function parseFilter(value: string | null): DigestArchiveFilter {
  if (value === 'daily' || value === 'weekly') return value;
  return 'all';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const langRaw = url.searchParams.get('lang');
  const lang: Lang = langRaw && isLang(langRaw) ? langRaw : 'en';
  const filter = parseFilter(url.searchParams.get('type'));
  const initialMonthKey = url.searchParams.get('month');

  const payload = await getDigestArchiveMoreData(lang, filter, initialMonthKey);
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
