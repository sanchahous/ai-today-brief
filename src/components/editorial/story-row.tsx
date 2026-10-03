'use client';

import type { Lang } from '@/lib/site';
import { StoryCard, type StoryCardItem } from './story-card';

export interface StoryRowProps {
  item: StoryCardItem;
  rank?: number | string;
  lang?: Lang;
  className?: string;
  showSave?: boolean;
}

/**
 * After Hours StoryRow: compact row format for ranked lists, sidebars, radar, and search feeds.
 * Delegates to StoryCard with layout="row".
 */
export function StoryRow({
  item,
  rank,
  lang = 'en',
  className = '',
  showSave = false,
}: StoryRowProps) {
  return (
    <StoryCard
      item={item}
      layout="row"
      lang={lang}
      rank={rank}
      showSave={showSave}
      className={className}
    />
  );
}
