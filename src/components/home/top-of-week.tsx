import { categoryColor } from '@/lib/category-meta';
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import type { HomeItem } from '@/lib/home';
import { ArrowRight, ClockIcon, PlayIcon } from '@/components/icons';
import { SectionHead } from '@/components/home/section-head';
import { CategoryBadge } from '@/components/ui/category-badge';
import { WeeklyTopClickTracker } from '@/components/analytics/home-click-trackers';
import catStyles from '@/components/category-presentation.module.css';
import cardStyles from '@/components/interactive-card.module.css';

function formatDate(date: string, lang: Lang): string {
  const d = date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date);
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** `/en/news/models/claude-opus-launch` → `claude-opus-launch`; non-item hrefs → null. */
function itemSlugFromHref(href: string): string | undefined {
  const parts = href.split('/').filter(Boolean);
  return parts.length >= 4 ? (parts[parts.length - 1] ?? undefined) : undefined;
}

export function TopOfWeek({
  lang,
  featured,
  secondary,
}: {
  lang: Lang;
  featured: HomeItem | null;
  secondary: HomeItem[];
}) {
  if (!featured) return null;
  const t = getStrings(lang).landing;
  return (
    <section
      id="week"
      aria-labelledby="week-title"
      className="mx-auto w-full max-w-[1160px] scroll-mt-[var(--header-h)] px-6 py-12"
    >
      <div data-gesture="settle" className="flex flex-wrap items-end justify-between gap-4">
        <SectionHead
          id="week-title"
          eyebrow={t.weekEyebrow}
          title={t.weekTitle}
          subtitle={t.weekSubtitle}
        />
        <Link
          href={`/${lang}/news`}
          className="rounded-pill border-line text-text hover:border-accent hover:text-accent inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold transition-colors"
        >
          {t.weekCta}
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div data-gesture="fold">
          <WeeklyTopClickTracker
            slot="featured"
            target={{
              id: featured.id,
              slug: itemSlugFromHref(featured.href),
              lang,
            }}
          >
            <FeaturedCard lang={lang} item={featured} />
          </WeeklyTopClickTracker>
        </div>
        <div className="grid content-start gap-3">
          {secondary.map((it, i) => (
            <div key={it.id} data-gesture="index" data-gesture-delay={String(i * 70)}>
              <WeeklyTopClickTracker
                slot="secondary"
                rank={i + 2}
                target={{ id: it.id, slug: itemSlugFromHref(it.href), lang }}
              >
                <SecondaryRow lang={lang} item={it} rank={i + 2} />
              </WeeklyTopClickTracker>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCard({ lang, item }: { lang: Lang; item: HomeItem }) {
  const t = getStrings(lang).landing;
  const color = categoryColor(item.categorySlug, item.categoryColor);
  return (
    <Link
      href={item.href}
      className={`${cardStyles.card} rounded-card border-line bg-surface block h-full overflow-hidden border`}
    >
      {item.imageUrl && (
        <div className="border-line-soft relative aspect-[16/9] w-full border-b">
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 620px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div
        className={`${catStyles.band} flex flex-wrap items-center gap-2 px-5 py-4`}
        style={{ '--cat-color': color } as CSSProperties}
      >
        <span className="bg-accent text-on-accent rounded-pill px-2 py-0.5 text-2xs font-bold tracking-[0.08em] uppercase">
          {t.featured}
        </span>
        <CategoryBadge slug={item.categorySlug} name={item.categoryName} color={item.categoryColor} />
        {item.hasVideo && (
          <span
            className={`${catStyles.fg} ml-auto inline-flex items-center gap-1 text-xs font-semibold`}
            style={{ '--cat-color': color } as CSSProperties}
          >
            <PlayIcon size={15} />
            {t.watchVideo}
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-2xl leading-snug">{item.title}</h3>
        <p className="text-muted mt-2 line-clamp-3 leading-relaxed">{item.summary}</p>
        <div className="text-faint mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {item.sourceName && (
            <>
              <span>{item.sourceName}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{formatDate(item.date, lang)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon size={13} /> {item.readMinutes} {t.readMin}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SecondaryRow({ lang, item, rank }: { lang: Lang; item: HomeItem; rank: number }) {
  const t = getStrings(lang).landing;
  const color = categoryColor(item.categorySlug, item.categoryColor);
  return (
    <Link
      href={item.href}
      className={`${cardStyles.card} rounded-card border-line bg-surface flex items-start gap-3 border p-4`}
    >
      <span aria-hidden className="text-faint min-w-7 font-serif text-2xl leading-none font-bold">
        {String(rank).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <CategoryBadge slug={item.categorySlug} name={item.categoryName} color={item.categoryColor} />
          {item.hasVideo && (
            <span className={`${catStyles.fg} inline-flex`} style={{ '--cat-color': color } as CSSProperties}>
              <PlayIcon size={14} />
            </span>
          )}
        </div>
        <h4 className="font-serif text-base leading-snug font-semibold">{item.title}</h4>
        <span className="text-faint mt-1.5 inline-flex items-center gap-1 text-xs">
          <ClockIcon size={13} /> {item.readMinutes} {t.readMin}
        </span>
      </div>
    </Link>
  );
}
