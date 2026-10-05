'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics-client';
import type { TrendingTopic } from '@/lib/home';

export function TrendingTopicLink({
  topic,
  placement,
  maxMentions,
  mentionsLabel,
  deltaUpLabel,
  deltaDownLabel,
}: {
  topic: TrendingTopic;
  placement: string;
  maxMentions: number;
  mentionsLabel: string;
  deltaUpLabel: string;
  deltaDownLabel: string;
}) {
  const delta = typeof topic.delta === 'number' ? topic.delta : null;
  const deltaText =
    delta === null ? '' : delta > 0 ? `${deltaUpLabel} ${delta}` : delta < 0 ? `${deltaDownLabel} ${Math.abs(delta)}` : '';
  const width = maxMentions > 0 ? Math.max(8, (topic.mentions / maxMentions) * 100) : 0;

  return (
    <Link
      href={topic.href}
      onClick={() =>
        trackEvent('trending_topic_click', {
          topic: topic.name,
          placement,
        })
      }
      aria-label={
        deltaText
          ? `${topic.name}: ${topic.mentions} ${mentionsLabel}, ${deltaText}`
          : `${topic.name}: ${topic.mentions} ${mentionsLabel}`
      }
      className="hover:border-accent grid min-h-[var(--touch-target-min)] grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-transparent px-1"
    >
      <span className="text-text truncate text-sm font-semibold">{topic.name}</span>
      <span className="bg-raised h-2.5 overflow-hidden rounded-pill">
        <span className="bg-accent block h-full rounded-pill" style={{ width: `${width}%` }} />
      </span>
      <span className="text-faint flex items-baseline gap-2 text-xs font-semibold tabular-nums">
        <span>{topic.mentions}</span>
        {delta !== null && delta !== 0 ? (
          <span className={delta > 0 ? 'text-accent' : 'text-muted'}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
