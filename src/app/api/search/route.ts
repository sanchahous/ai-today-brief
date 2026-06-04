import { NextResponse } from 'next/server';
import { searchNewsWithMeta } from '@/lib/news';
import { isLang, type Lang } from '@/lib/site';

const PREVIEW_MAX = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const rawLang = searchParams.get('lang');
  const lang: Lang = isLang(rawLang) ? rawLang : 'en';
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get('limit') ?? '5', 10) || 5, 1),
    PREVIEW_MAX,
  );

  if (!q) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const { items, total } = await searchNewsWithMeta(lang, q, limit);
  return NextResponse.json({
    items: items.map((it) => ({
      id: it.id,
      href: it.href,
      title: it.title,
      date: it.date,
      categoryName: it.categoryName,
      categoryColor: it.categoryColor,
      sourceName: it.sourceName,
    })),
    total,
  });
}
