import Link from 'next/link';
import type { DailyBriefNeighbor } from '@/lib/briefs';
import { briefDateParts } from '@/lib/daily-edition';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';

const linkClass =
  'rounded-card border-line bg-surface hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] flex min-h-[var(--touch-target-min)] flex-1 flex-col justify-center gap-1 border p-4 no-underline';

/**
 * Previous / all / next from published edition-1 rows.
 * A missing neighbour is omitted. The next edition's clock is not invented.
 */
export function EditionNav({
  lang,
  previous,
  next,
}: {
  lang: Lang;
  previous: DailyBriefNeighbor | null;
  next: DailyBriefNeighbor | null;
}) {
  const t = getStrings(lang);

  return (
    <nav aria-label={t.otherEditions} className="mt-12 flex flex-col gap-3 sm:flex-row">
      {previous ? <NeighborLink lang={lang} neighbor={previous} rel="prev" kicker={t.previousEdition} /> : null}
      <Link href={`/${lang}/digests`} className={linkClass}>
        <span className="text-faint text-sm">{t.allEditions}</span>
      </Link>
      {next ? <NeighborLink lang={lang} neighbor={next} rel="next" kicker={t.nextEdition} /> : null}
    </nav>
  );
}

function NeighborLink({
  lang,
  neighbor,
  rel,
  kicker,
}: {
  lang: Lang;
  neighbor: DailyBriefNeighbor;
  rel: 'prev' | 'next';
  kicker: string;
}) {
  const parts = briefDateParts(neighbor.date, lang);
  return (
    <Link href={`/${lang}/${neighbor.slug}`} rel={rel} className={linkClass}>
      <span className="text-faint inline-flex items-center gap-1 text-sm">
        {rel === 'prev' ? <ArrowRight size={16} className="rotate-180" /> : null}
        {kicker}
        {parts ? ` · ${parts.short}` : ''}
        {rel === 'next' ? <ArrowRight size={16} /> : null}
      </span>
      <strong className="text-text text-base leading-snug">{neighbor.title}</strong>
    </Link>
  );
}
