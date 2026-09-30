'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@/components/icons';
import { setUserProperties, trackEvent } from '@/lib/analytics-client';
import { applyTheme, readTheme, THEME_CHANGE_EVENT, type Theme } from '@/lib/theme';

/** The accessible name describes the destination; persistence and GA4 stay light/dark. */
export function ThemeToggle({ dayLabel, nightLabel }: { dayLabel: string; nightLabel: string }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setTheme(document.documentElement.dataset.theme === 'day' ? 'light' : 'dark');
    };
    // Both desktop and mobile controls must agree after toggles and viewport changes.
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    applyTheme(readTheme());
    setReady(true);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    trackEvent('theme_toggle', { to_theme: next });
    setUserProperties({ theme: next });
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Keep the current page usable when persisting the choice is blocked.
    }
  }

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? dayLabel : nightLabel}
      disabled={!ready}
      className="text-muted hover:text-text inline-flex h-[var(--touch-target-min)] w-[var(--touch-target-min)] shrink-0 touch-manipulation items-center justify-center border-0 bg-transparent transition-colors duration-200 disabled:opacity-50"
    >
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
