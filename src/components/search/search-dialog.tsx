'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { CloseIcon } from '@/components/icons';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/input';
import { SearchPreviewSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/ui/category-badge';
import { OverlayDrawer } from '@/components/ui/overlay-drawer';
import { useSearchDialog } from '@/hooks/use-search-dialog';
import { useSearchPreview, type SearchPreviewItem } from '@/hooks/use-search-preview';
import { trackEvent, trackSearch } from '@/lib/analytics-client';
import { getStrings } from '@/lib/i18n';
import type { TrendingTopic } from '@/lib/home';
import type { Lang } from '@/lib/site';

const PREVIEW_LIMIT = 5;
const NAV_WIDE_MQ = '(min-width: 60rem)';

function useNavWide(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(NAV_WIDE_MQ);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return wide;
}

function formatShort(iso: string, lang: Lang): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

function focusPageEntry(): void {
  requestAnimationFrame(() => {
    const main = document.getElementById('main-content');
    const h1 = main?.querySelector('h1');
    const target = h1 instanceof HTMLElement ? h1 : main;
    if (!(target instanceof HTMLElement)) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}

function ResultRow({
  item,
  lang,
  query,
  position,
  onPick,
  itemRef,
}: {
  item: SearchPreviewItem;
  lang: Lang;
  query: string;
  position: number;
  onPick: () => void;
  itemRef: (el: HTMLAnchorElement | null) => void;
}) {
  const t = getStrings(lang);

  return (
    <Link
      ref={itemRef}
      href={item.href}
      role="option"
      onClick={() => {
        trackEvent('select_search_result', {
          query,
          position,
          post_id: item.id,
        });
        onPick();
      }}
      className="hover:bg-surface block w-full rounded-lg px-3 py-2.5 no-underline transition-colors duration-200 md:px-4 md:py-3"
    >
      <span className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-accent text-2xs font-semibold tracking-wide uppercase">
          {t.searchResultType}
        </span>
        {item.categoryName ? (
          <CategoryBadge slug={item.categorySlug} name={item.categoryName} color={item.categoryColor} />
        ) : null}
        <span className="text-faint text-2xs">
          {item.sourceName ?? '—'} · {formatShort(item.date, lang)}
        </span>
      </span>
      <span className="text-text line-clamp-2 text-[0.88rem] leading-snug md:text-[0.95rem] md:leading-normal">
        {item.title}
      </span>
    </Link>
  );
}

/**
 * Unified archive search: idle trending, live preview, empty/error states, Ctrl/Cmd+K,
 * keyboard list navigation, and one route to `/[lang]/news/search?q=`.
 */
export function SearchDialog({
  lang,
  trending,
}: {
  lang: Lang;
  trending: TrendingTopic[];
}) {
  const t = getStrings(lang);
  const router = useRouter();
  const pathname = usePathname();
  const wide = useNavWide();
  const { open, triggerEl, closeSearchDialog } = useSearchDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const noResultsTracked = useRef('');
  const [query, setQuery] = useState('');
  const [vvHeight, setVvHeight] = useState<number | null>(null);

  const trimmed = query.trim();
  const { rows, total, loading, error, retry } = useSearchPreview(lang, query, PREVIEW_LIMIT, open);

  useEffect(() => {
    triggerRef.current = triggerEl;
  }, [triggerEl]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    closeSearchDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const main = document.getElementById('main-content');
    main?.setAttribute('inert', '');
    return () => main?.removeAttribute('inert');
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport || wide) return;
    const vv = window.visualViewport;
    const update = () => setVvHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setVvHeight(null);
    };
  }, [open, wide]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !trimmed || loading || error) return;
    if (rows.length > 0) {
      noResultsTracked.current = '';
      return;
    }
    if (noResultsTracked.current === trimmed) return;
    noResultsTracked.current = trimmed;
    trackEvent('search_no_results', { query: trimmed });
  }, [open, trimmed, loading, error, rows.length]);

  const navigateToSearch = useCallback(
    (value: string, source: string) => {
      const q = value.trim();
      trackSearch(q, source, lang, total);
      inputRef.current?.blur();
      router.push(q ? `/${lang}/news/search?q=${encodeURIComponent(q)}` : `/${lang}/news`);
      closeSearchDialog();
      focusPageEntry();
    },
    [closeSearchDialog, lang, router, total],
  );

  const pickResult = useCallback(() => {
    closeSearchDialog();
    focusPageEntry();
  }, [closeSearchDialog]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      const returnTo = triggerEl;
      inputRef.current?.blur();
      closeSearchDialog();
      if (returnTo) requestAnimationFrame(() => returnTo.focus({ preventScroll: true }));
    },
    [closeSearchDialog, triggerEl],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    navigateToSearch(query, wide ? 'dialog_desktop' : 'dialog_mobile');
  }

  function seeAll(source: string) {
    navigateToSearch(trimmed, source);
  }

  function onSuggest(name: string) {
    setQuery(name);
    inputRef.current?.focus();
  }

  const onResultsKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const items = resultRefs.current.filter((el): el is HTMLAnchorElement => el instanceof HTMLElement);
      if (!items.length) return;
      e.preventDefault();
      const active = document.activeElement;
      const index = items.indexOf(active as HTMLAnchorElement);
      if (e.key === 'ArrowDown') {
        const next = index < items.length - 1 ? items[index + 1] : items[0];
        next.focus();
        return;
      }
      if (index <= 0) {
        inputRef.current?.focus();
        return;
      }
      items[index - 1]?.focus();
    },
    [],
  );

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    document.addEventListener('keydown', onResultsKeyDown);
    return () => document.removeEventListener('keydown', onResultsKeyDown);
  }, [open, onResultsKeyDown]);

  const idleTopics = trending.slice(0, 8);
  const resultCountLabel =
    trimmed && !loading && !error && rows.length > 0
      ? t.searchResultCount.replace('{n}', String(total))
      : trimmed && !loading && !error && rows.length === 0
        ? t.searchNoResults
        : loading
          ? t.searchLoading
          : '';

  const panelInner = (
    <div
      data-testid="search-dialog-column"
      className={
        wide
          ? 'flex max-h-[min(70vh,560px)] flex-col p-4'
          : 'mx-auto flex h-full w-full max-w-[720px] flex-col px-4 pt-3'
      }
      style={!wide && vvHeight ? { height: `${vvHeight}px` } : undefined}
    >
      <form role="search" onSubmit={submit} className="flex shrink-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <SearchInput
            ref={inputRef}
            lang={lang}
            label={t.searchModalTitle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.landing.searchPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
            onClear={() => setQuery('')}
            className="text-base md:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          aria-label={t.searchClose}
          className="text-muted hover:text-text inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border-0 bg-transparent"
        >
          <CloseIcon />
        </button>
      </form>

      <p
        aria-live="polite"
        aria-atomic="true"
        data-testid="search-result-count"
        className="text-muted m-0 mt-3 min-h-5 shrink-0 text-sm"
      >
        {resultCountLabel}
      </p>

      <div className="border-border mt-2 shrink-0 border-t" />

      <div
        className={`mt-3 min-h-0 flex-1 ${wide ? 'max-h-[min(50vh,420px)] overflow-y-auto' : 'flex flex-1 flex-col overflow-hidden'}`}
      >
        {!trimmed ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-faint w-full text-sm">{t.landing.searchPopular}</span>
            {idleTopics.map((topic) => (
              <button
                key={topic.name}
                type="button"
                onClick={() => onSuggest(topic.name)}
                className="border-border bg-surface text-muted rounded-pill hover:border-accent hover:text-text touch-manipulation border px-3 py-1.5 text-sm transition-colors"
              >
                {topic.name}
              </button>
            ))}
          </div>
        ) : null}

        {trimmed && loading && rows.length === 0 && !error ? <SearchPreviewSkeleton /> : null}

        {trimmed && error ? (
          <ErrorState
            title={t.searchErrorTitle}
            description={t.searchErrorDescription}
            retryLabel={t.searchErrorRetry}
            onRetry={retry}
          />
        ) : null}

        {trimmed && !loading && !error && rows.length === 0 ? (
          <p className="text-muted m-0 px-1 py-3 text-sm">{t.searchNoResults}</p>
        ) : null}

        {trimmed && !error && rows.length > 0 ? (
          <div
            role="listbox"
            aria-label={t.searchAria}
            className={
              wide
                ? 'p-1'
                : 'relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y] p-1'
            }
          >
            {rows.map((item, index) => (
              <ResultRow
                key={item.id}
                item={item}
                lang={lang}
                query={trimmed}
                position={index + 1}
                onPick={pickResult}
                itemRef={(el) => {
                  resultRefs.current[index] = el;
                }}
              />
            ))}
            {total > PREVIEW_LIMIT ? (
              <Button
                variant="ghost"
                type="button"
                onClick={() => seeAll(wide ? 'dialog_desktop_see_all' : 'dialog_mobile_see_all')}
                className="mt-1 w-full !justify-start text-left text-accent"
              >
                {t.searchSeeAll.replace('{n}', String(total))} →
              </Button>
            ) : null}
            {!loading && total <= PREVIEW_LIMIT && total > 0 ? (
              <Button
                variant="ghost"
                type="button"
                onClick={() => seeAll(wide ? 'dialog_desktop_archive' : 'dialog_mobile_archive')}
                className="mt-1 w-full !justify-start text-left"
              >
                {t.searchOpenArchive} →
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <OverlayDrawer
      open={open}
      onOpenChange={handleOpenChange}
      ariaLabel={t.searchModalTitle}
      placement={wide ? 'center' : 'fullscreen'}
      triggerRef={triggerRef as RefObject<HTMLElement | null>}
      initialFocusRef={inputRef}
      panelTestId="search-dialog-panel"
      backdropTestId="search-dialog-backdrop"
      overlayClassName={wide ? undefined : 'bg-bg'}
      panelClassName={wide ? 'border-border border p-0' : 'bg-bg p-0'}
    >
      {panelInner}
    </OverlayDrawer>
  );
}

/** Global Ctrl/Cmd+K opener — mount once next to SearchDialog. */
export function SearchDialogShortcut({ lang: _lang }: { lang: Lang }) {
  const { open, openSearchDialog } = useSearchDialog();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (open) return;
      const active = document.activeElement;
      openSearchDialog(
        'keyboard',
        active instanceof HTMLElement ? active : null,
      );
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, openSearchDialog]);

  return null;
}
