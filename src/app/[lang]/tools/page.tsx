import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ToolCard } from '@/components/tools/tool-card';
import { TOOLS } from '@/content/tools';
import { getStrings } from '@/lib/i18n';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';

export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l);
  return {
    title: t.toolsPage.title,
    description: t.toolsPage.lede,
    alternates: {
      canonical: `${SITE_URL}/${l}/tools`,
      languages: {
        en: `${SITE_URL}/en/tools`,
        uk: `${SITE_URL}/uk/tools`,
        'x-default': `${SITE_URL}/en/tools`,
      },
    },
  };
}

export default async function ToolsPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.toolsPage.title,
    description: t.toolsPage.lede,
    inLanguage: lang,
    url: `${SITE_URL}/${lang}/tools`,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl sm:text-4xl">{t.toolsPage.title}</h1>
      <p className="text-muted mt-4 text-lg leading-relaxed">{t.toolsPage.lede}</p>

      <ul className="m-0 mt-8 grid list-none gap-3 p-0">
        {TOOLS.map((tool) => (
          <li key={tool.slug}>
            <ToolCard tool={tool} lang={lang} />
          </li>
        ))}
      </ul>
    </div>
  );
}
