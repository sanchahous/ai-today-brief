import { describe, expect, it } from 'vitest';
import type { WeeklyDigestItemView } from '@/lib/digests';
import { weeklyActionItems } from './weekly-action-board';

function item(rank: number, practicalExample: string): WeeklyDigestItemView {
  return {
    id: `item-${rank}`,
    rank,
    title: `Story ${rank}`,
    summary: '',
    body: '',
    why: '',
    practicalExample,
    takeaway: '',
    limitation: '',
    editorsView: '',
    discussionQuestion: '',
    sources: [],
    sourceName: null,
    sourceUrl: null,
    date: null,
    image: null,
    href: null,
  };
}

describe('weekly action board selection', () => {
  it('keeps only stories that actually carry a practical example', () => {
    const actions = weeklyActionItems([
      item(1, 'Serve the checkpoint on vLLM.'),
      item(2, '   '),
      item(3, ''),
      item(4, 'Route traffic through the proxy.'),
    ]);
    expect(actions.map((action) => action.rank)).toEqual([1, 4]);
  });

  it('caps the board so it does not become a second digest', () => {
    const actions = weeklyActionItems(
      Array.from({ length: 9 }, (_, index) => item(index + 1, `Action ${index + 1}`)),
    );
    expect(actions).toHaveLength(5);
    expect(actions.at(-1)?.rank).toBe(5);
  });

  it('returns nothing when no story has a practical example', () => {
    expect(weeklyActionItems([item(1, ''), item(2, '  ')])).toEqual([]);
  });
});
