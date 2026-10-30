import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getConcepts, type ConceptSummary } from '@/lib/concepts';
import { shelfStats } from '@/lib/concept-meta';
import { getGuide } from '@/content/guides';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { ConceptsShelf } from '@/components/concepts-shelf';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { ArrowRight } from '@/components/icons';
import styles from '@/components/concepts.module.css';

function shelfQuestions(lang: Lang, concepts: readonly ConceptSummary[]) {
  const t = getStrings(lang);
  const slugs = new Set(concepts.map((concept) => concept.slug));
  const cards: { href: string; title: string; tone: 'agents' | 'models' | 'tools' }[] = [];
  if (slugs.has('agent')) {
    cards.push({ href: `/${lang}/concepts/agent`, title: t.conceptsQAgents, tone: 'agents' });
  }
  if (slugs.has('context-engineering')) {
    cards.push({
      href: `/${lang}/concepts/context-engineering`,
      title: t.conceptsQContext,
      tone: 'models',
    });
  }
  if (getGuide('claude-code-vs-cursor-vs-codex')) {
    cards.push({
      href: `/${lang}/guides/claude-code-vs-cursor-vs-codex`,
      title: t.conceptsQWorkflow,
      tone: 'tools',
    });
  }
  return cards;
}

// 24 h: concepts are evergreen and change only via the backfill workflow.
export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l);
  return {
    title: t.nav.concepts,
    description: t.conceptsLede,
    alternates: {
      canonical: `${SITE_URL}/${l}/concepts`,
      languages: {
        en: `${SITE_URL}/en/concepts`,
        uk: `${SITE_URL}/uk/concepts`,
        'x-default': `${SITE_URL}/en/concepts`,
      },
    },
  };
}

export default async function ConceptsIndex({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const concepts = await getConcepts(lang);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.nav.concepts },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t.nav.concepts,
        description: t.conceptsLede,
        url: `${SITE_URL}/${lang}/concepts`,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  const stats = shelfStats(concepts);
  const questions = shelfQuestions(lang, concepts);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1160px] flex-1 overflow-x-clip px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      {concepts.length === 0 ? (
        <p className="text-muted mt-10">{t.noResults}</p>
      ) : (
        <>
          <header className={styles.hero}>
            <p className={`eyebrow ${styles.eyebrow}`}>{t.conceptsEyebrow}</p>
            <h1 className={styles.heroTitle}>
              {t.conceptsTitleLead}
              <br />
              <em>{t.conceptsTitleEm}</em>
            </h1>
            <p className={styles.lede}>{t.conceptsLede}</p>
            <dl className={styles.stats}>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>{t.conceptsStatEntries}</dt>
                <dd className={styles.statValue}>{stats.entries}</dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>{t.conceptsStatTypes}</dt>
                <dd className={styles.statValue}>{stats.types}</dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>{t.conceptsStatVerified}</dt>
                <dd className={styles.statValue}>{stats.verified}</dd>
              </div>
            </dl>
          </header>
          {questions.length > 0 ? (
            <section className={styles.questions} aria-labelledby="questions-title">
              <h2 id="questions-title" className={`eyebrow ${styles.questionsTitle}`}>
                {t.conceptsQuestionsTitle}
              </h2>
              <ul className={styles.questionGrid}>
                {questions.map((question) => (
                  <li key={question.href}>
                    <Link href={question.href} className={styles.questionCard} data-tone={question.tone}>
                      <span className={styles.qMark} aria-hidden="true">
                        ?
                      </span>
                      <strong>{question.title}</strong>
                      <ArrowRight size={20} className="text-accent" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <ConceptsShelf lang={lang} concepts={concepts} />
          <NewsletterBand lang={lang} placement="concepts" />
        </>
      )}
    </div>
  );
}
