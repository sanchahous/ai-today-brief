import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import type { TrendingTopic } from '@/lib/home';
import { ArrowRight } from '@/components/icons';
import { TrendingTopicLink } from '@/components/home/trending-topic-link';

/**
 * Mention bars for the latest seven days. Each bar opens archive search for
 * that name — it does not toggle a filter on the news hub.
 */
export function TrendingTopics({ lang, topics }: { lang: Lang; topics: TrendingTopic[] }) {
  if (topics.length === 0) return null;
  const t = getStrings(lang).landing;
  let max = 0;
  for (const topic of topics) {
    if (topic.mentions > max) max = topic.mentions;
  }

  return (
    <section aria-labelledby="trending-title" className="mx-auto w-full max-w-[1160px] px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-accent eyebrow">{t.trendingEyebrow}</p>
          <h2 id="trending-title" className="mt-2 text-2xl sm:text-3xl">
            {t.trendingTitle}
          </h2>
          <p className="text-muted mt-1 max-w-xl text-sm">{t.trendingSubtitle}</p>
        </div>
        <Link
          href={`/${lang}/news`}
          className="rounded-pill border-line text-text hover:border-accent hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center gap-2 border px-4 py-2 text-sm font-semibold no-underline"
        >
          {t.weekCta}
          <ArrowRight size={16} />
        </Link>
      </div>
      <ol className="mt-6 grid max-w-3xl gap-2">
        {topics.map((topic) => (
          <li key={topic.name}>
            <TrendingTopicLink
              topic={topic}
              placement="home"
              maxMentions={max}
              mentionsLabel={t.mentions}
              deltaUpLabel={t.trendDeltaUp}
              deltaDownLabel={t.trendDeltaDown}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
