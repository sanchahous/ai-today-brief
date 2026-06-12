import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockBodyScroll, unlockBodyScroll } from './body-scroll-lock';

function installDomStub({ scrollY = 240, innerWidth = 1200, clientWidth = 1183 } = {}) {
  const style: Record<string, string> = {
    overflow: '',
    position: '',
    top: '',
    width: '',
    paddingRight: '',
  };

  const body = { style };
  const documentElement = { clientWidth };
  const scrollTo = vi.fn();

  vi.stubGlobal('window', { scrollY, innerWidth, scrollTo });
  vi.stubGlobal('document', { body, documentElement });

  return { style, scrollTo };
}

describe('body scroll lock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fixes the body at the current scroll position and compensates for the scrollbar', () => {
    const { style } = installDomStub({ scrollY: 321, innerWidth: 1000, clientWidth: 983 });

    const snapshot = lockBodyScroll();

    expect(snapshot?.scrollY).toBe(321);
    expect(style.overflow).toBe('hidden');
    expect(style.position).toBe('fixed');
    expect(style.top).toBe('-321px');
    expect(style.width).toBe('100%');
    expect(style.paddingRight).toBe('17px');
  });

  it('restores inline body styles and scroll position on unlock', () => {
    const { style, scrollTo } = installDomStub({ scrollY: 99, innerWidth: 900, clientWidth: 900 });
    style.overflow = 'auto';
    style.position = 'relative';
    style.top = '1px';
    style.width = '90%';
    style.paddingRight = '4px';

    const snapshot = lockBodyScroll();
    unlockBodyScroll(snapshot);

    expect(style).toEqual({
      overflow: 'auto',
      position: 'relative',
      top: '1px',
      width: '90%',
      paddingRight: '4px',
    });
    expect(scrollTo).toHaveBeenCalledWith(0, 99);
  });

  it('is a server-side no-op', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);

    expect(lockBodyScroll()).toBeNull();
    expect(() => unlockBodyScroll(null)).not.toThrow();
  });
});
