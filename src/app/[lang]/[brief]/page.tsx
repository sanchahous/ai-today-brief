import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getBriefBySlug, getBriefPaths } from '@/lib/briefs';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { AiDisclosureNote } from '@/components/ai-disclosure-note';
import { BriefItemsList } from '@/components/brief-items-list';
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
  if (!b?.slug) notFound();
  const t = getStrings(lang);
  const dateStr = dateLabel(b.date, lang);

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
        url: `${SITE_URL}/${lang}/${b.slug}`,
        datePublished: b.date,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: b.items.length,
          itemListElement: b.items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.title,
            ...(it.slug ? { url: `${SITE_URL}/${lang}/${b.slug}/${it.slug}` } : {}),
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

      <BriefItemsList lang={lang} brief={b} />

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
