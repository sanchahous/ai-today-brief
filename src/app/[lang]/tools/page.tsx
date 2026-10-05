import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { Check, Copy, Lock } from '@/components/icons';
import { ToolCard } from '@/components/tools/tool-card';
import { TOOLS } from '@/content/tools';
import { getStrings } from '@/lib/i18n';
import { socialMeta } from '@/lib/seo';
import { CONTACT_EMAIL, isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';

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
    ...socialMeta({ title: t.toolsPage.title, description: t.toolsPage.lede, path: `/${l}/tools`, lang: l }),
  };
}

export default async function ToolsPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);

  const totalRules = TOOLS.reduce((acc, tool) => acc + tool.rulesCount, 0);
  const totalCitations = TOOLS.reduce((acc, tool) => acc + tool.citationsCount, 0);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.nav.tools },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t.toolsPage.title,
        description: t.toolsPage.lede,
        url: `${SITE_URL}/${lang}/tools`,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@type': 'ItemList',
        name: t.toolsPage.title,
        description: t.toolsPage.lede,
        numberOfItems: TOOLS.length,
        itemListElement: TOOLS.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.title[lang],
          description: tool.description[lang],
          url: `${SITE_URL}${tool.href(lang)}`,
        })),
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-4 sm:px-6 py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <header className="bench-hero grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-8 lg:gap-12 items-end pt-6 sm:pt-8 pb-10">
        <div>
          <span className="eyebrow block font-mono text-2xs tracking-widest uppercase text-accent mb-3">
            {t.toolsPage.eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight my-4">
            {t.toolsPage.heroTitleLead}{' '}
            <em className="italic font-display text-accent">{t.toolsPage.heroTitleEm}</em>
          </h1>
          <p className="lede text-muted text-base sm:text-lg leading-relaxed max-w-[44rem] my-4">
            {t.toolsPage.lede}
          </p>
          <p className="privacy-promise inline-flex items-center gap-2.5 my-4 rounded-full border border-signal/45 bg-signal/10 px-4 py-2 text-sm text-foreground">
            <Lock size={18} className="text-signal shrink-0" aria-hidden="true" />
            <span>{t.toolsPage.privacyPromise}</span>
          </p>
        </div>

        <dl
          className="bench-panel grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm m-0 p-0"
          aria-label={t.toolsPage.panelAriaLabel}
        >
          <div className="flex flex-col-reverse p-5 bg-surface">
            <dt className="text-sm text-muted mt-1.5">{t.toolsPage.panelLiveTools}</dt>
            <dd className="text-3xl sm:text-4xl font-display text-accent leading-none m-0">
              {TOOLS.length}
            </dd>
          </div>
          <div className="flex flex-col-reverse p-5 bg-surface">
            <dt className="text-sm text-muted mt-1.5">{t.toolsPage.panelDeterministicRules}</dt>
            <dd className="text-3xl sm:text-4xl font-display text-accent leading-none m-0">
              {totalRules}
            </dd>
          </div>
          <div className="flex flex-col-reverse p-5 bg-surface">
            <dt className="text-sm text-muted mt-1.5">{t.toolsPage.panelOfficialCitations}</dt>
            <dd className="text-3xl sm:text-4xl font-display text-accent leading-none m-0">
              {totalCitations}
            </dd>
          </div>
          <div className="flex flex-col-reverse p-5 bg-surface">
            <dt className="text-sm text-muted mt-1.5">{t.toolsPage.panelDataSentToUs}</dt>
            <dd className="text-3xl sm:text-4xl font-display text-accent leading-none m-0">
              0
            </dd>
          </div>
        </dl>
      </header>

      <section className="instrument-grid mb-16" aria-label={t.toolsPage.toolsAriaLabel}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOLS.map((tool, index) => (
            <ToolCard key={tool.slug} tool={tool} lang={lang} index={index} />
          ))}
        </div>
      </section>

      <section className="how-steps my-16" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl sm:text-3xl font-normal mb-8">
          {t.toolsPage.howTitle}
        </h2>
        <ol className="steps grid grid-cols-1 md:grid-cols-3 gap-4 list-none p-0 m-0">
          {t.toolsPage.howSteps.map((step) => {
            const IconComponent =
              step.icon === 'lock' ? Lock : step.icon === 'check' ? Check : Copy;
            return (
              <li
                key={step.number}
                className="grid gap-3 p-6 rounded-2xl border border-border bg-surface"
              >
                <span className="step-no font-mono text-2xs text-faint" aria-hidden="true">
                  {step.number}
                </span>
                <span
                  className="step-icon grid place-items-center w-12 h-12 rounded-full bg-accent/15 text-accent"
                  aria-hidden="true"
                >
                  <IconComponent size={24} />
                </span>
                <strong className="text-lg sm:text-xl font-normal font-display">
                  {step.title}
                </strong>
                <span className="text-muted text-sm leading-relaxed">
                  {step.description}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="my-16" aria-labelledby="compare-tools-title">
        <h2 id="compare-tools-title" className="text-2xl sm:text-3xl font-normal mb-8">
          {t.toolsPage.compareTitle}
        </h2>
        <div
          className="table-scroll overflow-x-auto rounded-xl border border-border"
          role="region"
          aria-labelledby="compare-tools-title"
          tabIndex={0}
        >
          <table className="compare-table w-full min-w-[36rem] text-left border-collapse text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th scope="col" className="p-4 font-medium text-foreground">
                  {t.toolsPage.compareColTool}
                </th>
                <th scope="col" className="p-4 font-medium text-foreground">
                  {t.toolsPage.compareColProvide}
                </th>
                <th scope="col" className="p-4 font-medium text-foreground">
                  {t.toolsPage.compareColGet}
                </th>
                <th scope="col" className="p-4 font-medium text-foreground">
                  {t.toolsPage.compareColRuns}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface/50">
              {t.toolsPage.compareRows.map((row) => (
                <tr key={row.slug} className="hover:bg-surface transition">
                  <th scope="row" className="whitespace-nowrap p-4 font-medium text-foreground">
                    <Link
                      href={`/${lang}/tools/${row.slug}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center text-foreground hover:text-accent no-underline font-medium"
                    >
                      {row.name}
                    </Link>
                  </th>
                  <td className="p-4 text-muted">{row.provide}</td>
                  <td className="p-4 text-muted">{row.get}</td>
                  <td className="p-4 text-muted">{row.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="faq my-16 max-w-[48rem]" aria-labelledby="tools-faq-title">
        <h2 id="tools-faq-title" className="text-2xl sm:text-3xl font-normal mb-8">
          {t.toolsPage.faqTitle}
        </h2>
        <div className="faq-list grid gap-3">
          {t.toolsPage.faqItems.map((faq, index) => (
            <details
              key={index}
              className="group rounded-xl border border-border bg-surface [&_summary::-webkit-details-marker]:hidden"
              open={index === 0}
            >
              <summary className="flex min-h-[44px] cursor-pointer items-center p-4 font-medium text-foreground outline-none select-none rounded-xl hover:text-accent transition focus-visible:ring-2 focus-visible:ring-accent">
                {faq.question}
              </summary>
              <p className="text-muted px-4 pb-4 mb-0 leading-relaxed text-sm sm:text-base">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
        <p className="suggest text-sm text-muted mt-6">
          {t.toolsPage.suggestText}{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Tool%20idea`}
            className="text-accent underline hover:opacity-80"
          >
            {t.toolsPage.suggestLink}
          </a>
        </p>
      </section>
    </div>
  );
}
