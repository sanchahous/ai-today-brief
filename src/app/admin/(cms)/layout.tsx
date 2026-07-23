import Link from 'next/link';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireSocialAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSocialAdmin();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1600px]">
      <AdminNav />
      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-white/10 bg-[#0c1014]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold tracking-[.16em] text-[#47e4d3] uppercase">
              Social control plane
            </p>
            <p className="text-xs text-slate-500">
              {session.email} · {session.role} · {session.aal.toUpperCase()}
            </p>
          </div>
          <Link
            href="/admin/mfa"
            className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300"
          >
            Security
          </Link>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
