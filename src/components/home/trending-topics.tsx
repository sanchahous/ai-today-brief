import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import type { TrendingTopic } from '@/lib/home';
import { Reveal } from '@/components/reveal';
import { TrendingTopicLink } from '@/components/home/trending-topic-link';

/**
 * Most-mentioned tools/concepts across recent briefs (FEATURE F4): a real-data
 * mention bar chart next to the weighted tag cloud. Each entry links to the
 * concept hub when one exists, else to a pre-filled archive search — the
 * hub-and-spoke internal linking SEO rewards.
 */
export function TrendingTopics({ lang, topics }: { lang: Lang; topics: TrendingTopic[] }) {
  if (topics.length === 0) return null;
  const t = getStrings(lang).landing;
  const max = Math.max(...topics.map((x) => x.mentions));
  const min = Math.min(...topics.map((x) => x.mentions));
  const sizeRem = (n: number) => 0.82 + ((n - min) / (max - min || 1)) * 0.5;
  const chartTopics = topics.slice(0, 6);

  return (
    <section aria-labelledby="trending-title" className="mx-auto w-full max-w-[1160px] px-6 py-12">
      <Reveal>
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
          {t.trendingEyebrow}
        </p>
        <h2 id="trending-title" className="mt-2 text-2xl sm:text-3xl">{t.trendingTitle}</h2>
        <p className="text-muted mt-1 mb-6 max-w-xl text-sm">{t.trendingSubtitle}</p>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <MentionsChart lang={lang} topics={chartTopics} />
          <div className="flex flex-wrap content-start gap-2.5">
            {topics.map((topic) => (
              <TrendingTopicLink
                key={topic.name}
                topic={topic}
                placement="home"
                sizeRem={sizeRem(topic.mentions)}
                mentionsLabel={t.mentions}
                risingLabel={t.rising}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** Horizontal bars of real mention counts — the "live media" data layer. */
function MentionsChart({ lang, topics }: { lang: Lang; topics: TrendingTopic[] }) {
  if (topics.length < 2) return null;
  const t = getStrings(lang).landing;
  const max = Math.max(...topics.map((x) => x.mentions));

  return (
    <figure className="rounded-card border-border bg-surface border p-5">
      <figcaption className="text-faint mb-4 text-[0.72rem] font-bold tracking-[0.12em] uppercase">
        {t.trendingChartTitle}
      </figcaption>
      <ol className="grid gap-2.5">
        {topics.map((topic) => (
          <li key={topic.name}>
            <Link
              href={topic.href}
              className="group grid grid-cols-[7.5rem_1fr_2ch] items-center gap-3"
              aria-label={`${topic.name}: ${topic.mentions} ${t.mentions}`}
            >
              <span className="text-muted group-hover:text-text truncate text-xs font-semibold transition-colors">
                {topic.name}
              </span>
              <span className="bg-surface-2 h-2.5 overflow-hidden rounded-pill">
                <span
                  className="bg-accent block h-full rounded-pill opacity-80 transition-opacity group-hover:opacity-100"
                  style={{ width: `${Math.max(8, (topic.mentions / max) * 100)}%` }}
                />
              </span>
              <span className="text-faint text-right text-xs font-semibold tabular-nums">
                {topic.mentions}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </figure>
  );
}
