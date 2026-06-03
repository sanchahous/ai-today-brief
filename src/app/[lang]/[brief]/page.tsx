import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getBriefBySlug, getBriefPaths } from '@/lib/briefs';

export const revalidate = 1800;

type Params = { lang: string; brief: string };

export async function generateStaticParams() {
  return getBriefPaths();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, brief } = await params;
  if (!isLang(lang)) return {};
  const b = await getBriefBySlug(brief, lang);
  if (!b) return {};
  const path = `/${lang}/${brief}`;
  return {
    title: b.title || b.date,
    description: b.intro ?? undefined,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/${brief}`,
        uk: `${SITE_URL}/uk/${brief}`,
        'x-default': `${SITE_URL}/en/${brief}`,
      },
    },
  };
}

function prettyCategory(slug: string | null): string {
  if (!slug) return 'AI';
  return slug.replace(/-/g, ' ').replace(/\band\b/g, '&');
}

function dateLabel(value: string, lang: Lang): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default async function BriefPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, brief: slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const b = await getBriefBySlug(slug, lang);
  if (!b) notFound();
  const t = getStrings(lang);
  const dateStr = dateLabel(b.date, lang);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: b.title || dateStr,
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: b.items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: it.slug ? `${SITE_URL}/${lang}/${b.slug}/${it.slug}` : undefined,
        name: it.title,
      })),
    },
  };

  return (
    <main className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-faint mb-8 text-sm">
        <Link className="hover:text-text" href={`/${lang}/news`}>
          ← {t.nav.news}
        </Link>
      </nav>

      <header className="border-border-soft border-b pb-8">
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{dateStr}</p>
        <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{b.title || t.todaysBrief}</h1>
        {b.intro && <p className="text-muted mt-4 max-w-2xl text-lg">{b.intro}</p>}
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {b.items.map((card) => (
          <Link
            key={card.id}
            href={card.slug ? `/${lang}/${b.slug}/${card.slug}` : `/${lang}/news`}
            className="rounded-card border-border bg-surface hover:border-accent block border p-5 transition-colors"
          >
            <span className="text-accent text-xs font-bold tracking-wider uppercase">
              {prettyCategory(card.categorySlug)}
            </span>
            <h2 className="mt-3 text-lg leading-snug">{card.title}</h2>
            <p className="text-muted mt-2 line-clamp-3 text-sm">{card.why}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
