import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import type { TrendingTopic } from '@/lib/home';
import { Reveal } from '@/components/reveal';
import { TrendingTopicLink } from '@/components/home/trending-topic-link';

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
    <section aria-labelledby="trending-title" className="mx-auto w-full max-w-[1160px] px-6 py-12">
      <Reveal>
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
          {t.trendingEyebrow}
        </p>
        <h2 id="trending-title" className="mt-2 text-2xl sm:text-3xl">{t.trendingTitle}</h2>
        <p className="text-muted mt-1 mb-6 max-w-xl text-sm">{t.trendingSubtitle}</p>
        <div className="flex flex-wrap gap-2.5">
          {topics.map((topic) => (
            <TrendingTopicLink
              key={topic.name}
              topic={topic}
              placement="home"
              sizeRem={sizeRem(topic.mentions)}
              mentionsLabel={t.mentions}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
