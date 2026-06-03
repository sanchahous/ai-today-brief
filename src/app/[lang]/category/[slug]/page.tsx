import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getCategory, getCategoryItems, getCategoryPaths } from '@/lib/categories';

export const revalidate = 3600;

type Params = { lang: string; slug: string };

export async function generateStaticParams() {
  return getCategoryPaths();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const category = await getCategory(slug, lang);
  if (!category) return {};
  const path = `/${lang}/category/${slug}`;
  return {
    title: category.name,
    description: category.description || `${category.name} — ${SITE_NAME}`,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/category/${slug}`,
        uk: `${SITE_URL}/uk/category/${slug}`,
        'x-default': `${SITE_URL}/en/category/${slug}`,
      },
    },
  };
}

function formatDate(value: string, lang: Lang): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const category = await getCategory(slug, lang);
  if (!category) notFound();
  const t = getStrings(lang);
  const items = await getCategoryItems(slug, lang);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: category.description || undefined,
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
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

      <header>
        <h1 className="text-3xl sm:text-4xl">{category.name}</h1>
        {category.description && (
          <p className="text-muted mt-4 max-w-2xl">{category.description}</p>
        )}
      </header>

      {items.length === 0 ? (
        <p className="text-muted mt-10">{t.noResults}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="rounded-card border-border bg-surface hover:border-accent block border p-5 transition-colors"
            >
              <span className="text-faint float-right text-xs">{formatDate(card.date, lang)}</span>
              <h2 className="text-lg leading-snug">{card.title}</h2>
              <p className="text-muted mt-2 line-clamp-3 text-sm">{card.summary}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
