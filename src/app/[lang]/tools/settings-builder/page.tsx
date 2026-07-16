import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { SettingsBuilderClient } from '@/components/tools/settings-builder-client';
import { SettingsCatalog } from '@/components/tools/settings-catalog';
import { getTool } from '@/content/tools';
import { getStrings } from '@/lib/i18n';
import { isLang, LANGS, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';

export const revalidate = 86400;

type Params = { lang: string };
const TOOL_SLUG = 'settings-builder';

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const tool = getTool(TOOL_SLUG);
  if (!tool) return {};
  return {
    title: tool.title[lang],
    description: tool.description[lang],
    alternates: {
      canonical: `${SITE_URL}/${lang}/tools/${TOOL_SLUG}`,
      languages: {
        en: `${SITE_URL}/en/tools/${TOOL_SLUG}`,
        uk: `${SITE_URL}/uk/tools/${TOOL_SLUG}`,
        'x-default': `${SITE_URL}/en/tools/${TOOL_SLUG}`,
      },
    },
    openGraph: {
      title: tool.title[lang],
      description: tool.description[lang],
      type: 'website',
      url: `${SITE_URL}/${lang}/tools/${TOOL_SLUG}`,
    },
  };
}

export default async function SettingsBuilderPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const tool = getTool(TOOL_SLUG);
  if (!tool) notFound();
  const strings = getStrings(lang);
  const t = strings.settingsBuilder;

  const crumbs = [
    { label: strings.news.breadcrumbHome, href: `/${lang}` },
    { label: strings.toolsPage.title, href: `/${lang}/tools` },
    { label: tool.title[lang] },
  ];

  const url = `${SITE_URL}/${lang}/tools/${TOOL_SLUG}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: tool.title[lang],
        description: tool.description[lang],
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web browser',
        isAccessibleForFree: true,
        inLanguage: lang,
        url,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@type': 'TechArticle',
        headline: tool.title[lang],
        description: tool.lede[lang],
        dateModified: tool.lastVerified,
        inLanguage: lang,
        isAccessibleForFree: true,
        url,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        mainEntityOfPage: url,
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[960px] flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <article>
        <p className="text-faint m-0 text-[0.78rem] font-semibold tracking-[0.16em] uppercase">
          {strings.toolsPage.title}
        </p>
        <h1 className="mb-3 text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.12]">{tool.title[lang]}</h1>
        <p className="text-muted mb-4 text-[1.08rem] leading-[1.7]">{tool.lede[lang]}</p>
        <p className="rounded-card border-border bg-surface border p-4 text-sm leading-relaxed">
          {t.privacyPromise} {t.heuristicDisclaimer}
        </p>

        <SettingsBuilderClient lang={lang} />
        <SettingsCatalog lang={lang} />
      </article>
    </div>
  );
}
