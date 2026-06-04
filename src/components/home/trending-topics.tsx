import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import type { TrendingTopic } from '@/lib/home';
import { ArrowRight, SparkleIcon } from '@/components/icons';
import { Reveal } from '@/components/reveal';

/**
 * Weighted tag cloud of the most-mentioned tools/concepts across recent briefs
 * (FEATURE F4). Each chip links to the concept hub when one exists, else to a
 * pre-filled archive search — the hub-and-spoke internal linking SEO rewards.
 */
export function TrendingTopics({ lang, topics }: { lang: Lang; topics: TrendingTopic[] }) {
  if (topics.length === 0) return null;
  const t = getStrings(lang).landing;
  const max = Math.max(...topics.map((x) => x.mentions));
  const min = Math.min(...topics.map((x) => x.mentions));
  const sizeRem = (n: number) => 0.82 + ((n - min) / (max - min || 1)) * 0.5;

  return (
    <section aria-label={t.trendingTitle} className="mx-auto w-full max-w-[1160px] px-6 py-12">
      <Reveal>
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
          {t.trendingEyebrow}
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl">{t.trendingTitle}</h2>
        <p className="text-muted mt-1 mb-6 max-w-xl text-sm">{t.trendingSubtitle}</p>
        <div className="flex flex-wrap gap-2.5">
          {topics.map((topic) => (
            <Link
              key={topic.name}
              href={topic.href}
              title={`${topic.mentions} ${t.mentions}`}
              className="group border-border bg-surface text-text rounded-pill hover:border-accent hover:bg-surface-2 inline-flex items-center gap-1.5 border px-3.5 py-2 font-semibold transition hover:-translate-y-0.5"
              style={{ fontSize: `${sizeRem(topic.mentions)}rem` }}
            >
              <span aria-hidden className="text-accent inline-flex">
                <SparkleIcon size={15} />
              </span>
              {topic.name}
              <span
                aria-hidden
                className="text-accent inline-flex -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
              >
                <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
