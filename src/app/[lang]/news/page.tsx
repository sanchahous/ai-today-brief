import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getNewsList, searchNews } from '@/lib/news';

type Params = { lang: string };
type Search = { q?: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { q } = await searchParams;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l);
  return {
    title: t.nav.news,
    // Search result pages are not indexed (thin/duplicate); the base archive is.
    ...(q ? { robots: { index: false, follow: true } } : {}),
  };
}

function prettyCategory(slug: string | null): string {
  if (!slug) return 'AI';
  return slug.replace(/-/g, ' ').replace(/\band\b/g, '&');
}

function formatDate(value: string, lang: Lang): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const { q } = await searchParams;
  const t = getStrings(lang);

  const query = (q ?? '').trim();
  const cards = query ? await searchNews(lang, query) : await getNewsList(lang);

  return (
    <main className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-12">
      <h1 className="text-3xl sm:text-4xl">{t.nav.news}</h1>

      <form action={`/${lang}/news`} method="get" className="mt-6 flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t.searchPlaceholder}
          aria-label={t.search}
          className="border-border bg-surface focus:border-accent rounded-pill w-full border px-4 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-black"
        >
          {t.search}
        </button>
      </form>

      {cards.length === 0 ? (
        <p className="text-muted mt-10">{t.noResults}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="rounded-card border-border bg-surface hover:border-accent block border p-5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-accent text-xs font-bold tracking-wider uppercase">
                  {prettyCategory(card.category)}
                </span>
                <span className="text-faint text-xs">{formatDate(card.date, lang)}</span>
              </div>
              <h3 className="mt-3 text-lg leading-snug">{card.title}</h3>
              <p className="text-muted mt-2 line-clamp-3 text-sm">{card.summary}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
