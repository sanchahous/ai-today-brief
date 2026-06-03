import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, EDITOR_NAME, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getConcept, getConceptPaths } from '@/lib/concepts';
import { searchNews } from '@/lib/news';

export const revalidate = 3600;

type Params = { lang: string; slug: string };

export async function generateStaticParams() {
  return getConceptPaths();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const concept = await getConcept(slug, lang);
  if (!concept) return {};
  const path = `/${lang}/concepts/${slug}`;
  return {
    title: concept.name,
    description: concept.description || `${concept.name} — ${SITE_NAME}`,
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

export default async function ConceptHub({ params }: { params: Promise<Params> }) {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const concept = await getConcept(slug, lang);
  if (!concept) notFound();
  const t = getStrings(lang);
  const related = await searchNews(lang, concept.name, 12);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: concept.name,
    description: concept.description,
    inLanguage: lang,
    author: { '@type': 'Person', name: EDITOR_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/${lang}/concepts/${slug}`,
  };

  return (
    <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-faint mb-8 text-sm">
        <Link className="hover:text-text" href={`/${lang}/concepts`}>
          ← {t.nav.concepts}
        </Link>
      </nav>

      <article>
        <span className="text-accent text-xs font-bold tracking-wider uppercase">
          {concept.type}
        </span>
        <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{concept.name}</h1>
        {concept.description && (
          <p className="mt-6 text-lg leading-relaxed">{concept.description}</p>
        )}
        {concept.officialUrl && (
          <p className="mt-6 text-sm">
            <a
              className="text-accent"
              href={concept.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.officialSite} ↗
            </a>
          </p>
        )}
      </article>

      {related.length > 0 && (
        <section className="border-border-soft mt-12 border-t pt-8">
          <h2 className="text-xl">{t.relatedCoverage}</h2>
          <ul className="mt-4 space-y-3">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={r.href} className="hover:text-accent leading-snug">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
