import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EDITOR_NAME, isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getConceptNameIndex } from '@/lib/concepts';
import { getBriefItem, getPublishedItemPaths, getRelatedStories } from '@/lib/items';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { Byline } from '@/components/byline';
import { AiDisclosureNote } from '@/components/ai-disclosure-note';
import { CategoryBadge } from '@/components/home/category-badge';
import { CategoryBanner } from '@/components/category-banner';
import { StoryBody } from '@/components/story-body';
import { ItemShareBar } from '@/components/item-share-bar';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { Reveal } from '@/components/reveal';
import { ArrowRight, ClockIcon, ExternalLinkIcon, PlayIcon } from '@/components/icons';

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

export default async function ItemPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, brief, item } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const detail = await getBriefItem(brief, item, lang);
  if (!detail) notFound();
  const t = getStrings(lang);
  const tNews = getStrings(lang).news;
  const pagePath = `/${lang}/${brief}/${item}`;

  const dateLabel = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${detail.briefDate}T00:00:00`));

  const conceptIndex = await getConceptNameIndex();
  const toolLinks = detail.tools.map((name) => {
    const slug = conceptIndex.get(name.toLowerCase());
    return {
      name,
      href: slug ? `/${lang}/concepts/${slug}` : null,
    };
  });

  const related =
    detail.categorySlug != null
      ? await getRelatedStories(lang, detail.categorySlug, detail.id)
      : [];

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.nav.news, href: `/${lang}/news` },
    ...(detail.categorySlug
      ? [
          {
            label: detail.categoryName ?? detail.categorySlug,
            href: `/${lang}/category/${detail.categorySlug}`,
          },
        ]
      : []),
    { label: detail.title },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        headline: detail.title,
        description: detail.summary,
        articleBody: detail.deepDive || detail.summary,
        datePublished: detail.publishedAt ?? detail.briefDate,
        dateModified: detail.publishedAt ?? detail.briefDate,
        inLanguage: lang,
        url: `${SITE_URL}${pagePath}`,
        author: { '@type': 'Person', name: EDITOR_NAME },
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        mainEntityOfPage: `${SITE_URL}${pagePath}`,
        ...(detail.sourceUrl
          ? { citation: [{ '@type': 'CreativeWork', name: detail.sourceName ?? detail.sourceUrl }] }
          : {}),
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  const color = detail.categoryColor ?? '#888888';

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <article>
        <div className="mb-4">
          <CategoryBadge name={detail.categoryName} color={detail.categoryColor} size="md" />
        </div>

        <h1 className="mb-3 text-[clamp(1.9rem,4.5vw,2.9rem)] leading-[1.12]">{detail.title}</h1>

        <div className="text-faint mb-4 flex flex-wrap items-center gap-2 text-[0.82rem]">
          {detail.sourceName && <span>{detail.sourceName}</span>}
          {detail.sourceName && (
            <span aria-hidden className="text-faint">
              ·
            </span>
          )}
          <span>{dateLabel}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon size={13} /> {detail.readMinutes} {tNews.readMin}
          </span>
          {detail.hasVideo && (
            <>
              <span aria-hidden>·</span>
              <span
                className="cat-fg inline-flex items-center gap-1 font-semibold"
                style={{ '--cat-color': color } as React.CSSProperties}
              >
                <PlayIcon size={13} /> {t.landing.watchVideo}
              </span>
            </>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Byline lang={lang} updated={detail.briefDate} />
          <AiDisclosureNote lang={lang} />
        </div>

        <Reveal>
          <div className="mb-6">
            <CategoryBanner
              name={detail.categoryName ?? 'AI'}
              color={color}
              icon={detail.categoryIcon}
              motif={detail.rank}
              videoBadge={detail.hasVideo}
              videoLabel={t.landing.watchVideo}
            />
          </div>
        </Reveal>

        <p className="mb-5 text-[1.1rem] leading-[1.7]">{detail.summary}</p>

        <StoryBody lang={lang} detail={detail} toolLinks={toolLinks} />

        {detail.sourceUrl && (
          <a
            href={detail.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-card border-border bg-surface text-text mt-6 inline-flex items-center gap-2 border px-3.5 py-2.5 text-[0.88rem] no-underline transition hover:border-accent"
          >
            {t.itemSource}: <strong>{detail.sourceName ?? t.readOriginal}</strong>
            <ExternalLinkIcon size={14} />
          </a>
        )}

        <ItemShareBar lang={lang} pageUrl={pagePath} title={detail.title} />
      </article>

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-4 text-xl">
            {t.itemRelated}
          </h2>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {related.map((story) => (
              <li key={story.id}>
                <Link
                  href={story.href}
                  className="rounded-card border-border bg-surface hover:border-accent flex items-center gap-3 border p-3.5 no-underline transition"
                >
                  <CategoryBadge name={story.categoryName} color={story.categoryColor} />
                  <span className="font-serif min-w-0 flex-1 text-base font-semibold text-[color:inherit]">
                    {story.title}
                  </span>
                  <ArrowRight size={16} className="text-faint shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <NewsletterBand lang={lang} embedded />
      </section>
    </div>
  );
}
