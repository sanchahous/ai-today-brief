import type { ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/breadcrumbs';
import { Reveal } from '@/components/reveal';

type Props = {
  crumbs: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  maxWidth?: number;
};

/** Shared hero + breadcrumbs for trust/marketing pages (subscribe, advertise). */
export function TrustPageShell({
  crumbs,
  eyebrow,
  title,
  lead,
  children,
  maxWidth = 820,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <Breadcrumbs items={crumbs} />
      <Reveal>
        <header className="mb-8" style={{ maxWidth }}>
          <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{eyebrow}</p>
          <h1 className="mt-2 text-[clamp(1.8rem,4.5vw,2.5rem)] leading-tight">{title}</h1>
          <p className="text-muted mt-4 text-base leading-relaxed">{lead}</p>
        </header>
      </Reveal>
      <div style={{ maxWidth }}>{children}</div>
    </main>
  );
}
