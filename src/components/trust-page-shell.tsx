import type { ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/breadcrumbs';
import { LinkTabs } from '@/components/ui/tabs';
import { getStrings } from '@/lib/i18n';
import { LEGAL_DOCS, POLICY_KEYS, type PolicyKey } from '@/lib/legal';
import type { Lang } from '@/lib/site';

type Props = {
  crumbs: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  maxWidth?: number;
};

/** Shared hero + breadcrumbs for trust/marketing pages (subscribe, advertise). */
export function TrustPageShell({ crumbs, eyebrow, title, lead, children, maxWidth = 820 }: Props) {
  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <Breadcrumbs items={crumbs} />
      <header className="mb-8" style={{ maxWidth }}>
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{eyebrow}</p>
        <h1 data-gesture="curtain" className="mt-2 text-[clamp(1.8rem,4.5vw,2.5rem)] leading-tight">
          {title}
        </h1>
        <p data-gesture="reveal" data-gesture-delay="90" className="text-muted mt-4 text-base leading-relaxed">
          {lead}
        </p>
      </header>
      <div style={{ maxWidth }}>{children}</div>
    </div>
  );
}

type PolicySection = { id: string; title: string };

/** Static reading layout; policy copy remains separate from navigation. */
export function PolicyPageShell({
  lang,
  policyKey,
  title,
  intro,
  updated,
  sections,
  children,
}: {
  lang: Lang;
  policyKey: PolicyKey;
  title: string;
  intro: string;
  updated?: string;
  sections: PolicySection[];
  children: ReactNode;
}) {
  const t = getStrings(lang);
  const contents = lang === 'uk' ? 'Зміст' : 'Contents';
  const tabs = POLICY_KEYS.map((key) => ({
    id: key,
    label: key === 'editorial-policy' ? t.editorialPolicy : LEGAL_DOCS[key].title[lang],
    href: `/${lang}/${key}`,
  }));

  return (
    <div className="max-w-page px-gutter py-section-y mx-auto w-full">
      <Breadcrumbs
        items={[{ label: t.home, href: `/${lang}` }, { label: title }]}
        className="[&_a]:min-h-[var(--touch-target-min)] [&_a]:min-w-[var(--touch-target-min)]"
      />
      <article data-policy-document data-testid="policy-document" className="min-w-0 [overflow-wrap:anywhere]">
        <header className="max-w-reading mb-8">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {updated && (
            <p className="text-muted mt-2 text-sm">
              {t.lastUpdated}:{' '}
              <time dateTime={updated}>
                {new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(`${updated}T00:00:00Z`))}
              </time>
            </p>
          )}
          <p className="mt-6 text-base leading-relaxed">{intro}</p>
        </header>
        <LinkTabs
          tabs={tabs}
          activeTabId={policyKey}
          ariaLabel={lang === 'uk' ? 'Політики' : 'Policies'}
          wrap
          className="border-border mb-8 border-b pb-4"
        />
        <div className="tablet:grid-cols-[minmax(0,1fr)_minmax(0,var(--reading))] tablet:gap-12 grid min-w-0 gap-8">
          <aside className="min-w-0">
            <nav aria-label={contents} className="tablet:sticky tablet:top-[var(--space-24)]">
              <span className="text-muted mb-3 block text-xs font-semibold tracking-wide uppercase">
                {contents}
              </span>
              <ul className="space-y-1">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-muted hover:text-text flex min-h-[var(--touch-target-min)] items-center rounded-sm py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <div className="max-w-reading min-w-0 space-y-8">{children}</div>
        </div>
      </article>
    </div>
  );
}
