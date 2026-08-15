import Link from 'next/link';
import { requireSocialAdmin } from '@/lib/admin-auth';
import {
  aggregateGenerationCosts,
  illustrationBudgetFromLedger,
  listGenerationCosts,
} from '@/lib/generation-costs';
import { serverEpochMs } from '@/lib/server-clock';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const DAY_OPTIONS = [7, 30, 90] as const;

function parseDays(value: string | string[] | undefined): (typeof DAY_OPTIONS)[number] {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function IllustrationBudgetCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151b20] p-5">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireSocialAdmin();
  const params = await searchParams;
  const days = parseDays(params.days);
  const now = serverEpochMs();
  const since = new Date(now - days * 86_400_000).toISOString();
  const events = await listGenerationCosts({ since, limit: 500 });
  const totals = aggregateGenerationCosts(events);

  const digestIds = [
    ...new Set(events.map((event) => event.weekly_digest_id).filter(Boolean)),
  ] as string[];
  const supabase = getSupabaseAdmin();
  const { data: digests } = digestIds.length
    ? await supabase.from('weekly_digests').select('id,slug').in('id', digestIds)
    : { data: [] };
  const slugById = new Map((digests ?? []).map((digest) => [digest.id, digest.slug]));

  const kindRows = Object.entries(totals.byKind).sort((a, b) => b[1] - a[1]);
  const providerRows = Object.entries(totals.byProvider).sort((a, b) => b[1] - a[1]);
  const modelRows = Object.entries(totals.byModel).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const illustration = illustrationBudgetFromLedger(events);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Costs</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Generation spend</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-400">
        Ledger of LLM and image generation costs. Values marked{' '}
        <span className="text-slate-200">estimated</span> use provider rate cards (not the
        Cloudflare/OpenRouter invoice).{' '}
        <span className="text-slate-200">reported</span> comes from OpenRouter usage payloads.{' '}
        <span className="text-slate-200">subscription</span> is Claude CLI ($0 cash).
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {DAY_OPTIONS.map((option) => (
          <Link
            key={option}
            href={`/admin/costs?days=${option}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47e4d3] ${
              option === days
                ? 'bg-[#47e4d3] text-[#0b1218]'
                : 'border border-white/10 text-slate-300 hover:bg-white/8 hover:text-white'
            }`}
          >
            {option}d
          </Link>
        ))}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total', formatUsd(totals.totalUsd)],
          ['Events', totals.eventCount.toLocaleString()],
          ['LLM', formatUsd(totals.byKind.llm ?? 0)],
          ['Images', formatUsd(totals.byKind.image ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#151b20] p-5">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold tracking-wide text-slate-400 uppercase">
          Illustration budget
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Split from this window&apos;s <span className="text-slate-300">generation_cost_events</span>
          , not from policy caps. Weekly master / social / video LLM is excluded. Digest pixels
          stay owner-manual in <span className="text-slate-300">prompt_only</span>.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <IllustrationBudgetCard
            label="News images (auto)"
            value={formatUsd(illustration.newsImagesUsd)}
            hint="One file per story; thumb and full share it. Target ~$1.73–2.70/mo."
          />
          <IllustrationBudgetCard
            label="Digest images (API)"
            value={formatUsd(illustration.weeklyImagesUsd)}
            hint="Should stay $0 in prompt_only — owner generates off-account."
          />
          <IllustrationBudgetCard
            label="Prompts + QA"
            value={formatUsd(illustration.promptAndQaUsd)}
            hint="Daily cover director + post-upload critic. Target <$0.10/mo."
          />
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {[
          ['By kind', kindRows],
          ['By provider', providerRows],
          ['By model', modelRows],
        ].map(([title, rows]) => (
          <div key={String(title)} className="rounded-2xl border border-white/10 bg-[#151b20] p-5">
            <h2 className="text-sm font-bold tracking-wide text-slate-400 uppercase">{title}</h2>
            <ul className="mt-4 grid gap-2">
              {(rows as Array<[string, number]>).length === 0 ? (
                <li className="text-sm text-slate-500">No spend in this window.</li>
              ) : (
                (rows as Array<[string, number]>).map(([name, amount]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 text-sm text-slate-200"
                  >
                    <span className="truncate font-medium">{name}</span>
                    <span className="shrink-0 tabular-nums text-white">{formatUsd(amount)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-[#151b20]">
        <div className="grid min-w-[52rem] grid-cols-[9rem_5rem_5rem_7rem_minmax(8rem,1.4fr)_6rem_5.5rem_minmax(6rem,1fr)] gap-2 border-b border-white/10 px-4 py-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
          <span>When</span>
          <span>Scope</span>
          <span>Kind</span>
          <span>Provider</span>
          <span>Model</span>
          <span>Cost</span>
          <span>Source</span>
          <span>Digest</span>
        </div>
        {events.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            No generation cost events yet. They appear after the next weekly/daily image or LLM run.
          </p>
        ) : (
          events.map((event) => {
            const slug = event.weekly_digest_id
              ? slugById.get(event.weekly_digest_id)
              : undefined;
            return (
              <div
                key={event.id}
                className="grid min-w-[52rem] grid-cols-[9rem_5rem_5rem_7rem_minmax(8rem,1.4fr)_6rem_5.5rem_minmax(6rem,1fr)] gap-2 border-b border-white/5 px-4 py-3 text-sm last:border-0"
              >
                <span className="text-slate-300">{formatWhen(event.created_at)}</span>
                <span className="capitalize text-slate-200">{event.scope}</span>
                <span className="capitalize text-slate-200">{event.kind}</span>
                <span className="truncate text-slate-200">{event.provider}</span>
                <span className="truncate font-mono text-xs text-slate-300" title={event.model}>
                  {event.model}
                </span>
                <span className="tabular-nums font-semibold text-white">
                  {formatUsd(event.cost_usd)}
                </span>
                <span className="text-xs text-slate-400">{event.cost_source}</span>
                <span>
                  {event.weekly_digest_id ? (
                    <Link
                      href={`/admin/weekly/${event.weekly_digest_id}`}
                      className="text-[#47e4d3] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47e4d3]"
                    >
                      {slug ?? event.weekly_digest_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
