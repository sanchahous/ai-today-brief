'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics-client';
import type { TrendingTopic } from '@/lib/home';
import { ArrowRight, SparkleIcon } from '@/components/icons';

export function TrendingTopicLink({
  topic,
  placement,
  sizeRem,
  mentionsLabel,
}: {
  topic: TrendingTopic;
  placement: string;
  sizeRem: number;
  mentionsLabel: string;
}) {
  return (
    <Link
      href={topic.href}
      title={`${topic.mentions} ${mentionsLabel}`}
      onClick={() =>
        trackEvent('trending_topic_click', {
          topic: topic.name,
          placement,
        })
      }
      className="group border-border bg-surface text-text rounded-pill hover:border-accent hover:bg-surface-2 inline-flex items-center gap-1.5 border px-3.5 py-2 font-semibold transition hover:-translate-y-0.5"
      style={{ fontSize: `${sizeRem}rem` }}
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
  );
}
