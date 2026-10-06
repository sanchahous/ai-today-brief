import Link from 'next/link';
import type { BriefItemCard } from '@/lib/briefs';
import { pluralLabel } from '@/lib/home-stats';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { CategoryBadge } from '@/components/ui/category-badge';
import { ArrowRight } from '@/components/icons';
import { WeeklyTopClickTracker } from '@/components/analytics/home-click-trackers';
import { MarkReadButton } from '@/components/daily/daily-read-state';

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
  const href =
    item.slug && item.categorySlug ? `/${lang}/news/${item.categorySlug}/${item.slug}` : `/${lang}/news`;
  const number = String(index).padStart(2, '0');

  return (
    <li id={`item-${index}`}>
      <WeeklyTopClickTracker slot="featured" target={{ id: item.id, slug: item.slug ?? undefined, lang }}>
        <article aria-labelledby={`di-${item.id}`} className="rounded-card border-line bg-surface border p-4 sm:p-5">
          <div className="flex gap-4">
            <span aria-hidden className="text-faint font-serif min-w-8 text-2xl leading-none">
              {number}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <CategoryBadge slug={item.categorySlug} name={item.categoryName} color={item.categoryColor} />
                <ItemMeta lang={lang} item={item} />
              </div>
              <h3 id={`di-${item.id}`} className="mb-2 text-lg leading-snug">
                <Link
                  href={href}
                  className="text-text hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center no-underline"
                >
                  {item.title}
                </Link>
              </h3>
              <p className="text-muted m-0 mb-2 text-sm leading-relaxed">{item.summary}</p>
              {item.why ? (
                <p className="text-muted m-0 mb-3 text-sm leading-relaxed">
                  <strong className="text-text">{t.whyItMatters}.</strong> {item.why}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={href}
                  className="text-accent inline-flex min-h-[var(--touch-target-min)] items-center gap-1 text-sm font-semibold no-underline"
                >
                  {t.fullContext}
                  <ArrowRight size={16} />
                </Link>
                {showReadToggle ? <MarkReadButton id={item.id} title={item.title} /> : null}
              </div>
            </div>
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
    parts.push(`${item.readMinutes} ${pluralLabel(item.readMinutes, lang, 'minutes')}`);
  }
  if (item.sourceName) parts.push(item.sourceName);
  return <p className="text-faint m-0 text-sm">{parts.join(' · ')}</p>;
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
