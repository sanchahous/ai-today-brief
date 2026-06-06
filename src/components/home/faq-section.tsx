import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { FAQS } from '@/lib/home-content';
import { Reveal } from '@/components/reveal';
import { FaqAccordionItem } from '@/components/home/faq-accordion-item';

/**
 * SEO FAQ (FEATURE F3). Native <details> accordion — accessible and zero-JS —
 * plus FAQPage JSON-LD for rich results and AI/answer engines (AEO).
 */
export function FaqSection({ lang }: { lang: Lang }) {
  const t = getStrings(lang).landing;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: f.a[lang] },
    })),
  };

  return (
    <section aria-labelledby="faq-title" className="mx-auto w-full max-w-[1160px] px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Reveal>
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{t.faqEyebrow}</p>
        <h2 id="faq-title" className="mt-2 text-2xl sm:text-3xl">
          {t.faqTitle}
        </h2>
        <p className="text-muted mt-1 mb-6 text-sm">{t.faqSubtitle}</p>
        <div className="grid max-w-3xl gap-2.5">
          {FAQS.map((f, i) => (
            <FaqAccordionItem
              key={f.q.en}
              question={f.q[lang]}
              answer={f.a[lang]}
              questionIndex={i}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
