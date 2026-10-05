import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { breadcrumbJsonLd } from '@/components/breadcrumbs';
import { PromptOptimizerClient } from '@/components/tools/prompt-optimizer-client';
import { toToolWorkspaceTool } from '@/components/tools/tool-workspace';
import { RuleCatalog, StaticSnippetCatalog } from '@/components/tools/rule-catalog';
import { getTool } from '@/content/tools';
import { getStrings } from '@/lib/i18n';
import { isLang, LANGS, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const tool = getTool('prompt-optimizer');
  if (!tool) return {};
  return {
    title: tool.title[lang],
    description: tool.description[lang],
    alternates: {
      canonical: `${SITE_URL}/${lang}/tools/prompt-optimizer`,
      languages: {
        en: `${SITE_URL}/en/tools/prompt-optimizer`,
        uk: `${SITE_URL}/uk/tools/prompt-optimizer`,
        'x-default': `${SITE_URL}/en/tools/prompt-optimizer`,
      },
    },
    openGraph: {
      title: tool.title[lang],
      description: tool.description[lang],
      type: 'website',
      url: `${SITE_URL}/${lang}/tools/prompt-optimizer`,
    },
    ...socialMeta({
      title: tool.title[lang],
      description: tool.description[lang],
      path: `/${lang}/tools/prompt-optimizer`,
      lang,
    }),
  };
}

export default async function PromptOptimizerPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const tool = getTool('prompt-optimizer');
  if (!tool) notFound();
  const strings = getStrings(lang);

  const crumbs = [
    { label: strings.news.breadcrumbHome, href: `/${lang}` },
    { label: strings.toolsPage.title, href: `/${lang}/tools` },
    { label: tool.title[lang] },
  ];

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
        url: `${SITE_URL}/${lang}/tools/prompt-optimizer`,
        dateModified: tool.lastVerified,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        mainEntityOfPage: `${SITE_URL}/${lang}/tools/prompt-optimizer`,
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
      <PromptOptimizerClient
        lang={lang}
        tool={toToolWorkspaceTool(tool)}
        breadcrumbs={crumbs}
        catalogSlot={
          <>
            <StaticSnippetCatalog lang={lang} />
            <RuleCatalog lang={lang} />
          </>
        }
      />
    </>
  );
}
