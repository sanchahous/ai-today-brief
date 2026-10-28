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
      className="hover:border-accent grid min-h-[var(--touch-target-min)] gap-1.5 rounded-md border border-transparent px-1 py-1.5"
    >
      <span className="text-text text-sm leading-snug font-semibold">{topic.name}</span>
      <span className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem] items-center gap-3">
        <span aria-hidden className="bg-raised h-2.5 overflow-hidden rounded-pill">
          <span className="bg-accent block h-full rounded-pill" style={{ width: `${width}%` }} />
        </span>
        <span className="text-faint text-right text-xs font-semibold tabular-nums">{topic.mentions}</span>
        {delta !== null && delta !== 0 ? (
          <span
            title={deltaText}
            className={`text-xs font-semibold tabular-nums ${delta > 0 ? 'text-success' : 'text-muted'}`}
          >
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        ) : (
          <span aria-hidden className="text-faint text-xs">
            —
          </span>
        )}
      </span>
    </Link>
  );
}
