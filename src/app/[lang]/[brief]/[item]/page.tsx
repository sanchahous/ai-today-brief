import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, EDITOR_NAME, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getBriefItem, getPublishedItemPaths } from '@/lib/items';

export const revalidate = 1800;

type Params = { lang: string; brief: string; item: string };

export async function generateStaticParams() {
  return getPublishedItemPaths();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, brief, item } = await params;
  if (!isLang(lang)) return {};
  const detail = await getBriefItem(brief, item, lang);
  if (!detail) return {};
  const path = `/${lang}/${brief}/${item}`;
  return {
    title: detail.title,
    description: detail.summary,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/${brief}/${item}`,
        uk: `${SITE_URL}/uk/${brief}/${item}`,
        'x-default': `${SITE_URL}/en/${brief}/${item}`,
      },
    },
    openGraph: {
      title: detail.title,
      description: detail.summary,
      type: 'article',
      url: `${SITE_URL}${path}`,
      publishedTime: detail.publishedAt ?? undefined,
    },
  };
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function prettyCategory(slug: string | null): string {
  if (!slug) return 'AI';
  return slug.replace(/-/g, ' ').replace(/\band\b/g, '&');
}

export default async function ItemPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, brief, item } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const detail = await getBriefItem(brief, item, lang);
  if (!detail) notFound();
  const t = getStrings(lang);

  const dateStr = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${detail.briefDate}T00:00:00`));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: detail.title,
    description: detail.summary,
    datePublished: detail.publishedAt ?? detail.briefDate,
    inLanguage: lang,
    author: { '@type': 'Person', name: EDITOR_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/${lang}/${brief}/${item}`,
    ...(detail.sourceUrl ? { isBasedOn: detail.sourceUrl } : {}),
  };

  return (
    <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-faint mb-8 text-sm">
        <Link className="hover:text-text" href={`/${lang}`}>
          ← {t.home}
        </Link>
      </nav>

      <article>
        <span className="text-accent text-xs font-bold tracking-wider uppercase">
          {prettyCategory(detail.categorySlug)}
        </span>
        <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{detail.title}</h1>
        <p className="text-faint mt-4 text-sm">
          {dateStr} · {t.editedBy} {EDITOR_NAME}
        </p>

        <p className="mt-8 text-lg leading-relaxed">{detail.summary}</p>

        {detail.why && (
          <section className="border-border-soft bg-surface rounded-card mt-8 border p-5">
            <h2 className="text-accent text-sm font-bold tracking-wider uppercase">
              {t.whyItMatters}
            </h2>
            <p className="mt-2 leading-relaxed">{detail.why}</p>
          </section>
        )}

        {detail.takeaways.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl">{t.keyTakeaways}</h2>
            <ul className="mt-3 space-y-2">
              {detail.takeaways.map((tk, i) => (
                <li key={i} className="text-muted flex gap-3 leading-relaxed">
                  <span className="text-accent" aria-hidden>
                    —
                  </span>
                  <span>{tk}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {detail.deepDive && (
          <section className="mt-8 space-y-4 leading-relaxed">
            {paragraphs(detail.deepDive).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {detail.sourceUrl && (
          <p className="border-border-soft mt-10 border-t pt-6 text-sm">
            {t.source}:{' '}
            <a
              className="text-accent"
              href={detail.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {detail.sourceName ?? t.readOriginal} ↗
            </a>
          </p>
        )}
      </article>
    </main>
  );
}
