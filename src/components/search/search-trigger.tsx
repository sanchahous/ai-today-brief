'use client';

import { useEffect, useState } from 'react';
import { SearchIcon } from '@/components/icons';
import { useSearchDialog } from '@/hooks/use-search-dialog';
import { getStrings } from '@/lib/i18n';
import type { SearchDialogSource } from '@/lib/search-dialog-store';
import type { Lang } from '@/lib/site';

function shortcutHint(): string {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl K';
}

/** Opens the unified SearchDialog from header, hero, or menu. */
export function SearchTrigger({
  lang,
  source,
  variant = 'compact',
  className = '',
  placeholder,
  testId,
}: {
  lang: Lang;
  source: SearchDialogSource;
  variant?: 'compact' | 'field' | 'hero';
  className?: string;
  placeholder?: string;
  testId?: string;
}) {
  const t = getStrings(lang);
  const { openSearchDialog } = useSearchDialog();
  const label = placeholder ?? t.landing.searchPlaceholder;
  const [hint, setHint] = useState('Ctrl K');

  useEffect(() => {
    setHint(shortcutHint());
  }, []);

  if (variant === 'hero') {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={(e) => {
          e.stopPropagation();
          openSearchDialog(source, e.currentTarget);
        }}
        aria-haspopup="dialog"
        aria-label={label}
        aria-keyshortcuts="Control+K Meta+K"
        className={`border-line bg-surface text-faint hover:border-accent flex w-full touch-manipulation items-center gap-3 rounded-pill border px-4 py-3 text-left text-base ${className}`}
      >
        <SearchIcon size={18} />
        <span className="truncate">{label}</span>
      </button>
    );
  }

  if (variant === 'field') {
    return (
      <button
        type="button"
        data-testid={testId ?? 'search-trigger-field'}
        onClick={(e) => openSearchDialog(source, e.currentTarget)}
        aria-haspopup="dialog"
        aria-label={t.searchOpen}
        aria-keyshortcuts="Control+K Meta+K"
        className={`border-line bg-surface focus-visible:border-accent flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${className}`}
      >
        <span aria-hidden className="text-muted shrink-0">
          <SearchIcon size={18} />
        </span>
        <span className="text-faint min-w-0 flex-1 truncate text-sm">{label}</span>
        <kbd className="text-faint hidden shrink-0 rounded border border-current px-1.5 py-0.5 text-2xs sm:inline">
          {hint}
        </kbd>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId ?? 'search-trigger-compact'}
      onClick={(e) => openSearchDialog(source, e.currentTarget)}
      aria-haspopup="dialog"
      aria-label={t.searchOpen}
      aria-keyshortcuts="Control+K Meta+K"
      className={`border-line bg-surface focus-visible:border-accent flex max-w-[clamp(10rem,24vw,26rem)] min-w-[10rem] items-center gap-2 rounded-lg border px-3 py-2 text-left lg:max-w-[clamp(10rem,22vw,32rem)] xl:max-w-xl ${className}`}
    >
      <span aria-hidden className="text-muted shrink-0">
        <SearchIcon size={18} />
      </span>
      <span className="text-faint min-w-0 flex-1 truncate text-sm">{label}</span>
      <kbd className="text-faint hidden shrink-0 rounded border border-current px-1.5 py-0.5 text-2xs md:inline">
        {hint}
      </kbd>
    </button>
  );
}
