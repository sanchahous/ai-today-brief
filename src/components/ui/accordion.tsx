'use client';

import { useId, useState, type ReactNode } from 'react';

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** `single` keeps at most one panel open; `multiple` lets each toggle independently. */
  type?: 'single' | 'multiple';
  defaultOpenIds?: string[];
  /** Heading level for item titles so the outline stays valid where the accordion is placed. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Disclosure group: each title is a heading containing a button with `aria-expanded`. */
export function Accordion({
  items,
  type = 'single',
  defaultOpenIds = [],
  headingLevel = 3,
  className = '',
}: AccordionProps) {
  const base = useId();
  const [open, setOpen] = useState<string[]>(defaultOpenIds);
  const Heading = `h${headingLevel}` as const;

  const toggle = (id: string) =>
    setOpen((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return type === 'single' ? [id] : [...prev, id];
    });

  return (
    <div className={`border-line divide-border divide-y border-y ${className}`}>
      {items.map((item) => {
        const expanded = open.includes(item.id);
        return (
          <div key={item.id}>
            <Heading className="m-0">
              <button
                type="button"
                id={`${base}-${item.id}-btn`}
                aria-expanded={expanded}
                aria-controls={`${base}-${item.id}-panel`}
                onClick={() => toggle(item.id)}
                className="text-text hover:bg-surface flex min-h-[44px] w-full items-center justify-between gap-4 px-1 py-3 text-left text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              >
                <span>{item.title}</span>
                <span
                  aria-hidden="true"
                  className={`text-muted shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                >
                  ▾
                </span>
              </button>
            </Heading>
            <div
              id={`${base}-${item.id}-panel`}
              role="region"
              aria-labelledby={`${base}-${item.id}-btn`}
              hidden={!expanded}
              className="text-muted px-1 pb-4 text-sm leading-relaxed"
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
