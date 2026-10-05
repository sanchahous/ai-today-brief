import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGuide, GUIDES } from '@/content/guides';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { ReadingLayout, TableOfContents } from '@/components/editorial';
import { MarkdownBody } from '@/components/markdown-body';
import { Byline } from '@/components/byline';
import { GuideToolsAside } from '@/components/guides/guide-tools-aside';
import { CheckIcon } from '@/components/guides/guide-icons';
import { extractToc } from '@/lib/markdown';
import { getStrings } from '@/lib/i18n';
import { EDITOR_NAME, EDITOR_ROLE, isLang, LANGS, SITE_URL, type Lang } from '@/lib/site';
import { authorNode, publisherNode } from '@/lib/schema';
import { socialMeta } from '@/lib/seo';
import { PageEngagementTracker } from '@/components/analytics/page-engagement-tracker';

export const revalidate = 86400;

type Params = { lang: string; slug: string };

export function generateStaticParams() {
  return LANGS.flatMap((lang) => GUIDES.map((g) => ({ lang, slug: g.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title[lang],
    description: guide.description[lang],
    alternates: {
      canonical: `${SITE_URL}/${lang}/guides/${slug}`,
      languages: {
        en: `${SITE_URL}/en/guides/${slug}`,
        uk: `${SITE_URL}/uk/guides/${slug}`,
        'x-default': `${SITE_URL}/en/guides/${slug}`,
      },
    },
    openGraph: {
      title: guide.title[lang],
      description: guide.description[lang],
      type: 'article',
      url: `${SITE_URL}/${lang}/guides/${slug}`,
      modifiedTime: guide.lastVerified,
    },
    ...socialMeta({
      title: guide.title[lang],
      description: guide.description[lang],
      path: `/${lang}/guides/${slug}`,
      lang,
      type: 'article',
      modifiedTime: guide.lastVerified,
    }),
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const t = getStrings(lang);

  const dateFmt = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const verifiedLabel = dateFmt.format(new Date(`${guide.lastVerified}T00:00:00`));

  const firstPubLabel = dateFmt.format(new Date('2026-06-11T00:00:00'));

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.guidesTitle, href: `/${lang}/guides` },
    { label: guide.title[lang] },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: guide.title[lang],
        description: guide.description[lang],
        dateModified: guide.lastVerified,
        inLanguage: lang,
        isAccessibleForFree: true,
        url: `${SITE_URL}/${lang}/guides/${slug}`,
        author: authorNode(lang),
        publisher: publisherNode(),
        mainEntityOfPage: `${SITE_URL}/${lang}/guides/${slug}`,
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  const tocItems = [
    ...extractToc(guide.body[lang]),
    {
      id: 'changelog',
      title: 'Changelog',
      level: 2,
    },
  ];

  return (
    <div className="w-full flex-1 py-8 sm:py-10">
      <PageEngagementTracker pageType="guide" slug={slug} lang={lang} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8 xl:px-10 mb-8 sm:mb-10">
        <Breadcrumbs items={crumbs} />

        <header className="mt-6 max-w-[800px]">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-muted">
              {guide.level[lang]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-signal/55 bg-surface px-2.5 py-1 text-2xs font-medium text-signal">
              <CheckIcon size={14} className="text-signal" />
              <span>
                {t.lastVerifiedLabel} <time dateTime={guide.lastVerified}>{verifiedLabel}</time>
              </span>
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-text mb-4 leading-tight">
            {guide.title[lang]}
          </h1>

          <p className="text-lg sm:text-xl text-muted leading-relaxed mb-6 max-w-[70ch]">
            {guide.description[lang]}
          </p>

          <Byline
            lang={lang}
            initials="OK"
            authorName={EDITOR_NAME}
            role={EDITOR_ROLE[lang]}
            publishedAt={guide.lastVerified}
            updatedAt={guide.lastVerified}
            minutes={guide.read}
          />
        </header>
      </div>

      <ReadingLayout
        toc={<TableOfContents lang={lang} items={tocItems} />}
        content={
          <article>
            <MarkdownBody markdown={guide.body[lang]} lang={lang} />

            <section
              id="changelog"
              aria-labelledby="changelog-title"
              className="mt-12 pt-8 border-t border-border"
            >
              <h2 id="changelog-title" className="font-serif text-2xl font-bold mb-4 text-text">
                Changelog
              </h2>
              <ol className="divide-y divide-border list-none p-0 m-0">
                <li className="grid grid-cols-[140px_1fr] gap-4 py-3 text-sm">
                  <time dateTime={guide.lastVerified} className="font-mono text-xs text-faint">
                    {verifiedLabel}
                  </time>
                  <span className="text-text">
                    {lang === 'uk'
                      ? 'Повторно перевірено; структурних змін немає.'
                      : 'Re-verified; no structural changes.'}
                  </span>
                </li>
                <li className="grid grid-cols-[140px_1fr] gap-4 py-3 text-sm">
                  <time dateTime="2026-06-11" className="font-mono text-xs text-faint">
                    {firstPubLabel}
                  </time>
                  <span className="text-text">
                    {lang === 'uk' ? 'Перша публікація.' : 'First published.'}
                  </span>
                </li>
              </ol>
            </section>

            <div className="mt-8 pt-6 border-t border-border lg:hidden">
              <Link
                className="text-accent text-sm font-medium hover:underline inline-flex items-center gap-1.5 min-h-[44px]"
                href={`/${lang}/guides`}
              >
                ← {t.allGuides}
              </Link>
            </div>
          </article>
        }
        tools={
          <GuideToolsAside
            lang={lang}
            slug={slug}
            readMinutes={guide.read}
            sectionsCount={guide.sections}
          />
        }
      />
    </div>
  );
}
