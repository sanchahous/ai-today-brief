import Link from 'next/link';
import type { DailyBriefNeighbor } from '@/lib/briefs';
import { briefDateParts } from '@/lib/daily-edition';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import styles from '@/components/daily/daily.module.css';
import { ArrowRight } from '@/components/icons';

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
    <nav aria-label={t.otherEditions} className={styles.editionNav}>
      {previous ? (
        <NeighborLink lang={lang} neighbor={previous} rel="prev" kicker={t.previousEdition} direction="prev" />
      ) : (
        <span aria-hidden="true" />
      )}
      <Link href={`/${lang}/digests`} className={`${styles.editionLink} ${styles.editionAll}`}>
        <span className={styles.editionKicker}>{t.allEditions}</span>
      </Link>
      {next ? (
        <NeighborLink lang={lang} neighbor={next} rel="next" kicker={t.nextEdition} direction="next" />
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

function NeighborLink({
  lang,
  neighbor,
  rel,
  kicker,
  direction,
}: {
  lang: Lang;
  neighbor: DailyBriefNeighbor;
  rel: 'prev' | 'next';
  kicker: string;
  direction: 'prev' | 'next';
}) {
  const parts = briefDateParts(neighbor.date, lang);
  const dateLabel = parts ? `${parts.weekday} · ${parts.short}` : '';
  const linkClass = `${styles.editionLink}${direction === 'next' ? ` ${styles.editionNext}` : ''}`;

  return (
    <Link href={`/${lang}/${neighbor.slug}`} rel={rel} className={linkClass}>
      <span className={styles.editionKicker}>
        {direction === 'prev' ? <ArrowRight size={16} className="rotate-180" /> : null}
        {kicker}
        {dateLabel ? ` · ${dateLabel}` : ''}
        {direction === 'next' ? <ArrowRight size={16} /> : null}
      </span>
      <strong className={styles.editionTitle}>{neighbor.title}</strong>
    </Link>
  );
}
