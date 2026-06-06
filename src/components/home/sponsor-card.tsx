import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';

/**
 * "Open ad slot" house unit. Until the `sponsors` table carries a real paid
 * placement, this woven-in feed card honestly offers the slot to advertisers
 * and links to /advertise. It is clearly disclosed as our own note — never a
 * fake product or a stealth ad — so it reads cleanly to readers while giving
 * potential sponsors a concrete hook to claim the spot.
 */
export function SponsorCard({ lang }: { lang: Lang }) {
  const t = getStrings(lang).landing;
  const style = { '--cat-color': 'var(--accent)' } as CSSProperties;
  return (
    <article
      data-testid="sponsor-card"
      className="cat-header rounded-card relative border p-5"
      style={style}
    >
      <div className="mb-3">
        <span
          className="cat-badge rounded-pill px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.1em] uppercase"
          style={style}
        >
          {t.adSlotLabel}
        </span>
      </div>

      <h3 className="text-base leading-snug sm:text-lg">{t.adSlotTitle}</h3>
      <p className="text-muted mt-2 mb-4 text-sm leading-relaxed">{t.adSlotBody}</p>

      <Link
        href={`/${lang}/advertise`}
        className="cat-chip rounded-pill inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-semibold no-underline transition-colors"
        style={style}
      >
        {t.adSlotCta}
        <ArrowRight size={15} />
      </Link>
    </article>
  );
}
