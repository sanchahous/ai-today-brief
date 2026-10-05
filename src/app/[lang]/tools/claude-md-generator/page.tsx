import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { breadcrumbJsonLd } from '@/components/breadcrumbs';
import { ClaudeMdGeneratorClient } from '@/components/tools/claude-md-generator-client';
import { toToolWorkspaceTool } from '@/components/tools/tool-workspace';
import { getTool } from '@/content/tools';
import { getStrings } from '@/lib/i18n';
import { isLang, LANGS, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };
const TOOL_SLUG = 'claude-md-generator';

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
    ...socialMeta({
      title: tool.title[lang],
      description: tool.description[lang],
      path: `/${lang}/tools/${TOOL_SLUG}`,
      lang,
    }),
  };
}

export default async function ClaudeMdGeneratorPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const tool = getTool(TOOL_SLUG);
  if (!tool) notFound();
  const strings = getStrings(lang);

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
        dateModified: tool.lastVerified,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        mainEntityOfPage: url,
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ClaudeMdGeneratorClient
        lang={lang}
        tool={toToolWorkspaceTool(tool)}
        breadcrumbs={crumbs}
      />
    </>
  );
}
