'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, EmptyState, ErrorState, Notice, Pill, Spinner, StaleNotice } from '@/components/ui';
import { PostCardSkeleton } from '@/components/ui/skeleton';
import type { Lang } from '@/lib/site';

/** Specimen inputs for the catalog. They are not the live archive. */
const EXAMPLE_HOURS = 3;
const EXAMPLE_SHOWN = 100;

const COPY = {
  en: {
    title: 'Feedback and data states',
    note: 'Example inputs below are not the live archive.',
    loading: 'Loading',
    loadingLabel: 'Loading the example feed',
    showStory: 'Show the story',
    stale: 'Partial or stale',
    ready: 'Ready',
    readyTitle: 'This example is ready.',
    readyBody: 'The story shape below keeps the same box as the skeleton.',
    exampleKicker: 'Example',
    exampleTitle: 'A reserved story shape',
    exampleBody: 'Catalog specimen. Not a published story.',
    empty: 'Empty',
    emptyTitle: 'No stories match these filters.',
    emptyBody: 'Clear the example filters to see the specimen again.',
    clear: 'Clear example filters',
    recoverable: 'Recoverable error',
    recoverTitle: 'The feed could not be refreshed.',
    recoverBody: 'You are reading the last loaded version of this example.',
    retry: 'Try again',
    retrying: 'Retrying…',
    recovered: 'Example recovered.',
    terminal: 'Terminal error',
    terminalTitle: 'This example is unavailable.',
    terminalBody: 'There is nothing further to retry in this specimen.',
  },
  uk: {
    title: 'Зворотний зв’язок і стани даних',
    note: 'Приклади нижче — не живий архів.',
    loading: 'Завантаження',
    loadingLabel: 'Завантаження прикладу стрічки',
    showStory: 'Показати матеріал',
    stale: 'Часткові або застарілі',
    ready: 'Готово',
    readyTitle: 'Цей приклад готовий.',
    readyBody: 'Форма матеріалу нижче тримає той самий блок, що й скелетон.',
    exampleKicker: 'Приклад',
    exampleTitle: 'Зарезервована форма матеріалу',
    exampleBody: 'Зразок каталогу. Не опублікований матеріал.',
    empty: 'Порожньо',
    emptyTitle: 'Жоден матеріал не відповідає цим фільтрам.',
    emptyBody: 'Скиньте прикладові фільтри, щоб знову побачити зразок.',
    clear: 'Скинути прикладові фільтри',
    recoverable: 'Помилка з відновленням',
    recoverTitle: 'Не вдалося оновити стрічку.',
    recoverBody: 'Ви читаєте останню завантажену версію цього прикладу.',
    retry: 'Спробувати ще',
    retrying: 'Повторюємо…',
    recovered: 'Приклад відновлено.',
    terminal: 'Кінцева помилка',
    terminalTitle: 'Цей приклад недоступний.',
    terminalBody: 'У цьому зразку повторювати більше нічого.',
  },
} as const;

type Copy = (typeof COPY)[Lang];

function Step({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const headingId = `feedback-${id}`;
  return (
    <section data-feedback-step={id} aria-labelledby={headingId} className="grid gap-3">
      <h3 id={headingId} className="eyebrow text-muted m-0">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReadyCard({ copy }: { copy: Copy }) {
  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <div className="post-grid">
        <span className="bg-surface-2 block h-24 w-24 rounded-card" aria-hidden="true" />
        <div>
          <p className="text-muted m-0 text-sm">{copy.exampleKicker}</p>
          <p className="font-serif text-text m-0 mt-2 text-xl">{copy.exampleTitle}</p>
          <p className="text-muted m-0 mt-2 text-sm">{copy.exampleBody}</p>
        </div>
      </div>
    </div>
  );
}

function ReservedSwap({ copy }: { copy: Copy }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="grid justify-items-start gap-3">
      <div data-testid="reserved-swap" className="min-h-40 w-full">
        {ready ? <ReadyCard copy={copy} /> : <PostCardSkeleton />}
      </div>
      <Button variant="outline" disabled={ready} onClick={() => setReady(true)}>
        {copy.showStory}
      </Button>
    </div>
  );
}

function RecoverableDemo({ copy }: { copy: Copy }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const onRetry = () => {
    setPending(true);
    setStatus(copy.retrying);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPending(false);
      setStatus(copy.recovered);
    }, 1600);
  };

  return (
    <ErrorState
      title={copy.recoverTitle}
      description={copy.recoverBody}
      retryLabel={copy.retry}
      onRetry={onRetry}
      pending={pending}
      status={status}
      retryTestId="feedback-retry"
      statusTestId="feedback-retry-status"
    />
  );
}

export function FeedbackCatalog() {
  const [lang, setLang] = useState<Lang>('en');
  const [ready, setReady] = useState(false);
  const copy = COPY[lang];

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <section
      id="feedback-catalog"
      data-testid="feedback-catalog"
      data-ready={ready ? 'true' : 'false'}
      lang={lang}
      aria-labelledby="feedback-catalog-title"
      className="border-border border-t py-8"
    >
      <h2 id="feedback-catalog-title" className="mb-4 font-serif text-xl">
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
      <p className="text-muted mb-6 text-sm">{copy.note}</p>
      <div className="grid gap-8">
        <Step id="loading" title={copy.loading}>
          <div aria-busy="true" className="grid gap-3">
            <Spinner label={copy.loadingLabel} />
            <ReservedSwap key={lang} copy={copy} />
          </div>
        </Step>
        <Step id="stale" title={copy.stale}>
          <StaleNotice lang={lang} hoursAgo={EXAMPLE_HOURS} shown={EXAMPLE_SHOWN} />
        </Step>
        <Step id="ready" title={copy.ready}>
          <Notice tone="success" title={copy.readyTitle}>
            {copy.readyBody}
          </Notice>
          <ReadyCard copy={copy} />
        </Step>
        <Step id="empty" title={copy.empty}>
          <EmptyState title={copy.emptyTitle} description={copy.emptyBody} action={<Button variant="outline">{copy.clear}</Button>} />
        </Step>
        <Step id="recoverable" title={copy.recoverable}>
          <RecoverableDemo key={lang} copy={copy} />
        </Step>
        <Step id="terminal" title={copy.terminal}>
          <ErrorState title={copy.terminalTitle} description={copy.terminalBody} />
        </Step>
      </div>
    </section>
  );
}
