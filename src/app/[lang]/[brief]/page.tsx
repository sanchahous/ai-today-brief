import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getAdjacentDailyBriefs, getDailyBriefBySlug, getBriefPaths } from '@/lib/briefs';
import { briefDateParts, firstPracticeStep, openingTakeaways } from '@/lib/daily-edition';
import { getConceptNameIndex, getConcepts, type ConceptSummary } from '@/lib/concepts';
import { socialMeta } from '@/lib/seo';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { BriefDailySections } from '@/components/brief-daily-sections';
import { ConceptOtherChips } from '@/components/concept-other-chips';
import { DailyHero } from '@/components/daily/daily-hero';
import { DailyBriefFinale, DailyIssueToc, DailyReadProvider } from '@/components/daily/daily-read-state';
import { DailyPractice } from '@/components/daily/daily-item';
import { EditionNav } from '@/components/daily/edition-nav';
import { CategoryBadge } from '@/components/ui/category-badge';
import { NewsletterForm } from '@/components/home/newsletter-form';

// 24 h: a brief's content is fixed at publish; new briefs render on first hit
// (dynamicParams). Short windows here only burned ISR writes via bot crawls.
export const revalidate = 86400;

type Params = { lang: string; brief: string };

export async function generateStaticParams() {
  return getBriefPaths();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, brief } = await params;
  if (!isLang(lang)) return {};
  const b = await getDailyBriefBySlug(brief, lang);
  if (!b) return {};
  const path = `/${lang}/${b.canonicalSlug}`;
  // intro → first item summary → title. A real sentence beats an empty or
  // duplicated-brand description for SERP snippets and social cards.
  const description =
    b.intro?.trim() || b.allItems[0]?.summary.trim() || `${b.title || b.date} — ${SITE_NAME}`;
  const social = socialMeta({
    title: b.title || b.date,
    description,
    path,
    lang,
    type: 'article',
  });
  return {
    title: b.title || b.date,
    description,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/${b.canonicalSlug}`,
        uk: `${SITE_URL}/uk/${b.canonicalSlug}`,
        'x-default': `${SITE_URL}/en/${b.canonicalSlug}`,
      },
    },
    ...social,
    ...(b.visual
      ? {
          openGraph: {
            ...social.openGraph,
            images: [
              {
                url: b.visual.publicUrl,
                width: b.visual.width,
                height: b.visual.height,
                alt: b.visual.alt,
              },
            ],
          },
          twitter: { ...social.twitter, images: [b.visual.publicUrl] },
        }
      : {}),
  };
}

export default async function BriefPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, brief: slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const b = await getDailyBriefBySlug(slug, lang);
  if (!b?.canonicalSlug) notFound();
  const t = getStrings(lang);
  const dateParts = briefDateParts(b.date, lang);
  const dateStr = dateParts?.full ?? b.date;

  // Hub-and-spoke: surface the concept hubs this day's items mention, so
  // every daily page links back into the evergreen layer (crawl path for
  // pages otherwise reachable only via the sitemap).
  const [conceptIndex, allConcepts, neighbors] = await Promise.all([
    getConceptNameIndex(),
    getConcepts(lang),
    getAdjacentDailyBriefs(b.date, lang),
  ]);
  const conceptBySlug = new Map(allConcepts.map((c) => [c.slug, c]));
  const seenConcepts = new Set<string>();
  const briefConcepts: ConceptSummary[] = [];
  for (const item of b.allItems) {
    for (const tool of item.tools) {
      const conceptSlug = conceptIndex.get(tool.toLowerCase());
      if (!conceptSlug || seenConcepts.has(conceptSlug)) continue;
      seenConcepts.add(conceptSlug);
      const concept = conceptBySlug.get(conceptSlug);
      if (concept) briefConcepts.push(concept);
    }
  }

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.nav.digests, href: `/${lang}/digests` },
    { label: dateParts ? `${t.dailyCrumb} · ${dateParts.short}` : t.dailyCrumb },
  ];
  const takeaways = openingTakeaways(b.allItems);
  const practice = firstPracticeStep(b.allItems);
  const tocItems = b.allItems.map((item, index) => ({
    id: item.id,
    index: index + 1,
    title: item.title,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: b.title || dateStr,
        description: b.intro ?? undefined,
        url: `${SITE_URL}/${lang}/${b.canonicalSlug}`,
        datePublished: b.date,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: b.allItems.length,
          itemListElement: b.allItems.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.title,
            ...(it.slug && it.categorySlug
              ? { url: `${SITE_URL}/${lang}/news/${it.categorySlug}/${it.slug}` }
              : {}),
          })),
        },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <DailyReadProvider lang={lang} itemIds={b.allItems.map((item) => item.id)}>
        <DailyHero brief={b} lang={lang} />

        {takeaways.length > 0 ? (
          <section className="mb-10" aria-labelledby="thirty-title">
            <h2 id="thirty-title" className="font-serif text-2xl">
              {t.briefIn30}
            </h2>
            <ul className="m-0 grid list-none gap-3 p-0">
              {takeaways.map((line, index) => (
                <li key={`${line.text}-${index}`} className="flex flex-wrap items-start gap-3">
                  <CategoryBadge slug={line.categorySlug} name={line.categoryName} color={line.categoryColor} />
                  <span className="text-text min-w-0 flex-1 text-base leading-relaxed">{line.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="tablet:grid tablet:grid-cols-3 tablet:items-start tablet:gap-8">
          <div className="tablet:col-span-2">
            <BriefDailySections lang={lang} packs={b.packs} />
            {practice ? <DailyPractice lang={lang} step={practice.step} /> : null}
            <DailyBriefFinale />
          </div>
          <aside className="mt-10 grid gap-4 tablet:sticky tablet:top-[var(--header-h)] tablet:mt-0">
            <DailyIssueToc items={tocItems} />
            <ConceptOtherChips
              lang={lang}
              concepts={briefConcepts.slice(0, 12)}
              title={t.briefConceptsLabel}
              headingId="brief-concepts-title"
              variant="rail"
            />
          </aside>
        </div>

        <EditionNav lang={lang} previous={neighbors.previous} next={neighbors.next} />
      </DailyReadProvider>

      <section className="mt-12 max-w-[760px]">
        <NewsletterForm lang={lang} variant="inline" placement="brief-page" />
      </section>
    </div>
  );
}
