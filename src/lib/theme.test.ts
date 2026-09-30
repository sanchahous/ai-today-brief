import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readTheme, THEME_CHANGE_EVENT, THEME_COLORS } from './theme';
import { SEMANTIC_TOKENS } from './design-system/tokens';

afterEach(() => vi.unstubAllGlobals());

describe('theme preferences', () => {
  it.each([
    ['dark', true, 'dark'],
    ['light', false, 'light'],
    [null, true, 'light'],
    [null, false, 'dark'],
    ['invalid', true, 'light'],
  ])('resolves stored %s with system light=%s to %s', (stored, systemLight, expected) => {
    vi.stubGlobal('localStorage', { getItem: () => stored });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: systemLight }) });
    expect(readTheme()).toBe(expected);
  });

  it('uses the system preference if storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage blocked');
      },
    });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(readTheme()).toBe('light');
  });

  it.each(['light', 'dark'] as const)(
    'synchronizes the document and both controls for %s',
    (theme) => {
      const root = {
        classList: { toggle: vi.fn() },
        dataset: { theme: '' },
        style: { colorScheme: '' },
      };
      const night = { getAttribute: () => 'night', setAttribute: vi.fn() };
      const day = { getAttribute: () => 'day', setAttribute: vi.fn() };
      const dispatchEvent = vi.fn();
      vi.stubGlobal('document', { documentElement: root, querySelectorAll: () => [night, day] });
      vi.stubGlobal('window', { dispatchEvent });

      applyTheme(theme);

      const light = theme === 'light';
      expect(root.classList.toggle).toHaveBeenCalledWith('theme-light', light);
      expect(root.dataset.theme).toBe(light ? 'day' : 'night');
      expect(root.style.colorScheme).toBe(theme);
      expect(night.setAttribute).toHaveBeenCalledWith('media', light ? 'not all' : 'all');
      expect(day.setAttribute).toHaveBeenCalledWith('media', light ? 'all' : 'not all');
      expect(dispatchEvent.mock.calls[0][0].type).toBe(THEME_CHANGE_EVENT);
    },
  );

  it('uses the semantic backgrounds for browser chrome and the PWA splash', () => {
    expect(THEME_COLORS).toEqual({ night: SEMANTIC_TOKENS.night.bg, day: SEMANTIC_TOKENS.day.bg });
  });
});
