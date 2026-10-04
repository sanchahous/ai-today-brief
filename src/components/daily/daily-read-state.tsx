'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { CheckIcon } from '@/components/icons';
import { fillCountTemplate } from '@/lib/daily-edition';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

interface ReadState {
  lang: Lang;
  readIds: ReadonlySet<string>;
  total: number;
  toggle: (id: string) => void;
}

const ReadContext = createContext<ReadState | null>(null);

function useDailyRead(): ReadState {
  const value = useContext(ReadContext);
  if (!value) throw new Error('Daily read controls must render inside DailyReadProvider');
  return value;
}

const controlClass =
  'inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-pill border border-border bg-surface px-4 text-sm font-semibold text-text transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]';

/**
 * Page-local read state. Nothing is stored or sent: a reload starts unread,
 * and the articles themselves stay in the server HTML.
 */
export function DailyReadProvider({
  lang,
  itemIds,
  children,
}: {
  lang: Lang;
  itemIds: readonly string[];
  children: ReactNode;
}) {
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState('');
  const total = itemIds.length;
  const t = getStrings(lang);

  const toggle = (id: string) => {
    const wasRead = readIds.has(id);
    const next = new Set(readIds);
    if (wasRead) next.delete(id);
    else next.add(id);
    setReadIds(next);
    const countText = fillCountTemplate(t.readStatus, next.size, total);
    setStatus(`${wasRead ? t.markAsRead : t.markedRead}. ${countText}`);
  };

  return (
    <ReadContext.Provider value={{ lang, readIds, total, toggle }}>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      {children}
    </ReadContext.Provider>
  );
}

export function ReadProgressRing() {
  const { lang, readIds, total } = useDailyRead();
  if (total === 0) return null;
  const t = getStrings(lang);
  const read = readIds.size;
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - read / total);

  return (
    <div role="group" aria-label={t.readingProgress} className="flex items-center gap-3">
      <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
        <circle cx="22" cy="22" r={radius} fill="none" className="stroke-border" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          className="stroke-accent transition-[stroke-dashoffset] duration-200 motion-reduce:transition-none"
          strokeWidth="3"
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <p className="m-0 text-sm text-muted">
        <span className="text-text font-semibold">
          <strong data-read-count>{read}</strong>
          {` / ${total}`}
        </span>
        <span className="mt-0.5 block">{t.readCountLabel}</span>
      </p>
    </div>
  );
}

export function MarkReadButton({ id, title }: { id: string; title: string }) {
  const { lang, readIds, toggle } = useDailyRead();
  const t = getStrings(lang);
  const pressed = readIds.has(id);
  const label = pressed ? t.markedRead : t.markAsRead;

  return (
    <button
      type="button"
      data-testid="mark-read"
      className={controlClass}
      aria-pressed={pressed}
      aria-label={`${label}: ${title}`}
      onClick={() => toggle(id)}
    >
      <span aria-hidden className="inline-flex">
        <CheckIcon size={16} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function DailyIssueToc({
  items,
}: {
  items: readonly { id: string; index: number; title: string }[];
}) {
  const { lang, readIds } = useDailyRead();
  if (items.length === 0) return null;
  const t = getStrings(lang);

  return (
    <nav
      aria-label={t.briefItemsLabel}
      className="rounded-card border-border bg-surface border p-4"
    >
      <p className="text-text m-0 mb-3 text-sm font-semibold">
        {t.briefItemsLabel} · {items.length}
      </p>
      <ol className="m-0 grid list-none gap-1 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#item-${item.index}`}
              className={`hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] inline-flex min-h-[var(--touch-target-min)] items-center gap-2 text-sm no-underline ${
                readIds.has(item.id) ? 'text-faint line-through' : 'text-text'
              }`}
            >
              <span aria-hidden className="text-faint w-6 shrink-0 font-semibold">
                {String(item.index).padStart(2, '0')}
              </span>
              <span className="min-w-0">{item.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DailyBriefFinale() {
  const { lang, readIds, total } = useDailyRead();
  const t = getStrings(lang);
  const complete = total > 0 && readIds.size === total;

  return (
    <section aria-live="polite" aria-atomic="true" className="mt-10" data-testid="daily-complete">
      {complete ? (
        <div className="rounded-card border-border bg-surface border px-6 py-8 text-center">
          <h2 className="font-serif text-text m-0 text-2xl">{t.briefComplete}</h2>
        </div>
      ) : null}
    </section>
  );
}
