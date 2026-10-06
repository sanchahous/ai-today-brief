import type { Lang } from '@/lib/site';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export function Faq({ lang, title, items }: { lang: Lang; title?: string; items: FaqItem[] }) {
  const heading = title || (lang === 'uk' ? 'Часті запитання' : 'FAQ');
  
  return (
    <div className="my-8">
      <h3 className="mb-4 font-serif text-xl font-semibold">{heading}</h3>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <details key={item.id} className="group rounded-xl border border-line bg-surface [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between p-4 font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
              {item.question}
              <span className="ml-4 shrink-0 transition-transform group-open:rotate-180">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </summary>
            <div className="px-4 pb-4 text-muted">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
