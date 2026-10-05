'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Dialog, DisclosureNav, Pill, type DialogVariant } from '@/components/ui';
import type { Lang } from '@/lib/site';

const COPY = {
  en: {
    title: 'Overlays',
    center: 'Open centred dialog',
    left: 'Open left sheet',
    right: 'Open right sheet',
    full: 'Open full sheet',
    close: 'Close',
    note: 'Edition note',
    body: 'A short note about this edition.',
    sections: 'Sections',
    news: 'News',
    weekly: 'Weekly',
    about: 'About',
  },
  uk: {
    title: 'Оверлеї',
    center: 'Відкрити центральне вікно',
    left: 'Відкрити ліву панель',
    right: 'Відкрити праву панель',
    full: 'Відкрити повну панель',
    close: 'Закрити',
    note: 'Нотатка випуску',
    body: 'Коротка нотатка про цей випуск.',
    sections: 'Розділи',
    news: 'Новини',
    weekly: 'Тижневик',
    about: 'Про нас',
  },
} as const;

const SHEET_IDS = {
  center: { panel: 'sheet-center-panel', backdrop: 'sheet-center-backdrop' },
  left: { panel: 'sheet-left-panel', backdrop: 'sheet-left-backdrop' },
  right: { panel: 'sheet-right-panel', backdrop: 'sheet-right-backdrop' },
  full: { panel: 'sheet-full-panel', backdrop: 'sheet-full-backdrop' },
} as const;

const SHEETS: Array<{ variant: DialogVariant; key: keyof Pick<(typeof COPY)['en'], 'center' | 'left' | 'right' | 'full'> }> = [
  { variant: 'center', key: 'center' },
  { variant: 'left', key: 'left' },
  { variant: 'right', key: 'right' },
  { variant: 'full', key: 'full' },
];

function SheetDemo({
  variant,
  label,
  title,
  body,
  closeLabel,
}: {
  variant: DialogVariant;
  label: string;
  title: string;
  body: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="bg-surface border-line text-text min-h-[var(--touch-target-min)] rounded-lg border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <Dialog
        id={panelId}
        open={open}
        onOpenChange={setOpen}
        variant={variant}
        title={title}
        description={body}
        closeLabel={closeLabel}
        triggerRef={trigger}
        panelTestId={SHEET_IDS[variant].panel}
        backdropTestId={SHEET_IDS[variant].backdrop}
      />
    </>
  );
}

export function OverlayCatalog() {
  const [lang, setLang] = useState<Lang>('en');
  const [ready, setReady] = useState(false);
  const copy = COPY[lang];
  useEffect(() => {
    setReady(true);
  }, []);
  return (
    <section
      id="overlay-catalog"
      data-testid="overlay-catalog"
      data-ready={ready ? 'true' : 'false'}
      lang={lang}
      aria-labelledby="overlay-catalog-title"
      className="border-line border-t py-8"
    >
      <h2 id="overlay-catalog-title" className="mb-4 font-serif text-xl">
        {copy.title}
      </h2>
      <div className="mb-4 flex flex-wrap gap-2">
        <Pill pressed={lang === 'en'} onClick={() => setLang('en')}>
          EN
        </Pill>
        <Pill pressed={lang === 'uk'} onClick={() => setLang('uk')}>
          UK
        </Pill>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {SHEETS.map((sheet) => (
          <SheetDemo
            key={sheet.variant}
            variant={sheet.variant}
            label={copy[sheet.key]}
            title={copy.note}
            body={copy.body}
            closeLabel={copy.close}
          />
        ))}
      </div>
      <DisclosureNav
        label={copy.sections}
        closeLabel={copy.close}
        links={[
          { id: 'news', href: '#overlay-nav-news', label: copy.news },
          { id: 'weekly', href: '#overlay-nav-weekly', label: copy.weekly },
          { id: 'about', href: '#overlay-nav-about', label: copy.about },
        ]}
      />
      <p id="overlay-nav-news" className="text-muted mt-4 text-sm">
        {copy.news}
      </p>
      <p id="overlay-nav-weekly" className="text-muted m-0 text-sm">
        {copy.weekly}
      </p>
      <p id="overlay-nav-about" className="text-muted m-0 text-sm">
        {copy.about}
      </p>
    </section>
  );
}
