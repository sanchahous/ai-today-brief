import { describe, expect, it } from 'vitest';
import {
  cancelConfirmMessage,
  countSelectedKind,
  filterQueueByKind,
  hiddenWeeklyHint,
  keepVisibleSelection,
  kindFiltersPresent,
  packageKindLabel,
  selectAllLabel,
  selectionKindSummary,
} from './package-queue';

const daily = { id: 'd1', kind: 'daily_digest' };
const weekly = { id: 'w1', kind: 'weekly_digest' };
const weekly2 = { id: 'w2', kind: 'weekly_digest' };
const top = { id: 't1', kind: 'top_story' };

describe('package queue kind filters', () => {
  it('keeps every package on the all filter', () => {
    expect(filterQueueByKind([daily, weekly], 'all')).toEqual([daily, weekly]);
  });

  it('hides weekly packages when Daily is selected', () => {
    expect(filterQueueByKind([daily, weekly, top], 'daily_digest')).toEqual([daily]);
  });

  it('always offers Daily and Weekly so a Weekly-only queue cannot be selected from Daily', () => {
    expect(kindFiltersPresent([weekly])).toEqual(['daily_digest', 'weekly_digest']);
  });

  it('lists extra kinds that exist, in canonical order', () => {
    expect(kindFiltersPresent([weekly, daily, top])).toEqual([
      'daily_digest',
      'top_story',
      'weekly_digest',
    ]);
  });

  it('drops hidden ids when the filter changes', () => {
    expect(keepVisibleSelection(['d1', 'w1'], ['d1'])).toEqual(new Set(['d1']));
  });

  it('summarizes a mixed selection for the confirm dialog', () => {
    expect(selectionKindSummary([daily, weekly, weekly2, top], ['d1', 'w1', 'w2'])).toBe(
      '1 daily, 2 weekly',
    );
  });

  it('counts weekly packages in the current selection', () => {
    expect(countSelectedKind([daily, weekly, weekly2], ['d1', 'w2'], 'weekly_digest')).toBe(1);
  });

  it('names Select all after the active filter', () => {
    expect(selectAllLabel('all')).toBe('Select all');
    expect(selectAllLabel('weekly_digest')).toBe('Select all Weekly');
  });

  it('mentions hidden weekly packages on the Daily filter', () => {
    expect(hiddenWeeklyHint('daily_digest', 4)).toBe(' 4 weekly packages are hidden.');
    expect(hiddenWeeklyHint('weekly_digest', 4)).toBe('');
  });

  it('warns when the cancel includes weekly digest packages', () => {
    expect(
      cancelConfirmMessage({
        count: 3,
        kindSummary: '1 daily, 2 weekly',
        weeklyCount: 2,
      }),
    ).toContain('This includes 2 weekly digest packages.');
  });

  it('labels known and unknown kinds', () => {
    expect(packageKindLabel('weekly_digest')).toBe('Weekly');
    expect(packageKindLabel('custom_pack')).toBe('custom pack');
  });
});
