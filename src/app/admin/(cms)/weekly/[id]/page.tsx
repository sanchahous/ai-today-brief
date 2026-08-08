import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScrollFade } from '@/components/admin/scroll-fade';
import { StatusPill } from '@/components/admin/status-pill';
import {
  WEEKLY_WORKSPACE_TABS,
  WeeklyWorkspace,
  type WeeklyWorkspaceTab,
} from '@/components/admin/weekly-workspace';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getWeeklyDigestWorkspace } from '@/lib/weekly-digest/admin-data';
import { serverEpochMs } from '@/lib/server-clock';

export const dynamic = 'force-dynamic';

function isWorkspaceTab(value: string | undefined): value is WeeklyWorkspaceTab {
  return WEEKLY_WORKSPACE_TABS.some((tab) => tab.id === value);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}

function dateTimeLabel(value: string | null) {
  if (!value) return 'not set';
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

export default async function WeeklyDigestWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; save_error?: string | string[] }>;
}) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, requireSocialAdmin()]);
  const workspace = await getWeeklyDigestWorkspace(id);
  if (!workspace) notFound();

  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const saveError = Array.isArray(query.save_error) ? query.save_error[0] : query.save_error;
  const activeTab = isWorkspaceTab(requestedTab) ? requestedTab : 'overview';
  const revisionNumber = workspace.revision?.revision_number ?? null;
  const preflightAt = workspace.digest.preflight_at
    ? new Date(workspace.digest.preflight_at).getTime()
    : null;
  const cutoffReached = preflightAt !== null && serverEpochMs() >= preflightAt;
  const terminal =
    workspace.digest.status === 'published' || workspace.digest.status === 'cancelled';

  return (
    <div className="mx-auto max-w-[1440px]">
      <Link
        href="/admin/weekly"
        className="inline-flex min-h-11 items-center text-sm font-bold text-slate-400 transition hover:text-white"
      >
        ← All editions
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={workspace.digest.status} />
            {revisionNumber ? (
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                Revision {revisionNumber}
              </span>
            ) : null}
            <span className="text-xs text-slate-500">
              {dateLabel(workspace.digest.week_start)} – {dateLabel(workspace.digest.week_end)}
            </span>
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight text-white">
            {workspace.revision?.title_en ?? workspace.digest.title_en}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            {workspace.revision?.title_uk ?? workspace.digest.title_uk}
          </p>
        </div>

        <div
          className={`max-w-md rounded-2xl border p-4 ${
            cutoffReached && !terminal
              ? 'border-amber-400/25 bg-amber-400/7'
              : 'border-cyan-300/20 bg-cyan-300/6'
          }`}
        >
          <p
            className={`text-xs font-bold tracking-wide uppercase ${
              cutoffReached && !terminal ? 'text-amber-200' : 'text-cyan-200'
            }`}
          >
            Monday editorial window
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {terminal
              ? `This edition is ${workspace.digest.status}. Its revision history remains available.`
              : cutoffReached
                ? 'The 15:45 Kyiv preflight cutoff has been reached. Pause before editing, then re-approve and reschedule.'
                : `Review and editing stay open until ${dateTimeLabel(workspace.digest.preflight_at)}; release is ${dateTimeLabel(workspace.digest.release_at)}.`}
          </p>
        </div>
      </div>

      <nav
        aria-label="Weekly Digest workspace sections"
        className="sticky top-16 z-20 mt-7 border-y border-white/10 bg-[#0c1014]/95 backdrop-blur"
      >
        <ScrollFade>
          <div className="flex min-w-max gap-1 py-2">
            {WEEKLY_WORKSPACE_TABS.map((tab) => (
              <Link
                key={tab.id}
                href={`/admin/weekly/${workspace.digest.id}?tab=${tab.id}`}
                // This bar renders ~9 links back to this same force-dynamic
                // route (just a different ?tab=) and sits in the viewport on
                // every load with no scrolling — Next's default prefetch
                // (production-only) would fire a real server-executed request
                // per tab on every visit. Vercel Observability showed this
                // route as the single highest-invocation Function in the app;
                // manual tab clicks are cheap enough without prefetch.
                prefetch={false}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`min-h-11 rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-[#47e4d3] ${
                  activeTab === tab.id
                    ? 'bg-[#47e4d3] text-[#08211f]'
                    : 'text-slate-400 hover:bg-white/[.05] hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </ScrollFade>
      </nav>

      {saveError ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-300/35 bg-rose-300/10 px-4 py-3 text-sm leading-6 text-rose-100"
        >
          {saveError}
        </p>
      ) : null}

      <main className="mt-6">
        <WeeklyWorkspace workspace={workspace} activeTab={activeTab} session={session} />
      </main>
    </div>
  );
}
