import Link from 'next/link';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { isDispatchableQueuedDailyVisualRecovery } from '@/lib/daily-visual/retry-state';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  dispatchQueuedDailyVisualRecoveryAction,
  retryDailyVisualDirectionAction,
  selectDailyVisualCandidateAction,
  uploadDailyVisualReplacementAction,
} from './actions';

export const dynamic = 'force-dynamic';

type CandidatePreview = {
  id: string;
  daily_visual_set_id: string;
  candidate_kind: string;
  attempt_number: number;
  parent_candidate_id: string | null;
  provider: string | null;
  model: string | null;
  prompt: string | null;
  source_url: string | null;
  rights_note: string | null;
  storage_bucket: string;
  storage_path: string;
  width: number;
  height: number;
  created_at: string;
};

type DailyVisualJobPreview = {
  daily_visual_set_id: string;
  retry_count: number;
  retry_mode: string | null;
  status: string;
};

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}

function qaLabel(outcomes: string[]) {
  if (outcomes.includes('failed') || outcomes.includes('error')) return 'QA did not pass';
  if (outcomes.filter((outcome) => outcome === 'passed').length >= 3) return 'Semantic QA passed';
  return outcomes.length ? 'QA incomplete' : 'No automatic QA';
}

function statusClass(status: string) {
  if (status === 'active') return 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100';
  if (status === 'needs_visual_choice') return 'border-amber-300/35 bg-amber-300/10 text-amber-100';
  if (status === 'failed') return 'border-rose-300/35 bg-rose-300/10 text-rose-100';
  return 'border-white/15 bg-white/[.04] text-slate-300';
}

export default async function DailyVisualsPage() {
  const session = await requireSocialAdmin();
  const db = getSupabaseAdmin();
  const [{ data: sets, error: setError }, { data: budget }] = await Promise.all([
    db
      .from('daily_visual_sets')
      .select(
        'id,editorial_date,status,active_candidate_id,latest_ai_candidate_id,fallback_candidate_id,display_title_en,display_title_uk,visual_thesis_en,visual_thesis_uk,direction',
      )
      .order('editorial_date', { ascending: false })
      .limit(20),
    db
      .from('daily_visual_budget_months')
      .select('month_start,cap_micro_usd,reserved_micro_usd,committed_micro_usd')
      .order('month_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (setError) throw new Error(`Could not load daily visual sets: ${setError.message}`);
  const setIds = (sets ?? []).map((set) => set.id);
  const [{ data: rawCandidates, error: candidateError }, { data: rawJobs, error: jobError }] =
    setIds.length
      ? await Promise.all([
          db
            .from('daily_visual_candidates')
            .select(
              'id,daily_visual_set_id,candidate_kind,attempt_number,parent_candidate_id,provider,model,prompt,source_url,rights_note,storage_bucket,storage_path,width,height,created_at',
            )
            .in('daily_visual_set_id', setIds)
            .order('created_at', { ascending: false }),
          db
            .from('daily_visual_jobs')
            .select('daily_visual_set_id,retry_count,retry_mode,status')
            .in('daily_visual_set_id', setIds),
        ])
      : [
          { data: [] as CandidatePreview[], error: null },
          { data: [] as DailyVisualJobPreview[], error: null },
        ];
  if (candidateError)
    throw new Error(`Could not load visual candidates: ${candidateError.message}`);
  if (jobError) throw new Error(`Could not load visual jobs: ${jobError.message}`);
  const candidates = (rawCandidates ?? []) as CandidatePreview[];
  const jobs = (rawJobs ?? []) as DailyVisualJobPreview[];
  const candidateIds = candidates.map((candidate) => candidate.id);
  const { data: qaRows, error: qaError } = candidateIds.length
    ? await db
        .from('daily_visual_candidate_qa')
        .select('candidate_id,stage,outcome')
        .in('candidate_id', candidateIds)
    : { data: [], error: null };
  if (qaError) throw new Error(`Could not load visual QA: ${qaError.message}`);

  const previews = new Map(
    await Promise.all(
      candidates.map(async (candidate) => {
        const { data } = await db.storage
          .from(candidate.storage_bucket)
          .createSignedUrl(candidate.storage_path, 60 * 60);
        return [candidate.id, data?.signedUrl ?? null] as const;
      }),
    ),
  );
  const candidatesBySet = new Map<string, CandidatePreview[]>();
  for (const candidate of candidates) {
    candidatesBySet.set(candidate.daily_visual_set_id, [
      ...(candidatesBySet.get(candidate.daily_visual_set_id) ?? []),
      candidate,
    ]);
  }
  const jobsBySet = new Map(jobs.map((job) => [job.daily_visual_set_id, job]));
  const qaByCandidate = new Map<string, string[]>();
  for (const row of qaRows ?? []) {
    qaByCandidate.set(row.candidate_id, [
      ...(qaByCandidate.get(row.candidate_id) ?? []),
      row.outcome,
    ]);
  }
  const spent = (budget?.reserved_micro_usd ?? 0) + (budget?.committed_micro_usd ?? 0);
  const money = (microUsd: number) => `$${(microUsd / 1_000_000).toFixed(2)}`;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">
            Daily visuals
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Choose the visual, not a gamble
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Each closed day keeps its frozen story snapshot, latest AI result and branded fallback
            private. Only an explicit selection becomes the public daily hero and six
            ready-to-review social drafts.
          </p>
        </div>
        <Link
          href="/admin"
          className="min-h-11 rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-white/30 hover:text-white"
        >
          Back to approval queue
        </Link>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Daily visual budget">
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Monthly hard cap
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {money(budget?.cap_micro_usd ?? 5_000_000)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Committed + held
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{money(spent)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Current ledger month
          </p>
          <p className="mt-2 text-lg font-bold text-white">
            {budget?.month_start ?? 'No visual yet'}
          </p>
        </div>
      </section>

      {(sets ?? []).length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
          No closed daily visual sets yet. The finalizer creates one only after the 20:00 Kyiv
          editorial cutoff and final publication.
        </section>
      ) : (
        <div className="mt-8 grid gap-8">
          {(sets ?? []).map((set) => {
            const setCandidates = candidatesBySet.get(set.id) ?? [];
            const job = jobsBySet.get(set.id);
            // The UI only reveals the exception for an owner with an active
            // MFA session. The RPC repeats stricter checks (including the
            // reservation state) so this remains advisory, never authority.
            const canRequestDirectionRetry =
              session.role === 'owner' &&
              session.aal === 'aal2' &&
              set.status === 'needs_visual_choice' &&
              job?.retry_count === 0 &&
              job.retry_mode === null &&
              set.active_candidate_id === null &&
              set.latest_ai_candidate_id === null &&
              set.fallback_candidate_id !== null &&
              setCandidates.length > 0 &&
              setCandidates.every((candidate) => candidate.candidate_kind === 'branded_fallback');
            const canDispatchQueuedRecovery =
              session.role === 'owner' &&
              session.aal === 'aal2' &&
              isDispatchableQueuedDailyVisualRecovery(
                job
                  ? {
                      status: job.status,
                      retryCount: job.retry_count,
                      retryMode: job.retry_mode,
                    }
                  : null,
              ) &&
              set.active_candidate_id === null;
            return (
              <section
                key={set.id}
                className="rounded-3xl border border-white/10 bg-white/[.025] p-4 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold tracking-[.16em] text-[#47e4d3] uppercase">
                      {dateLabel(set.editorial_date)}
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-white">
                      {set.display_title_en ?? 'Direction awaiting editorial output'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">{set.display_title_uk ?? '—'}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(set.status)}`}
                  >
                    {titleCase(set.status)}
                  </span>
                </div>

                <details className="mt-4 rounded-2xl border border-white/10 bg-[#0d1319] p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                    Private editorial direction and provenance
                  </summary>
                  <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-300 sm:grid-cols-2">
                    <p>
                      <span className="font-bold text-slate-100">EN thesis:</span>{' '}
                      {set.visual_thesis_en ?? 'Not available'}
                    </p>
                    <p>
                      <span className="font-bold text-slate-100">UK thesis:</span>{' '}
                      {set.visual_thesis_uk ?? 'Not available'}
                    </p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    This direction is frozen with the closed daily snapshot. Selecting a candidate
                    does not rewrite published stories or the canonical SEO title.
                  </p>
                </details>

                {canRequestDirectionRetry ? (
                  <form
                    action={retryDailyVisualDirectionAction}
                    className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/[.06] p-4"
                  >
                    <div className="max-w-3xl">
                      <h3 className="font-bold text-amber-100">One bounded AI recovery remains</h3>
                      <p className="mt-1 text-xs leading-5 text-amber-50/75">
                        The original fallback and its first direction ledger stay private and
                        unchanged. This asks for one fresh direction, one primary AI image and both
                        QA stages (maximum $0.084; no repair). A passing new AI candidate may be
                        published; the fallback is never auto-selected.
                      </p>
                    </div>
                    <input type="hidden" name="daily_visual_set_id" value={set.id} />
                    <ActionSubmitButton
                      idleLabel="Request one fresh AI candidate"
                      pendingLabel="Queuing recovery…"
                      className="min-h-11 rounded-xl border border-amber-200/50 bg-amber-200/10 px-4 text-sm font-bold text-amber-50 hover:bg-amber-200/20"
                    />
                  </form>
                ) : canDispatchQueuedRecovery ? (
                  <form
                    action={dispatchQueuedDailyVisualRecoveryAction}
                    className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/[.06] p-4"
                  >
                    <div className="max-w-3xl">
                      <h3 className="font-bold text-cyan-100">Recovery is safely queued</h3>
                      <p className="mt-1 text-xs leading-5 text-cyan-50/75">
                        The previous worker dispatch did not start. You can dispatch this same
                        one-shot recovery again without creating another AI attempt, changing the
                        fallback, or touching its budget reservation.
                      </p>
                    </div>
                    <input type="hidden" name="daily_visual_set_id" value={set.id} />
                    <ActionSubmitButton
                      idleLabel="Dispatch queued recovery"
                      pendingLabel="Dispatching worker…"
                      className="min-h-11 rounded-xl border border-cyan-200/50 bg-cyan-200/10 px-4 text-sm font-bold text-cyan-50 hover:bg-cyan-200/20"
                    />
                  </form>
                ) : null}

                <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {setCandidates.map((candidate) => {
                    const active = candidate.id === set.active_candidate_id;
                    const latestAi = candidate.id === set.latest_ai_candidate_id;
                    const fallback = candidate.id === set.fallback_candidate_id;
                    const outcomes = qaByCandidate.get(candidate.id) ?? [];
                    const preview = previews.get(candidate.id);
                    return (
                      <article
                        key={candidate.id}
                        className={`overflow-hidden rounded-2xl border ${
                          active
                            ? 'border-[#47e4d3]/70 bg-[#47e4d3]/[.06]'
                            : 'border-white/10 bg-[#0d1319]'
                        }`}
                      >
                        <div className="grid min-h-44 place-items-center bg-[#0b1623] p-2">
                          {preview ? (
                            // Private signed URL only reaches this authenticated dynamic page.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preview}
                              alt={`Private ${candidate.candidate_kind} preview for ${set.editorial_date}`}
                              className="max-h-72 w-full object-contain"
                            />
                          ) : (
                            <p className="text-xs text-slate-500">Private preview unavailable</p>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-white">
                              {titleCase(candidate.candidate_kind)}
                            </h3>
                            {active ? (
                              <span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-[11px] font-bold text-emerald-100">
                                Publicly selected
                              </span>
                            ) : null}
                            {latestAi ? (
                              <span className="rounded-full bg-cyan-300/15 px-2 py-0.5 text-[11px] font-bold text-cyan-100">
                                Latest AI
                              </span>
                            ) : null}
                            {fallback ? (
                              <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-bold text-amber-100">
                                Never auto-selected
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Attempt {candidate.attempt_number} · {candidate.width}×
                            {candidate.height} · {qaLabel(outcomes)}
                          </p>
                          {candidate.source_url ? (
                            <a
                              href={candidate.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block truncate text-xs text-[#47e4d3] underline underline-offset-4"
                            >
                              Official source
                            </a>
                          ) : null}
                          {candidate.rights_note ? (
                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              Rights: {candidate.rights_note}
                            </p>
                          ) : null}
                          {candidate.prompt ? (
                            <details className="mt-3 text-xs leading-5 text-slate-400">
                              <summary className="cursor-pointer font-semibold text-slate-300">
                                Stored render prompt
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap">{candidate.prompt}</p>
                            </details>
                          ) : null}
                          <form
                            action={selectDailyVisualCandidateAction}
                            className="mt-4 grid gap-2"
                          >
                            <input type="hidden" name="daily_visual_set_id" value={set.id} />
                            <input type="hidden" name="candidate_id" value={candidate.id} />
                            <label className="sr-only" htmlFor={`reason-${candidate.id}`}>
                              Selection reason
                            </label>
                            <input
                              id={`reason-${candidate.id}`}
                              name="reason"
                              maxLength={500}
                              placeholder="Why this is the clearest visual (optional)"
                              className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-slate-100 placeholder:text-slate-600"
                            />
                            <ActionSubmitButton
                              idleLabel={
                                active ? 'Rebuild ready social drafts' : 'Select this visual'
                              }
                              pendingLabel="Applying selection…"
                              className="min-h-10 rounded-lg border border-[#47e4d3]/45 bg-[#47e4d3]/10 px-3 text-xs font-bold text-[#b9fff7] hover:bg-[#47e4d3]/20"
                            />
                          </form>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <form
                  action={uploadDailyVisualReplacementAction}
                  encType="multipart/form-data"
                  className="mt-6 rounded-2xl border border-dashed border-white/20 bg-[#0d1319] p-4"
                >
                  <input type="hidden" name="daily_visual_set_id" value={set.id} />
                  <h3 className="font-bold text-white">Replace with trusted source material</h3>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
                    Use only an official press/media asset, an official product screenshot that
                    proves the story, or a file you are authorized to upload. It is normalized with
                    contain, never cropped; the prior AI and fallback candidates remain available
                    for comparison.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="grid gap-1 text-xs font-semibold text-slate-300">
                      Asset source
                      <select
                        name="source_kind"
                        defaultValue="official_source"
                        className="min-h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white"
                      >
                        <option value="official_source">Official source / product UI</option>
                        <option value="editor_upload">Editor-authorized upload</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-300">
                      Image (JPEG, PNG, WebP)
                      <input
                        required
                        name="file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="min-h-11 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-300"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-300">
                      Official source URL (required for official asset)
                      <input
                        name="source_url"
                        type="url"
                        placeholder="https://…"
                        className="min-h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-slate-600"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-300">
                      Rights / permission note
                      <input
                        required
                        name="rights_note"
                        maxLength={500}
                        placeholder="Official press kit / editor-approved"
                        className="min-h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-slate-600"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <label className="grid flex-1 gap-1 text-xs font-semibold text-slate-300">
                      Replacement rationale (stored in the immutable selection audit)
                      <input
                        name="reason"
                        maxLength={500}
                        placeholder="Why this source conveys the central change more clearly"
                        className="min-h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-slate-600"
                      />
                    </label>
                    <ActionSubmitButton
                      idleLabel="Upload and select replacement"
                      pendingLabel="Verifying and applying…"
                      className="min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#09201f] hover:bg-[#70eee1]"
                    />
                  </div>
                </form>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
