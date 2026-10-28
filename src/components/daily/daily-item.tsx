'use client';

import Link from 'next/link';
import type { BriefItemCard } from '@/lib/briefs';
import { pluralLabel } from '@/lib/home-stats';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import styles from '@/components/daily/daily.module.css';
import { CategoryBadge } from '@/components/ui/category-badge';
import { ArrowRight } from '@/components/icons';
import { WeeklyTopClickTracker } from '@/components/analytics/home-click-trackers';
import { MarkReadButton, useDailyReadOptional } from '@/components/daily/daily-read-state';

export function DailyItem({
  lang,
  item,
  index,
  showReadToggle = false,
}: {
  lang: Lang;
  item: BriefItemCard;
  /** 1-based position in the issue. */
  index: number;
  showReadToggle?: boolean;
}) {
  const t = getStrings(lang);
  const readState = useDailyReadOptional();
  const isRead = readState?.readIds.has(item.id) ?? false;
  const href =
    item.slug && item.categorySlug ? `/${lang}/news/${item.categorySlug}/${item.slug}` : `/${lang}/news`;
  const number = String(index).padStart(2, '0');

  return (
    <li
      id={`item-${index}`}
      className={`${styles.dailyItem}${isRead ? ` ${styles.itemRead}` : ''}`}
    >
      <span className={styles.itemNo} aria-hidden="true">
        {number}
      </span>
      <WeeklyTopClickTracker slot="featured" target={{ id: item.id, slug: item.slug ?? undefined, lang }}>
        <article aria-labelledby={`di-${item.id}`}>
          <div className={styles.itemTop}>
            <CategoryBadge slug={item.categorySlug} name={item.categoryName} color={item.categoryColor} />
            <ItemMeta lang={lang} item={item} />
          </div>
          <h3 id={`di-${item.id}`} className={styles.itemTitle}>
            <Link href={href} className={`${styles.itemTitleLink} inline-flex min-h-[var(--touch-target-min)] items-center`}>
              {item.title}
            </Link>
          </h3>
          <p className={styles.itemSummary}>{item.summary}</p>
          {item.why ? (
            <p className={styles.itemWhy}>
              <strong>{t.whyItMatters}.</strong> {item.why}
            </p>
          ) : null}
          <div className={styles.itemActions}>
            <Link
              href={href}
              className="text-accent inline-flex min-h-[var(--touch-target-min)] items-center gap-1 text-sm font-semibold no-underline"
            >
              {t.fullContext}
              <ArrowRight size={16} />
            </Link>
            {showReadToggle ? <MarkReadButton id={item.id} title={item.title} /> : null}
          </div>
        </article>
      </WeeklyTopClickTracker>
    </li>
  );
}

function ItemMeta({ lang, item }: { lang: Lang; item: BriefItemCard }) {
  if (item.readMinutes <= 0 && !item.sourceName) return null;
  const parts: string[] = [];
  if (item.readMinutes > 0) {
    const minutesWord =
      lang === 'en' ? 'min' : pluralLabel(item.readMinutes, lang, 'minutes').replace(' читання', ' хв');
    parts.push(`${item.readMinutes} ${minutesWord}`);
  }
  if (item.sourceName) parts.push(item.sourceName);
  return <p className={styles.itemMeta}>{parts.join(' · ')}</p>;
}

export function DailyPractice({ lang, step }: { lang: Lang; step: string }) {
  const t = getStrings(lang);
  return (
    <section className="rounded-card border-line bg-surface mt-10 border p-5 sm:p-6" aria-labelledby="try-title">
      <p className="text-accent m-0 text-xs font-bold tracking-[0.14em] uppercase">{t.oneThingToTry}</p>
      <h2 id="try-title" className="font-serif text-text mt-2 mb-0 text-2xl leading-snug">
        {step}
      </h2>
    </section>
  );
}
