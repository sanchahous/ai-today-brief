import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { getSocialAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

interface AdminLoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const query = await searchParams;
  if (await getSocialAdminSession()) redirect('/admin');
  const initialError =
    query.error === 'callback_session'
      ? 'The email link could not create a browser session. Request a new code below.'
      : '';
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151b20] p-6 shadow-2xl sm:p-8">
        <p className="text-sm font-bold tracking-[.18em] text-[#47e4d3] uppercase">
          AI Today Brief
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Social CMS</h1>
        <p className="mt-3 mb-7 text-sm leading-6 text-slate-400">
          Private owner access. Publishing actions also require your authenticator.
        </p>
        <LoginForm initialError={initialError} />
      </section>
    </main>
  );
}
