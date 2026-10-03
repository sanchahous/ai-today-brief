import { describe, expect, it, vi } from 'vitest';
import {
  closeSearchDialog,
  getServerSnapshot,
  getSnapshot,
  openSearchDialog,
  setHeroVisible,
  subscribe,
} from '@/lib/search-dialog-store';

describe('search-dialog-store', () => {
  it('returns a stable server snapshot', () => {
    expect(getServerSnapshot()).toEqual({
      open: false,
      source: null,
      heroVisible: false,
      triggerEl: null,
    });
  });

  it('opens, closes, and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    openSearchDialog('header', null);
    expect(getSnapshot()).toMatchObject({ open: true, source: 'header', triggerEl: null });
    expect(listener).toHaveBeenCalledTimes(1);

    setHeroVisible(true);
    expect(getSnapshot().heroVisible).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    closeSearchDialog();
    expect(getSnapshot()).toEqual({
      open: false,
      source: null,
      heroVisible: true,
      triggerEl: null,
    });
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
  });
});
