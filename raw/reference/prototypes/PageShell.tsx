import React from 'react';
import { Reveal } from './ui';
import { Breadcrumbs } from './features';
import type { ProtoPage, RouteParams } from './routes';

export interface Crumb {
  label: string;
  page?: ProtoPage;
  params?: RouteParams;
}

/**
 * Shared scaffold for the document-style pages (about, legal, advertise):
 * breadcrumb + eyebrow + H1 + lead in a consistent prose column. Page-level
 * SEO (usePageMeta / JSON-LD) stays in each page since it needs the route id.
 */
export function PageShell({
  crumbs,
  eyebrow,
  title,
  lead,
  children,
  maxWidth = 760,
  aside,
}: {
  crumbs?: Crumb[];
  eyebrow?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  maxWidth?: number;
  aside?: React.ReactNode;
}) {
  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <header style={{ maxWidth, marginBottom: '1.6rem' }}>
        {eyebrow && (
          <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
            {eyebrow}
          </p>
        )}
        <h1 style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.8rem)', lineHeight: 1.1, marginBottom: lead ? '0.7rem' : 0 }}>
          {title}
        </h1>
        {lead && (
          <p style={{ fontSize: '1.05rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0 }}>
            {lead}
          </p>
        )}
        {aside}
      </header>
      <Reveal>
        <div style={{ maxWidth }}>{children}</div>
      </Reveal>
    </div>
  );
}
