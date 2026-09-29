import { describe, expect, it } from 'vitest';
import { filterOptions, normalizeText } from './combobox-filter';
import { nextRovingIndex, typeaheadIndex } from './roving';
import { addToast, dismissToast, MAX_VISIBLE_TOASTS, resolveDuration, type Toast } from './toast-store';

describe('nextRovingIndex', () => {
  it('moves and wraps horizontally', () => {
    expect(nextRovingIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextRovingIndex(2, 'ArrowRight', 3)).toBe(0);
    expect(nextRovingIndex(0, 'ArrowLeft', 3)).toBe(2);
  });
  it('honours orientation', () => {
    expect(nextRovingIndex(0, 'ArrowDown', 3, { orientation: 'vertical' })).toBe(1);
    expect(nextRovingIndex(0, 'ArrowRight', 3, { orientation: 'vertical' })).toBeNull();
  });
  it('does not wrap when loop is off', () => {
    expect(nextRovingIndex(2, 'ArrowDown', 3, { orientation: 'vertical', loop: false })).toBe(2);
  });
  it('skips disabled items, including for Home/End', () => {
    const disabled = new Set([1, 0]);
    expect(nextRovingIndex(2, 'ArrowRight', 3, { disabled })).toBe(2);
    expect(nextRovingIndex(2, 'Home', 4, { disabled })).toBe(2);
    expect(nextRovingIndex(0, 'End', 4, { disabled: new Set([3]) })).toBe(2);
  });
  it('ignores other keys and empty lists', () => {
    expect(nextRovingIndex(0, 'a', 3)).toBeNull();
    expect(nextRovingIndex(0, 'ArrowRight', 0)).toBeNull();
  });
});

describe('typeaheadIndex', () => {
  const labels = ['Copy link', 'Share on X', 'Share on LinkedIn'];
  it('cycles through matches after the current item', () => {
    expect(typeaheadIndex(labels, 's', 0)).toBe(1);
    expect(typeaheadIndex(labels, 's', 1)).toBe(2);
    expect(typeaheadIndex(labels, 's', 2)).toBe(1);
  });
  it('returns null without a match', () => {
    expect(typeaheadIndex(labels, 'z', 0)).toBeNull();
    expect(typeaheadIndex(labels, '  ', 0)).toBeNull();
  });
});

describe('filterOptions', () => {
  const options = [
    { value: 'cc', label: 'Claude Code', keywords: 'anthropic cli' },
    { value: 'cur', label: 'Cursor' },
    { value: 'ai', label: 'Агенти' },
    { value: 'i', label: 'Індекси' },
  ];
  it('returns everything for an empty query', () => {
    expect(filterOptions(options, '  ')).toHaveLength(4);
  });
  it('ranks prefix above substring and matches keywords', () => {
    expect(filterOptions(options, 'c').map((o) => o.value)).toEqual(['cc', 'cur']);
    expect(filterOptions(options, 'anthropic').map((o) => o.value)).toEqual(['cc']);
    expect(filterOptions(options, 'ode').map((o) => o.value)).toEqual(['cc']);
  });
  it('is case-insensitive for Cyrillic and keeps ї/і distinct', () => {
    expect(filterOptions(options, 'АГЕ')).toHaveLength(1);
    expect(normalizeText('Café')).toBe('cafe');
    expect(normalizeText('Їжа')).toBe('їжа');
    expect(normalizeText('Йод')).not.toBe(normalizeText('Иод'));
  });
});

describe('toast store', () => {
  it('keeps errors visible for at least 8s and lets 0 mean sticky', () => {
    expect(resolveDuration('error', 2000)).toBe(8000);
    expect(resolveDuration('info', 2000)).toBe(2000);
    expect(resolveDuration('error', 0)).toBe(0);
  });
  it('caps the visible queue and drops the oldest', () => {
    let q: Toast[] = [];
    for (let i = 1; i <= MAX_VISIBLE_TOASTS + 2; i += 1) q = addToast(q, { message: `m${i}` }, i);
    expect(q.map((t) => t.id)).toEqual([3, 4, 5]);
  });
  it('replaces a toast with the same dedupeKey', () => {
    let q = addToast([], { message: 'Saving', dedupeKey: 'save' }, 1);
    q = addToast(q, { message: 'Saved', tone: 'success', dedupeKey: 'save' }, 2);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ id: 2, message: 'Saved', tone: 'success' });
  });
  it('dismisses by id', () => {
    const q = addToast(addToast([], { message: 'a' }, 1), { message: 'b' }, 2);
    expect(dismissToast(q, 1).map((t) => t.id)).toEqual([2]);
  });
});

import { computePlacement } from './placement';

describe('computePlacement', () => {
  const vp = { width: 400, height: 700 };
  const trig = (top: number, left = 20, w = 80) => ({ top, bottom: top + 44, left, right: left + w });

  it('opens below when there is room', () => {
    expect(computePlacement(trig(100), { width: 200, height: 150 }, vp)).toEqual({ vertical: 'bottom', horizontal: 'start' });
  });
  it('flips above near the bottom edge', () => {
    expect(computePlacement(trig(620), { width: 200, height: 200 }, vp).vertical).toBe('top');
  });
  it('stays below when both sides are too small but below has more room', () => {
    expect(computePlacement(trig(100), { width: 200, height: 900 }, vp).vertical).toBe('bottom');
  });
  it('flips to end alignment when start overflows the right edge', () => {
    expect(computePlacement(trig(100, 300), { width: 200, height: 100 }, vp).horizontal).toBe('end');
  });
  it('flips end to start when end overflows the left edge', () => {
    expect(computePlacement(trig(100, 0, 60), { width: 200, height: 100 }, vp, 'end').horizontal).toBe('start');
  });
});
