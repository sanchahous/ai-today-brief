import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getDailyBriefBySlug, getBriefPaths } from '@/lib/briefs';
import { getConceptNameIndex, getConcepts, type ConceptSummary } from '@/lib/concepts';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { AiDisclosureNote } from '@/components/ai-disclosure-note';
import { BriefDailySections } from '@/components/brief-daily-sections';
import { ConceptOtherChips } from '@/components/concept-other-chips';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { ArrowRight } from '@/components/icons';

export const revalidate = 1800;

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
  return {
    title: b.title || b.date,
    description: b.intro ?? undefined,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/${b.canonicalSlug}`,
        uk: `${SITE_URL}/uk/${b.canonicalSlug}`,
        'x-default': `${SITE_URL}/en/${b.canonicalSlug}`,
      },
    },
  };
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

  const b = await getDailyBriefBySlug(slug, lang);
  if (!b?.canonicalSlug) notFound();
  const t = getStrings(lang);
  const dateStr = dateLabel(b.date, lang);

  // Hub-and-spoke: surface the concept hubs this day's items mention, so
  // every daily page links back into the evergreen layer (crawl path for
  // pages otherwise reachable only via the sitemap).
  const [conceptIndex, allConcepts] = await Promise.all([
    getConceptNameIndex(),
    getConcepts(lang),
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
    { label: t.nav.news, href: `/${lang}/news` },
    { label: b.title || t.todaysBrief },
  ];

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
          itemListElement: b.allItems.map((it, i) => {
            const pack = b.packs.find((p) => p.items.some((item) => item.id === it.id));
            return {
              '@type': 'ListItem',
              position: i + 1,
              name: it.title,
              ...(it.slug && pack ? { url: `${SITE_URL}/${lang}/${pack.slug}/${it.slug}` } : {}),
            };
          }),
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

      <header className="mb-8 max-w-[760px]">
        <p className="text-accent m-0 mb-2 text-xs font-bold tracking-[0.14em] uppercase">{dateStr}</p>
        <h1 className="mb-3 text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1.12]">
          {b.title || t.todaysBrief}
        </h1>
        {b.intro && (
          <p className="text-muted m-0 mb-4 text-[1.05rem] leading-relaxed">{b.intro}</p>
        )}
        <AiDisclosureNote lang={lang} />
      </header>

      <BriefDailySections lang={lang} packs={b.packs} totalItems={b.allItems.length} />

      <ConceptOtherChips
        lang={lang}
        concepts={briefConcepts.slice(0, 12)}
        title={t.briefConceptsLabel}
        headingId="brief-concepts-title"
      />

      <div className="mt-8 max-w-[760px]">
        <Link
          href={`/${lang}/news`}
          className="rounded-pill border-border text-text hover:border-accent inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-semibold no-underline transition"
        >
          {t.landing.weekCta}
          <ArrowRight size={16} />
        </Link>
      </div>

      <section className="mt-12 max-w-[760px]">
        <NewsletterBand lang={lang} embedded placement="brief-page" />
      </section>
    </div>
  );
}
