'use client';

import { trackEvent } from '@/lib/analytics-client';

export function FaqAccordionItem({
  question,
  answer,
  questionIndex,
  defaultOpen = false,
}: {
  question: string;
  answer: string;
  questionIndex: number;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) {
          trackEvent('faq_open', { question_index: questionIndex });
        }
      }}
      className="group rounded-card border-border bg-surface overflow-hidden border"
    >
      <summary className="font-serif text-text flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {question}
        <span
          aria-hidden
          className="text-accent text-xl leading-none transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="text-muted px-5 pb-4 text-sm leading-relaxed">{answer}</p>
    </details>
  );
}
