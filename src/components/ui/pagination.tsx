'use client';

import { type MouseEvent } from 'react';
import { ArrowRight } from '@/components/icons';

export interface AccessiblePaginationProps {
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  onChange?: (page: number) => void;
  getPageHref?: (page: number) => string;
  prevLabel?: string;
  nextLabel?: string;
  ariaLabel?: string;
  className?: string;
}

export type PaginationProps = AccessiblePaginationProps;

export function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

export function AccessiblePagination({
  page,
  pageCount,
  onPageChange,
  onChange,
  getPageHref = (p) => (p === 1 ? '?' : `?page=${p}`),
  prevLabel = 'Previous',
  nextLabel = 'Next',
  ariaLabel = 'Pagination',
  className = '',
}: AccessiblePaginationProps) {
  if (pageCount <= 1) return null;

  const triggerChange = onPageChange ?? onChange ?? (() => {});
  const pages = getPageNumbers(page, pageCount);

  function handleClick(e: MouseEvent<HTMLAnchorElement>, targetPage: number) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return; // Allow native open in new tab
    }
    e.preventDefault();
    if (targetPage !== page && targetPage >= 1 && targetPage <= pageCount) {
      triggerChange(targetPage);
    }
  }

  return (
    <nav
      data-testid="pagination"
      aria-label={ariaLabel}
      className={`border-border mt-8 flex flex-wrap items-center justify-center gap-2 border-t pt-6 ${className}`}
    >
      {/* Previous Button */}
      {page > 1 ? (
        <a
          href={getPageHref(page - 1)}
          onClick={(e) => handleClick(e, page - 1)}
          aria-label={prevLabel}
          rel="prev"
          className="border-border text-muted hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-[var(--focus)] inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-sm font-medium transition select-none outline-none"
        >
          <ArrowRight size={14} className="rotate-180" />
          <span className="hidden sm:inline">{prevLabel}</span>
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="border-border text-faint inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-sm font-medium opacity-40 select-none"
        >
          <ArrowRight size={14} className="rotate-180" />
          <span className="hidden sm:inline">{prevLabel}</span>
        </span>
      )}

      {/* Page Numbers */}
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span
            key={`el-${i}`}
            aria-hidden="true"
            className="text-faint inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1 font-mono text-sm select-none"
          >
            …
          </span>
        ) : (
          <a
            key={p}
            href={getPageHref(p)}
            onClick={(e) => handleClick(e, p)}
            aria-current={p === page ? 'page' : undefined}
            className={`focus-visible:ring-2 focus-visible:ring-[var(--focus)] inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border px-3.5 py-2 font-mono text-sm font-medium transition select-none outline-none ${
              p === page
                ? 'border-text bg-text text-bg font-bold shadow-xs'
                : 'border-border text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {p}
          </a>
        ),
      )}

      {/* Next Button */}
      {page < pageCount ? (
        <a
          href={getPageHref(page + 1)}
          onClick={(e) => handleClick(e, page + 1)}
          aria-label={nextLabel}
          rel="next"
          className="border-border text-muted hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-[var(--focus)] inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-sm font-medium transition select-none outline-none"
        >
          <span className="hidden sm:inline">{nextLabel}</span>
          <ArrowRight size={14} />
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="border-border text-faint inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-sm font-medium opacity-40 select-none"
        >
          <span className="hidden sm:inline">{nextLabel}</span>
          <ArrowRight size={14} />
        </span>
      )}
    </nav>
  );
}

export { AccessiblePagination as Pagination };
