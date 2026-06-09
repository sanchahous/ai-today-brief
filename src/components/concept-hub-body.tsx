import type { ConceptFaqItem } from '@/lib/concepts';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { FaqAccordionItem } from '@/components/home/faq-accordion-item';

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function ConceptHubBody({
  lang,
  body,
  faq,
}: {
  lang: Lang;
  body: string;
  faq: ConceptFaqItem[];
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
