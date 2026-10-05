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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Language:</span>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-medium border transition-colors ${lang === 'en' ? 'bg-accent-fill text-on-accent border-transparent' : 'border-line text-muted hover:text-text'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('uk')}
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-medium border transition-colors ${lang === 'uk' ? 'bg-accent-fill text-on-accent border-transparent' : 'border-line text-muted hover:text-text'}`}
          >
            Українська
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Variant:</span>
          {VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSelectedVariant(v)}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-medium border transition-colors ${selectedVariant === v ? 'bg-accent-fill text-on-accent border-transparent' : 'border-line text-muted hover:text-text'}`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">State:</span>
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedStatus(s)}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-medium border transition-colors ${selectedStatus === s ? 'bg-accent-fill text-on-accent border-transparent' : 'border-line text-muted hover:text-text'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-6">
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
