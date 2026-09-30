import { SEMANTIC_TOKENS } from '@/lib/design-system/tokens';

/** Persisted preferences and analytics keep their pre-After Hours values. */
export type Theme = 'dark' | 'light';
export const THEME_CHANGE_EVENT = 'atb-theme-change';

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // A blocked store still permits using the system preference.
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const name = theme === 'light' ? 'day' : 'night';
  root.classList.toggle('theme-light', theme === 'light');
  root.dataset.theme = name;
  root.style.colorScheme = theme;
  for (const meta of document.querySelectorAll('meta[data-theme-color]')) {
    meta.setAttribute('media', meta.getAttribute('data-theme-color') === name ? 'all' : 'not all');
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Static palette shared by the manifest and the parser-blocking head script. */
export const THEME_COLORS = {
  night: SEMANTIC_TOKENS.night.bg,
  day: SEMANTIC_TOKENS.day.bg,
};
