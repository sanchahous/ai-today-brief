import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { authorNode, publisherNode } from '@/lib/schema';
import { getStrings } from '@/lib/i18n';
import { getConceptHub, getConceptPaths } from '@/lib/concepts';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { ConceptHeader } from '@/components/concept-header';
import { ConceptHubBody } from '@/components/concept-hub-body';
import { ConceptOtherChips } from '@/components/concept-other-chips';
import { PostFeed } from '@/components/post-feed';

// 24 h: concept hubs are evergreen and change only via the backfill workflow.
export const revalidate = 86400;

type Params = { lang: string; slug: string };

export async function generateStaticParams() {
  return getConceptPaths();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const hub = await getConceptHub(slug, lang, 1);
  if (!hub) return {};
  const path = `/${lang}/concepts/${slug}`;
  return {
    title: hub.concept.name,
    description: hub.concept.description || `${hub.concept.name} — ${SITE_NAME}`,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/concepts/${slug}`,
        uk: `${SITE_URL}/uk/concepts/${slug}`,
        'x-default': `${SITE_URL}/en/concepts/${slug}`,
      },
    },
  };
}

export default async function ConceptHubPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const hub = await getConceptHub(slug, lang);
  if (!hub) notFound();
  const t = getStrings(lang);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.nav.concepts, href: `/${lang}/concepts` },
    { label: hub.concept.name },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: hub.concept.name,
        description: hub.concept.description || undefined,
        url: `${SITE_URL}/${lang}/concepts/${slug}`,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: hub.stories.length,
          itemListElement: hub.stories.slice(0, 20).map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.title,
            url: `${SITE_URL}${it.href}`,
          })),
        },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
      {
        '@type': 'TechArticle',
        headline: hub.concept.name,
        description: hub.concept.description,
        inLanguage: lang,
        url: `${SITE_URL}/${lang}/concepts/${slug}`,
        author: authorNode(lang),
        publisher: publisherNode(),
      },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />
      <ConceptHeader
        lang={lang}
        concept={hub.concept}
        icon={hub.icon}
        storyCount={hub.stories.length}
      />
      <ConceptHubBody
        lang={lang}
        body={hub.concept.body}
        faq={hub.concept.faq}
        verification={hub.concept.verification}
        verifiedAt={hub.concept.verifiedAt}
      />
      {hub.stories.length > 0 && (
        <h2 className="mb-4 text-xl">{t.conceptLatest}</h2>
      )}
      <PostFeed key={slug} lang={lang} items={hub.stories} showNewsletter={false} />
      <ConceptOtherChips lang={lang} concepts={hub.others} />
    </div>
  );
}
