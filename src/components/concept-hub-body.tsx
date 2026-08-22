import type { ReactNode } from 'react';
import Link from 'next/link';
import type { ConceptFaqItem, ConceptVerification } from '@/lib/concepts';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { FaqAccordionItem } from '@/components/home/faq-accordion-item';
import { CheckIcon } from '@/components/icons';

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export interface MentionableConcept {
  name: string;
  slug: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a paragraph into text runs and internal links wherever another
 * concept's name occurs. Hrefs are always `/{lang}/concepts/{slug}` built from
 * our own DB rows — never an arbitrary URL from the body text. Each concept is
 * linked at most once per paragraph to avoid over-linking.
 */
export function linkConceptMentions(
  para: string,
  lang: Lang,
  concepts: MentionableConcept[],
): ReactNode[] {
  const usable = concepts.filter((c) => c.name.trim().length > 1);
  if (usable.length === 0 || !para) return [para];

  const byName = new Map<string, MentionableConcept>();
  // Longest names first so "Model Context Protocol" wins over its alias "MCP".
  const sorted = [...usable].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) byName.set(c.name.toLowerCase(), c);

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${sorted.map((c) => escapeRegExp(c.name)).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  );

  const nodes: ReactNode[] = [];
  const linked = new Set<string>();
  let last = 0;
  for (const m of para.matchAll(pattern)) {
    const idx = m.index ?? 0;
    const matched = m[0];
    const key = matched.toLowerCase();
    const concept = byName.get(key);
    if (!concept || linked.has(concept.slug)) continue;
    if (idx > last) nodes.push(para.slice(last, idx));
    nodes.push(
      <Link
        key={`${concept.slug}-${idx}`}
        href={`/${lang}/concepts/${concept.slug}`}
        className="text-accent font-medium hover:underline"
      >
        {matched}
      </Link>,
    );
    linked.add(concept.slug);
    last = idx + matched.length;
  }
  if (last < para.length) nodes.push(para.slice(last));
  return nodes.length > 0 ? nodes : [para];
}

/**
 * Soft fact-control marker under the overview: a quiet trust line for
 * source-verified bodies, a gentle "general knowledge" note otherwise.
 * Never alarming — unsupported specifics are removed before publish, so the
 * note only qualifies background statements.
 */
function VerificationNote({
  lang,
  verification,
  verifiedAt,
}: {
  lang: Lang;
  verification: ConceptVerification | null;
  verifiedAt: string | null;
}) {
  if (!verification) return null;
  const t = getStrings(lang);

  if (verification === 'verified') {
    const date = verifiedAt
      ? new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
          month: 'short',
          year: 'numeric',
        }).format(new Date(verifiedAt))
      : null;
    return (
      <p className="text-faint mt-4 inline-flex items-center gap-1.5 text-xs">
        <CheckIcon size={14} className="text-accent" />
        {t.conceptVerifiedNote}
        {date ? ` · ${date}` : ''}
      </p>
    );
  }

  return <p className="text-faint mt-4 text-xs italic">{t.conceptGeneralNote}</p>;
}

export function ConceptHubBody({
  lang,
  body,
  faq,
  verification = null,
  verifiedAt = null,
  relatedConcepts = [],
}: {
  lang: Lang;
  body: string;
  faq: ConceptFaqItem[];
  verification?: ConceptVerification | null;
  verifiedAt?: string | null;
  /** Other concepts whose names may occur in the body — auto-linked inline. */
  relatedConcepts?: MentionableConcept[];
}) {
  const t = getStrings(lang);
  const bodyParas = paragraphs(body);
  if (bodyParas.length === 0 && faq.length === 0) return null;

  const faqSchema =
    faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : null;

  return (
    <section className="mb-10 max-w-[720px]" aria-labelledby="concept-body-title">
      {faqSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}

      {bodyParas.length > 0 ? (
        <>
          <h2 id="concept-body-title" className="mb-4 text-xl">
            {t.conceptOverview}
          </h2>
          <div className="text-muted space-y-4 text-[0.96rem] leading-[1.75]">
            {bodyParas.map((para, i) => (
              <p key={i} className="m-0">
                {linkConceptMentions(para, lang, relatedConcepts)}
              </p>
            ))}
          </div>
          <VerificationNote lang={lang} verification={verification} verifiedAt={verifiedAt} />
        </>
      ) : null}

      {faq.length > 0 ? (
        <div className={bodyParas.length > 0 ? 'mt-10' : ''}>
          <h2 className="mb-4 text-xl">{t.conceptFaq}</h2>
          <div className="grid gap-2">
            {faq.map((item, i) => (
              <FaqAccordionItem
                key={item.q}
                question={item.q}
                answer={item.a}
                questionIndex={i}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
