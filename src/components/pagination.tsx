'use client';

import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { trackEvent } from '@/lib/analytics-client';
import { ArrowRight } from '@/components/icons';

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

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

  const pages = getPageNumbers(page, pageCount);

  return (
    <nav
      aria-label={t.page}
      className="border-border mt-8 flex flex-wrap items-center justify-center gap-1.5 border-t pt-6"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
        aria-label={t.prev}
        className="rounded-lg border-border text-muted hover:border-accent hover:text-accent flex items-center gap-1 border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowRight size={14} className="rotate-180" />
        <span className="hidden sm:inline">{t.prev}</span>
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`el-${i}`} className="text-faint px-1 text-sm select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => change(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[38px] rounded-lg border px-2.5 py-2 text-sm font-medium transition ${
              p === page
                ? 'border-accent bg-accent text-on-accent font-semibold'
                : 'border-border text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => change(page + 1)}
        aria-label={t.next}
        className="rounded-lg border-border text-muted hover:border-accent hover:text-accent flex items-center gap-1 border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="hidden sm:inline">{t.next}</span>
        <ArrowRight size={14} />
      </button>
    </nav>
  );
}
