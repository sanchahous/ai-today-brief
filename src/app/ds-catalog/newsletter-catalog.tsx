'use client';

import { useState } from 'react';
import { NewsletterForm, type NewsletterStatus, type NewsletterVariant } from '@/components/ui';
import type { Lang } from '@/lib/site';

const VARIANTS: readonly NewsletterVariant[] = ['band', 'inline', 'full'] as const;
const STATES: readonly (NewsletterStatus | 'interactive')[] = [
  'interactive',
  'idle',
  'invalid',
  'pending',
  'success',
  'already_subscribed',
  'error',
  'not_configured',
] as const;

export function NewsletterCatalog() {
  const [lang, setLang] = useState<Lang>('en');
  const [selectedVariant, setSelectedVariant] = useState<NewsletterVariant>('band');
  const [selectedStatus, setSelectedStatus] = useState<NewsletterStatus | 'interactive'>('interactive');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Language:</span>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`rounded px-2.5 py-1 text-xs font-medium border ${lang === 'en' ? 'bg-accent-fill text-on-accent border-transparent' : 'border-border text-muted'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('uk')}
            className={`rounded px-2.5 py-1 text-xs font-medium border ${lang === 'uk' ? 'bg-accent-fill text-on-accent border-transparent' : 'border-border text-muted'}`}
          >
            Українська
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Variant:</span>
          {VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSelectedVariant(v)}
              className={`rounded px-2.5 py-1 text-xs font-medium border ${selectedVariant === v ? 'bg-accent-fill text-on-accent border-transparent' : 'border-border text-muted'}`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">State:</span>
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedStatus(s)}
              className={`rounded px-2 py-1 text-xs font-medium border ${selectedStatus === s ? 'bg-accent-fill text-on-accent border-transparent' : 'border-border text-muted'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="text-muted mb-4 text-xs font-bold uppercase tracking-wider">
          Specimen: variant = {selectedVariant} · state = {selectedStatus} · lang = {lang}
        </h3>
        <div className="max-w-xl">
          <NewsletterForm
            key={`${selectedVariant}-${selectedStatus}-${lang}`}
            lang={lang}
            variant={selectedVariant}
            status={selectedStatus === 'interactive' ? undefined : selectedStatus}
            placement="ds-catalog"
          />
        </div>
      </div>
    </div>
  );
}
