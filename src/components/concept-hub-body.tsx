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
}: {
  lang: Lang;
  body: string;
  faq: ConceptFaqItem[];
  verification?: ConceptVerification | null;
  verifiedAt?: string | null;
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
                {para}
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
