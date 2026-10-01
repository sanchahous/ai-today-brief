'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@/components/icons';
import { IconButton } from '@/components/ui/icon-button';
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
    <IconButton
      type="button"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? dayLabel : nightLabel}
      disabled={!ready}
    >
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </IconButton>
  );
}
