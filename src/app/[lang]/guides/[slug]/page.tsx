import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGuide, GUIDES } from '@/content/guides';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { MarkdownBody } from '@/components/markdown-body';
import { getStrings } from '@/lib/i18n';
import { EDITOR_NAME, isLang, LANGS, SITE_URL, type Lang } from '@/lib/site';
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

  const verifiedLabel = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${guide.lastVerified}T00:00:00`));

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

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10">
      <PageEngagementTracker pageType="guide" slug={slug} lang={lang} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <article>
        <h1 className="mb-3 text-[clamp(1.7rem,4vw,2.5rem)] leading-[1.15]">{guide.title[lang]}</h1>
        <p className="text-faint mb-6 text-[0.82rem]">
          {t.lastVerifiedLabel}: <strong className="text-muted">{verifiedLabel}</strong> ·{' '}
          {t.editedBy} {EDITOR_NAME}
        </p>

        <p className="mb-6 text-[1.08rem] leading-[1.7]">{guide.description[lang]}</p>

        <MarkdownBody markdown={guide.body[lang]} />
      </article>

      <p className="mt-10">
        <Link className="text-accent text-sm font-medium hover:underline" href={`/${lang}/guides`}>
          ← {t.allGuides}
        </Link>
      </p>
    </div>
  );
}
