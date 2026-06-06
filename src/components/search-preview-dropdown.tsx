'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CategoryBadge } from '@/components/home/category-badge';
import { SearchPreviewSkeleton } from '@/components/ui/skeleton';
import { useSearchPreview, type SearchPreviewItem } from '@/hooks/use-search-preview';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

const PREVIEW_LIMIT = 5;

function formatShort(iso: string, lang: Lang): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

function PreviewRow({
  item,
  lang,
  onPick,
}: {
  item: SearchPreviewItem;
  lang: Lang;
  onPick: () => void;
}) {
  return (
    <Link
      href={item.href}
      role="option"
      onClick={onPick}
      className="hover:bg-surface block w-full rounded-lg px-2.5 py-2 no-underline"
    >
      <span className="mb-1 flex flex-wrap items-center gap-2">
        {item.categoryName ? (
          <CategoryBadge name={item.categoryName} color={item.categoryColor} />
        ) : null}
        <span className="text-faint text-[0.72rem]">
          {item.sourceName ?? '—'} · {formatShort(item.date, lang)}
        </span>
      </span>
      <span className="text-text line-clamp-2 text-[0.88rem] leading-snug">{item.title}</span>
    </Link>
  );
}

/** Live top-N results under the search field (prototype SearchPreview). */
export function SearchPreviewDropdown({
  lang,
  query,
  open,
  variant,
  onNavigate,
}: {
  lang: Lang;
  query: string;
  open: boolean;
  variant: 'desktop' | 'mobile' | 'hero';
  onNavigate: () => void;
}) {
  const t = getStrings(lang);
  const router = useRouter();
  const { rows, total, loading } = useSearchPreview(lang, query, PREVIEW_LIMIT);
  const trimmed = query.trim();

  if (!open || !trimmed) return null;

  const panelClass =
    variant === 'desktop' || variant === 'hero'
      ? 'border-border bg-bg absolute top-[calc(100%+6px)] right-0 left-0 z-[80] max-h-[min(60vh,420px)] overflow-y-auto rounded-xl border p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]'
      : 'border-border mt-2 max-h-[50vh] overflow-y-auto rounded-xl border p-1';

  function seeAll() {
    router.push(`/${lang}/news?q=${encodeURIComponent(trimmed)}`);
    onNavigate();
  }

  return (
    <div role="listbox" aria-label={t.searchAria} className={panelClass}>
      {loading && rows.length === 0 ? (
        <SearchPreviewSkeleton />
      ) : null}
      {!loading && rows.length === 0 ? (
        <p className="text-muted m-0 px-3 py-3 text-sm">{t.searchNoResults}</p>
      ) : (
        rows.map((item) => (
          <PreviewRow key={item.id} item={item} lang={lang} onPick={onNavigate} />
        ))
      )}
      {total > PREVIEW_LIMIT ? (
        <button
          type="button"
          onClick={seeAll}
          className="text-accent bg-surface hover:bg-surface-2 mt-0.5 w-full rounded-lg border-0 px-3 py-2.5 text-left text-sm font-semibold"
        >
          {t.searchSeeAll.replace('{n}', String(total))} →
        </button>
      ) : null}
      {!loading && rows.length > 0 && total <= PREVIEW_LIMIT && total > 0 ? (
        <button
          type="button"
          onClick={seeAll}
          className="text-muted hover:text-text mt-0.5 w-full rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm"
        >
          {t.searchOpenArchive} →
        </button>
      ) : null}
    </div>
  );
}
