import Link from 'next/link';

const LINKS = [
  { href: '/admin', label: 'Today', short: 'Today' },
  { href: '/admin/weekly', label: 'Weekly Digest', short: 'Weekly' },
  { href: '/admin/calendar', label: 'Calendar', short: 'Plan' },
  { href: '/admin/results', label: 'Results', short: 'Results' },
  { href: '/admin/costs', label: 'Costs', short: 'Costs' },
  { href: '/admin/engagement', label: 'Engagement', short: 'Engage' },
  { href: '/admin/providers', label: 'Providers', short: 'Providers' },
  { href: '/admin/settings', label: 'Settings', short: 'Settings' },
] as const;

export function AdminNav() {
  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-[#101418] p-5 lg:block">
        <Link href="/admin" className="mb-8 block text-lg font-bold tracking-tight text-white">
          <span className="text-[#47e4d3]">AT</span> Social CMS
        </Link>
        <nav aria-label="Admin navigation" className="grid gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47e4d3]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <nav
        aria-label="Admin navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-white/10 bg-[#101418]/95 px-0.5 pt-1 pb-[max(.35rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
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
