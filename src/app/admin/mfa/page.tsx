import { redirect } from 'next/navigation';
import { MfaForm } from '@/components/admin/mfa-form';
import { requireSocialAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminMfaPage() {
  const session = await requireSocialAdmin();
  if (session.aal === 'aal2') redirect('/admin');
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151b20] p-6 shadow-2xl sm:p-8">
        <p className="text-sm font-bold tracking-[.18em] text-[#47e4d3] uppercase">Second factor</p>
        <h1 className="mt-3 text-2xl font-bold text-white">Confirm it’s really you</h1>
        <p className="mt-3 mb-6 text-sm leading-6 text-slate-400">
          Approval, scheduling, publishing controls, and credentials require AAL2.
        </p>
        <MfaForm />
      </section>
    </main>
  );
}
