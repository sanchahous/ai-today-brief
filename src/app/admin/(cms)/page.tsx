import Link from 'next/link';
import { StatusPill } from '@/components/admin/status-pill';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { serverEpochMs } from '@/lib/server-clock';
import { generateTodayAction } from '../actions';

export const dynamic = 'force-dynamic';

function qualityCounts(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { blocking: 0, warnings: 0 };
  const report = value as { blocking?: unknown; warnings?: unknown };
  return {
    blocking: Array.isArray(report.blocking) ? report.blocking.length : 0,
    warnings: Array.isArray(report.warnings) ? report.warnings.length : 0,
  };
}

export default async function AdminTodayPage() {
  await requireSocialAdmin();
  const supabase = getSupabaseAdmin();
  const now = serverEpochMs();
  const [{ data: packages }, { data: settings }, { data: accounts }] = await Promise.all([
    supabase
      .from('social_packages')
      .select('*')
      .not('status', 'in', '(posted,cancelled)')
      .order('source_date', { ascending: false })
      .limit(20),
    supabase.from('social_settings').select('*').eq('id', true).single(),
    supabase.from('social_accounts').select('*').order('channel'),
  ]);
  const packageIds = (packages ?? []).map((item) => item.id);
  const { data: posts } = packageIds.length
    ? await supabase
        .from('social_posts')
        .select('id,package_id,channel,status,quality_report,scheduled_for,last_error')
        .in('package_id', packageIds)
        .order('scheduled_for')
    : { data: [] };
  const postsByPackage = new Map<string, NonNullable<typeof posts>>();
  for (const post of posts ?? []) {
    if (!post.package_id) continue;
    postsByPackage.set(post.package_id, [...(postsByPackage.get(post.package_id) ?? []), post]);
  }
  const failures = (posts ?? []).filter(
    (post) => post.status === 'failed' || post.status === 'needs_reconciliation',
  );
  const tokenWarnings = (accounts ?? []).filter(
    (account) =>
      account.connection_health !== 'healthy' ||
      (account.token_expires_at &&
        new Date(account.token_expires_at).getTime() < now + 7 * 86_400_000),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Today</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Your approval queue</h1>
          <p className="mt-2 text-sm text-slate-400">Review the day’s package in 3–5 minutes.</p>
        </div>
        <form action={generateTodayAction}>
          <button className="min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#0a2321] hover:bg-[#70eee1]">
            Generate today
          </button>
        </form>
      </div>

      <section aria-label="System state" className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Publishing</p>
          <p
            className={`mt-2 text-lg font-bold ${settings?.global_kill_switch ? 'text-red-300' : 'text-emerald-300'}`}
          >
            {settings?.global_kill_switch ? 'Globally paused' : 'Enabled channels live'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Needs attention
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{failures.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Account warnings
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{tokenWarnings.length}</p>
        </div>
      </section>

      {failures.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/8 p-4">
          <h2 className="font-bold text-red-200">Delivery incidents</h2>
          <ul className="mt-3 grid gap-2 text-sm text-red-100/80">
            {failures.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/admin/packages/${post.package_id}`}
                  className="underline underline-offset-4"
                >
                  {post.channel}: {post.last_error ?? post.status}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-white">Packages</h2>
        <div className="mt-4 grid gap-4">
          {(packages ?? []).map((socialPackage) => {
            const variants = postsByPackage.get(socialPackage.id) ?? [];
            const blockers = variants.reduce(
              (sum, post) => sum + qualityCounts(post.quality_report).blocking,
              0,
            );
            const warnings = variants.reduce(
              (sum, post) => sum + qualityCounts(post.quality_report).warnings,
              0,
            );
            return (
              <Link
                key={socialPackage.id}
                href={`/admin/packages/${socialPackage.id}`}
                className="rounded-2xl border border-white/10 bg-[#151b20] p-4 transition hover:border-[#47e4d3]/50 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={socialPackage.risk_level} />
                  <StatusPill value={socialPackage.status} />
                  <span className="ml-auto text-xs text-slate-500">
                    {socialPackage.source_date}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-white">{socialPackage.title}</h3>
                <p className="mt-1 text-sm text-slate-400 capitalize">
                  {socialPackage.kind.replaceAll('_', ' ')} ·{' '}
                  {variants.map((post) => post.channel).join(', ') || 'No variants'}
                </p>
                <div className="mt-4 flex gap-4 text-xs font-semibold">
                  <span className={blockers ? 'text-red-300' : 'text-emerald-300'}>
                    {blockers} blockers
                  </span>
                  <span className="text-amber-200">{warnings} warnings</span>
                </div>
              </Link>
            );
          })}
          {(packages ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              Nothing is waiting. Generate today’s packages after the brief is published and
              approved.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
