const COLORS: Record<string, string> = {
  draft: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  in_review: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  changes_requested: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
  approved: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
  scheduled: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  publishing: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  published: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  paused: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  stale: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
  generating: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  queued: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  succeeded: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  posted: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  failed: 'border-red-400/40 bg-red-400/10 text-red-200',
  needs_reconciliation: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
  cancelled: 'border-slate-500/40 bg-slate-500/10 text-slate-400',
  green: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  yellow: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  red: 'border-red-400/40 bg-red-400/10 text-red-200',
};

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${COLORS[value] ?? COLORS.draft}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}
