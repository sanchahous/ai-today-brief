import type { Json } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';

interface WeeklySnapshot {
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  why_en: string;
  why_uk: string;
  item_slug: string;
  brief_slug: string;
  brief_date: string;
}

export interface DigestArchiveEntry {
  id: string;
  kind: 'daily' | 'weekly';
  date: string;
  slug: string;
  title: string;
  href: string;
}

export interface WeeklyDigestView {
  id: string;
  slug: string;
  weekStart: string;
  title: string;
  intro: string | null;
  publishedAt: string | null;
  items: Array<{
    id: string;
    rank: number;
    title: string;
    summary: string;
    why: string;
    href: string;
    date: string;
  }>;
}

function pick(lang: Lang, en: string | null | undefined, uk: string | null | undefined) {
  return ((lang === 'uk' ? uk : en) ?? en ?? uk ?? '').trim();
}

function snapshot(value: Json): WeeklySnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, Json | undefined>;
  const required = ['title_en', 'title_uk', 'summary_en', 'summary_uk', 'item_slug', 'brief_slug'];
  if (required.some((key) => typeof row[key] !== 'string')) return null;
  return {
    title_en: String(row.title_en),
    title_uk: String(row.title_uk),
    summary_en: String(row.summary_en),
    summary_uk: String(row.summary_uk),
    why_en: typeof row.why_en === 'string' ? row.why_en : '',
    why_uk: typeof row.why_uk === 'string' ? row.why_uk : '',
    item_slug: String(row.item_slug),
    brief_slug: String(row.brief_slug),
    brief_date: typeof row.brief_date === 'string' ? row.brief_date : '',
  };
}

export async function getDigestArchive(lang: Lang): Promise<DigestArchiveEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const [{ data: dailies }, { data: weeklies }] = await Promise.all([
    supabase
      .from('briefs')
      .select('id,date,slug,title_en,title_uk')
      .eq('status', 'published')
      .eq('edition', 1)
      .order('date', { ascending: false })
      .limit(45),
    supabase
      .from('weekly_digests')
      .select('id,week_start,slug,title_en,title_uk,published_at')
      .eq('status', 'published')
      .order('week_start', { ascending: false })
      .limit(20),
  ]);
  return [
    ...(weeklies ?? []).map((row) => ({
      id: row.id,
      kind: 'weekly' as const,
      date: row.week_start,
      slug: row.slug,
      title: pick(lang, row.title_en, row.title_uk),
      href: `/${lang}/weekly/${row.slug}`,
    })),
    ...(dailies ?? []).flatMap((row) =>
      row.slug
        ? [
            {
              id: row.id,
              kind: 'daily' as const,
              date: row.date,
              slug: row.slug,
              title: pick(lang, row.title_en, row.title_uk),
              href: `/${lang}/${row.slug}`,
            },
          ]
        : [],
    ),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getWeeklyDigest(slug: string, lang: Lang): Promise<WeeklyDigestView | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: digest } = await supabase
    .from('weekly_digests')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!digest) return null;
  const { data: rows } = await supabase
    .from('weekly_digest_items')
    .select('brief_item_id,rank,snapshot')
    .eq('weekly_digest_id', digest.id)
    .order('rank');
  const items = (rows ?? []).flatMap((row) => {
    const item = snapshot(row.snapshot);
    if (!item) return [];
    return [
      {
        id: row.brief_item_id,
        rank: row.rank,
        title: pick(lang, item.title_en, item.title_uk),
        summary: pick(lang, item.summary_en, item.summary_uk),
        why: pick(lang, item.why_en, item.why_uk),
        href: `/${lang}/${item.brief_slug}/${item.item_slug}`,
        date: item.brief_date,
      },
    ];
  });
  return {
    id: digest.id,
    slug: digest.slug,
    weekStart: digest.week_start,
    title: pick(lang, digest.title_en, digest.title_uk),
    intro: pick(lang, digest.intro_en, digest.intro_uk) || null,
    publishedAt: digest.published_at,
    items,
  };
}

export async function getWeeklySitemapEntries() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('weekly_digests')
    .select('slug,published_at,week_start')
    .eq('status', 'published');
  return data ?? [];
}
