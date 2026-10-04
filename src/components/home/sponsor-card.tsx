'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { trackEvent } from '@/lib/analytics-client';
import { ArrowRight } from '@/components/icons';

/**
 * "Open ad slot" house unit. Until the `sponsors` table carries a real paid
 * placement, this woven-in feed card honestly offers the slot to advertisers
 * and links to /advertise.
 */
export function SponsorCard({
  lang,
  placement = 'home-week',
  disclosure = false,
}: {
  lang: Lang;
  placement?: string;
  /** Home band includes “Why am I seeing this?”. Feed cards stay compact. */
  disclosure?: boolean;
}) {
  const t = getStrings(lang).landing;
  const style = { '--cat-color': 'var(--accent)' } as CSSProperties;

  if (disclosure) {
    return (
      <aside
        data-testid="sponsor-card"
        aria-labelledby="sponsor-title"
        className="border-border bg-surface mx-auto grid w-full max-w-[1160px] gap-4 border-y px-6 py-8 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
      >
        <p className="text-accent eyebrow">{t.adSlotLabel}</p>
        <div>
          <h2 id="sponsor-title" className="text-xl">
            {t.adSlotTitle}
          </h2>
          <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed">{t.adSlotBody}</p>
          <details className="mt-3">
            <summary className="min-h-[var(--touch-target-min)] cursor-pointer text-sm font-semibold">
              {t.sponsorWhy}
            </summary>
            <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed">{t.sponsorWhyBody}</p>
          </details>
        </div>
        <Link
          href={`/${lang}/advertise`}
          onClick={() => trackEvent('ad_slot_click', { placement })}
          className="rounded-pill border-border text-text hover:border-accent hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 border px-4 py-2 text-sm font-semibold no-underline"
        >
          {t.adSlotCta}
          <ArrowRight size={15} />
        </Link>
      </aside>
    );
  }

  return (
    <article
      data-testid="sponsor-card"
      className="cat-header rounded-card relative border p-5"
      style={style}
    >
      <div className="mb-3">
        <span
          className="cat-badge rounded-pill px-2 py-0.5 text-2xs font-bold tracking-[0.1em] uppercase"
          style={style}
        >
          {t.adSlotLabel}
        </span>
      </div>

      <h3 className="text-base leading-snug sm:text-lg">{t.adSlotTitle}</h3>
      <p className="text-muted mt-2 mb-4 text-sm leading-relaxed">{t.adSlotBody}</p>

      <Link
        href={`/${lang}/advertise`}
        onClick={() => trackEvent('ad_slot_click', { placement })}
        className="cat-chip rounded-pill inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 border px-4 py-2 text-sm font-semibold no-underline transition-colors"
        style={style}
      >
        {t.adSlotCta}
        <ArrowRight size={15} />
      </Link>
    </article>
  );
}
