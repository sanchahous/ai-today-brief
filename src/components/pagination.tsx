'use client';

import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { trackEvent } from '@/lib/analytics-client';

export function Pagination({
  lang,
  page,
  pageCount,
  onChange,
}: {
  lang: Lang;
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const t = getStrings(lang).news;

  function change(next: number) {
    trackEvent('paginate', { to_page: next, page_count: pageCount });
    onChange(next);
  }

  return (
    <nav
      aria-label={t.page}
      className="border-border mt-8 flex items-center justify-center gap-3 border-t pt-6"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
        className="rounded-pill border-border text-muted hover:border-accent hover:text-accent border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t.prev}
      </button>
      <span className="text-muted text-sm tabular-nums">
        {t.page} {page} / {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => change(page + 1)}
        className="rounded-pill border-border text-muted hover:border-accent hover:text-accent border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t.next}
      </button>
    </nav>
  );
}
