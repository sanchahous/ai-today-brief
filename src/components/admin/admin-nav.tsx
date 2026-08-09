'use client';

import { useState } from 'react';
import Link from 'next/link';

const LINKS = [
  { href: '/admin', label: 'Today', short: 'Today', rail: 'To' },
  { href: '/admin/weekly', label: 'Weekly Digest', short: 'Weekly', rail: 'We' },
  { href: '/admin/calendar', label: 'Calendar', short: 'Plan', rail: 'Pl' },
  { href: '/admin/results', label: 'Results', short: 'Results', rail: 'Re' },
  { href: '/admin/costs', label: 'Costs', short: 'Costs', rail: 'Co' },
  { href: '/admin/engagement', label: 'Engagement', short: 'Engage', rail: 'En' },
  { href: '/admin/providers', label: 'Providers', short: 'Providers', rail: 'Pr' },
  { href: '/admin/settings', label: 'Settings', short: 'Settings', rail: 'Se' },
] as const;

export function AdminNav() {
  const [collapsed, setCollapsed] = useState(false);
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <>
      <aside
        className={`hidden shrink-0 overflow-hidden border-r border-white/10 bg-[#101418] transition-[width,padding] duration-200 lg:block ${
          collapsed ? 'w-16 p-2' : 'w-60 p-5'
        }`}
      >
        <div
          className={`mb-8 flex min-h-11 items-center ${
            collapsed ? 'justify-center' : 'justify-between gap-2'
          }`}
        >
          {collapsed ? null : (
            <Link href="/admin" className="text-lg font-bold tracking-tight text-white">
              <span className="text-[#47e4d3]">AT</span> Social CMS
            </Link>
          )}
          <button
            type="button"
            aria-controls="admin-desktop-navigation"
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={() => setCollapsed((value) => !value)}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-lg font-bold text-slate-300 transition hover:border-white/30 hover:bg-white/[.04] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47e4d3]"
          >
            <span aria-hidden>{collapsed ? '›' : '‹'}</span>
          </button>
        </div>
        <nav id="admin-desktop-navigation" aria-label="Admin navigation" className="grid gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-label={collapsed ? link.label : undefined}
              title={collapsed ? link.label : undefined}
              className={`rounded-xl font-semibold text-slate-300 transition hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47e4d3] ${
                collapsed
                  ? 'grid min-h-11 place-items-center px-1 text-[10px]'
                  : 'px-4 py-3 text-sm'
              }`}
            >
              {collapsed ? link.rail : link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <nav
        aria-label="Admin navigation"
        // grid-cols-4 (not -7): LINKS has 8 entries, so a 7-column grid
        // orphans the 8th item onto an unaccounted-for second row that
        // overlaps page content (see CmsLayout's matching bottom padding).
        // 4 columns gives two clean, evenly-spaced rows of four.
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#101418]/95 px-0.5 pt-1 pb-[max(.35rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="min-h-12 rounded-lg px-0.5 py-3 text-center text-[10px] font-semibold text-slate-300 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-[#47e4d3]"
          >
            {link.short}
          </Link>
        ))}
      </nav>
    </>
  );
}
