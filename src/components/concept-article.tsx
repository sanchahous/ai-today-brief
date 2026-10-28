import Link from 'next/link';
import { formatVerifiedDate, planConceptSections } from '@/lib/concept-meta';
import type { ConceptDetail, ConceptSummary } from '@/lib/concepts';
import type { HomeItem } from '@/lib/home';
import { getStrings } from '@/lib/i18n';
import { EDITOR_NAME, type Lang } from '@/lib/site';
import { getGuide } from '@/content/guides';
import { linkConceptMentions } from '@/components/concept-hub-body';
import { ConceptHeader } from '@/components/concept-header';
import {
  Callout,
  DataTable,
  Faq,
  ProcessDiagram,
  RelatedContent,
  StoryCard,
  TableOfContents,
} from '@/components/editorial';
import { ArrowRight } from '@/components/icons';
import styles from './concepts.module.css';

function sectionTitle(
  id: string,
  t: ReturnType<typeof getStrings>,
): string {
  switch (id) {
    case 'overview':
      return t.conceptInOneSentence;
    case 'how':
      return t.conceptHow;
    case 'fit':
      return t.conceptWhere;
    case 'faq':
      return t.conceptFaq;
    case 'verification':
      return t.conceptVerificationTitle;
    default:
      return '';
  }
}

function workLinksFor(lang: Lang): { title: string; href: string }[] {
  const t = getStrings(lang);
  const links: { title: string; href: string }[] = [];
  if (getGuide('claude-code-vs-cursor-vs-codex')) {
    links.push({
      title: t.conceptChooseWorkflow,
      href: `/${lang}/guides/claude-code-vs-cursor-vs-codex`,
    });
  }
  links.push({ title: t.conceptOpenToolbox, href: `/${lang}/tools` });
  return links;
}

function Prose({
  paragraphs,
  lang,
  related,
}: {
  paragraphs: string[];
  lang: Lang;
  related: { name: string; slug: string }[];
}) {
  if (paragraphs.length === 0) return null;
  return (
    <div className={styles.prose}>
      {paragraphs.map((para, index) => (
        <p key={`${index}:${para.slice(0, 24)}`}>{linkConceptMentions(para, lang, related)}</p>
      ))}
    </div>
  );
}

export function ConceptArticle({
  lang,
  concept,
  stories,
  others,
}: {
  lang: Lang;
  concept: ConceptDetail;
  stories: HomeItem[];
  others: ConceptSummary[];
}) {
  const t = getStrings(lang);
  const plan = planConceptSections({
    description: concept.description,
    body: concept.body,
    faqCount: concept.faq.length,
    verification: concept.verification,
  });
  const toc = plan.ids
    .map((id) => ({ id, title: sectionTitle(id, t), level: 2 }))
    .filter((item) => item.title);
  const workLinks = workLinksFor(lang);
  const related = others.map((item) => ({
    name: item.name,
    href: `/${lang}/concepts/${item.slug}`,
  }));
  const mentions = others.map((item) => ({ name: item.name, slug: item.slug }));
  const checked = formatVerifiedDate(concept.verifiedAt, lang, 'long');
  const hasToc = toc.length > 0;
  const hasAside = related.length > 0 || workLinks.length > 0;
  const shownStories = stories.slice(0, 6);
  const verificationCopy =
    concept.verification === 'verified' ? t.conceptVerifiedNote : t.conceptGeneralNote;
  const faqSchema =
    concept.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: concept.faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }
      : null;

  return (
    <>
      {faqSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      ) : null}
      <ConceptHeader lang={lang} concept={concept} storyCount={stories.length} />
      <div
        className={styles.layout}
        data-toc={hasToc ? 'true' : 'false'}
        data-aside={hasAside ? 'true' : 'false'}
      >
        {hasToc ? (
          <div className={styles.tocCol}>
            <TableOfContents lang={lang} items={toc} />
          </div>
        ) : null}
        <div className={styles.reading}>
          {plan.ids.includes('overview') ? (
            <div id="overview">
              <Callout lang={lang} variant="definition" title={t.conceptInOneSentence}>
                {concept.description}
              </Callout>
            </div>
          ) : null}
          {plan.ids.includes('how') ? (
            <section id="how" aria-labelledby="how-title">
              <h2 id="how-title">{t.conceptHow}</h2>
              {plan.steps.length >= 2 ? (
                <ProcessDiagram
                  lang={lang}
                  nodes={plan.steps}
                  title={t.conceptHow}
                  caption={t.conceptProcessCaption}
                  visibleTitle={false}
                />
              ) : null}
              <Prose paragraphs={plan.how} lang={lang} related={mentions} />
            </section>
          ) : null}
          {plan.ids.includes('fit') ? (
            <section id="fit" aria-labelledby="fit-title">
              <h2 id="fit-title">{t.conceptWhere}</h2>
              {plan.table ? (
                <DataTable title={t.conceptWhere}>
                  <thead>
                    <tr>
                      {plan.table.headers.map((header, index) => (
                        <th key={`${header}:${index}`} scope="col">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.table.rows.map((row, rowIndex) => (
                      <tr key={`${row.join('|')}:${rowIndex}`}>
                        {row.map((cell, index) => (
                          <td key={`${cell}:${index}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              ) : null}
              <Prose paragraphs={plan.fit} lang={lang} related={mentions} />
            </section>
          ) : null}
          {concept.faq.length > 0 ? (
            <section id="faq">
              <Faq
                lang={lang}
                title={t.conceptFaq}
                items={concept.faq.map((item, index) => ({
                  id: `faq-${index}`,
                  question: item.q,
                  answer: item.a,
                }))}
              />
            </section>
          ) : null}
          {plan.ids.includes('verification') ? (
            <section className={styles.verification} id="verification" aria-labelledby="verification-title">
              <h2 id="verification-title">{t.conceptVerificationTitle}</h2>
              <p>{verificationCopy}</p>
              {checked ? (
                <p className={styles.verificationMeta}>
                  {t.conceptLastVerified}{' '}
                  <time dateTime={concept.verifiedAt ?? undefined}>{checked}</time>
                  {` · ${EDITOR_NAME}`}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
        {hasAside ? (
          <div className={styles.asideCol}>
            <RelatedContent lang={lang} related={[]} concepts={related} workLinks={workLinks} />
          </div>
        ) : null}
      </div>
      {stories.length > 0 ? (
        <section className={styles.stories} aria-labelledby="concept-stories">
          <div className={styles.storiesHead}>
            <h2 id="concept-stories">{t.conceptStories}</h2>
            <Link href={`/${lang}/news/search?q=${encodeURIComponent(concept.name)}`}>
              {t.conceptAllStories} {stories.length}
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className={styles.storyList}>
            {shownStories.map((item) => (
              <StoryCard key={item.id} lang={lang} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
