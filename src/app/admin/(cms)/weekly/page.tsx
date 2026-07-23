import Link from 'next/link';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { StatusPill } from '@/components/admin/status-pill';
import { createTestWeeklyDigestAction } from '@/app/admin/(cms)/weekly/actions';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getWeeklyDigestAdminList } from '@/lib/weekly-digest/admin-data';

export const dynamic = 'force-dynamic';

function dateLabel(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}

function dateTimeLabel(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export default async function WeeklyDigestListPage() {
  await requireSocialAdmin();
  const digests = await getWeeklyDigestAdminList();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">
            Weekly Digest
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Edition workspace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Prepare the bilingual article, PDFs, visual package, six social variants and one
            captioned YouTube video before the Monday release.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <form action={createTestWeeklyDigestAction}>
            <ActionSubmitButton
              idleLabel="Create test edition"
              pendingLabel="Creating test…"
              className="min-h-11 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-300/20"
            />
          </form>
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/6 px-4 py-3 text-right">
            <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">Monday window</p>
            <p className="mt-1 text-sm text-slate-300">
              Review and edits stay open until 15:45 Kyiv
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="editions-heading" className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 id="editions-heading" className="text-lg font-bold text-white">
            Editions
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {digests.length} in the last 52 weeks
          </span>
        </div>

        <div className="mt-4 grid gap-4">
          {digests.map((digest) => (
            <Link
              key={digest.id}
              href={`/admin/weekly/${digest.id}`}
              className="group rounded-2xl border border-white/10 bg-[#151b20] p-5 transition hover:border-[#47e4d3]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47e4d3]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={digest.status} />
                {digest.is_test ? (
                  <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-100 uppercase">
                    Test · publication locked
                  </span>
                ) : null}
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                  {digest.period_model === 'legacy_mon_sun'
                    ? 'Legacy Mon–Sun'
                    : digest.period_model === 'rolling_7d'
                      ? 'Rolling 7 days'
                      : 'Sun–Sat'}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {dateLabel(digest.week_start)} – {dateLabel(digest.week_end)}
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-bold text-white transition group-hover:text-[#7af0e4]">
                    {digest.title_en}
                  </h3>
                  <p className="mt-1 truncate text-sm text-slate-400">{digest.title_uk}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    /{digest.slug} · active revision{' '}
                    {digest.active_revision_id ? 'available' : 'not created'}
                  </p>
                </div>
                <dl className="grid min-w-60 grid-cols-2 gap-3 text-xs md:text-right">
                  <div>
                    <dt className="font-bold tracking-wide text-slate-500 uppercase">Preflight</dt>
                    <dd className="mt-1 text-slate-300">{dateTimeLabel(digest.preflight_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-bold tracking-wide text-slate-500 uppercase">Release</dt>
                    <dd className="mt-1 text-slate-300">{dateTimeLabel(digest.release_at)}</dd>
                  </div>
                </dl>
              </div>

              {digest.last_error ? (
                <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/8 px-3 py-2 text-sm text-red-200">
                  {digest.last_error}
                </p>
              ) : null}
            </Link>
          ))}

          {digests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <p className="font-semibold text-white">No Weekly Digest editions yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Create a test edition to review the rolling seven-day workflow before Monday.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
