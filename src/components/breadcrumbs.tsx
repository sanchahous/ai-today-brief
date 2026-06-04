import Link from 'next/link';
export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="text-muted m-0 flex list-none flex-wrap gap-1.5 p-0 text-[0.8rem]">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`} className="flex items-center gap-1.5">
              {it.href && !last ? (
                <Link className="text-accent hover:underline" href={it.href}>
                  {it.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'text-text' : ''}>
                  {it.label}
                </span>
              )}
              {!last && (
                <span aria-hidden className="text-faint">
                  /
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
