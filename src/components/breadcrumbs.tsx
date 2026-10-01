import Link from 'next/link';

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items, className = '' }: { items: BreadcrumbItem[]; className?: string }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`breadcrumbs pt-6 mb-4 ${className}`.trim()}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-0.5 p-0 text-sm">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`} className="inline-flex min-w-0 items-center gap-2 text-faint">
              {i > 0 && (
                <span aria-hidden="true" className="text-[var(--line-strong)] select-none">
                  /
                </span>
              )}
              {it.href && !last ? (
                <Link
                  href={it.href}
                  className="text-muted hover:text-accent focus-visible:ring-2 focus-visible:ring-[var(--focus)] inline-flex min-h-[32px] items-center transition-colors outline-none rounded-sm"
                >
                  {it.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="text-faint max-w-[42ch] truncate select-none"
                  title={it.label}
                >
                  {it.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function breadcrumbJsonLd(items: BreadcrumbItem[], siteUrl: string) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: `${siteUrl}${it.href}` } : {}),
    })),
  };
}
