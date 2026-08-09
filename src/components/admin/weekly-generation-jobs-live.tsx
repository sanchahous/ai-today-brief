'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusPill } from '@/components/admin/status-pill';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import {
  enqueueWeeklyGenerationAction,
  retryWeeklyGenerationJobAction,
} from '@/app/admin/(cms)/weekly/actions';
import { estimateGenerationEta } from '@/lib/weekly-digest/generation-control';

interface GenerationJob {
  id: string;
  attempts: number;
  created_at: string;
  current_model: string | null;
  current_provider: string | null;
  current_step: string | null;
  execution_backend: string;
  failure_code: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  job_type: string;
  last_error: string | null;
  max_attempts: number;
  next_attempt_at: string | null;
  progress_current: number;
  progress_total: number;
  revision_id: string;
  status: string;
  status_reason: string | null;
}

interface GenerationAttempt {
  id: string;
  job_id: string;
  attempt_number: number;
  backend: string;
  current_step: string | null;
  deadline_at: string | null;
  error_code: string | null;
  error_message: string | null;
  external_run_url: string | null;
  finished_at: string | null;
  heartbeat_at: string;
  model: string | null;
  progress_current: number;
  progress_total: number;
  provider: string | null;
  started_at: string;
  status: string;
}

interface GenerationEvent {
  id: number;
  job_id: string;
  attempt_id: string | null;
  created_at: string;
  event_type: string;
  level: string;
  message: string | null;
  model: string | null;
  provider: string | null;
  step: string | null;
}

interface HistoricalDuration {
  completedAt: string;
  durationMs: number;
  jobType: string;
  model: string;
  provider: string;
}

interface StatusPayload {
  jobs: GenerationJob[];
  attempts: GenerationAttempt[];
  events: GenerationEvent[];
  historicalDurations: HistoricalDuration[];
  cursor: number;
}

function dateTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function duration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function liveAttempt(job: GenerationJob, attempts: GenerationAttempt[]) {
  return attempts.find((attempt) => attempt.job_id === job.id) ?? null;
}

function elapsedMs(attempt: GenerationAttempt | null, now: number) {
  if (!attempt) return null;
  const start = new Date(attempt.started_at).getTime();
  const end = new Date(attempt.finished_at ?? now).getTime();
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
}

function statusText(job: GenerationJob, attempt: GenerationAttempt | null) {
  if (job.status_reason) return job.status_reason;
  if (job.status === 'waiting') return 'Waiting for the named dependency; no attempt is consumed.';
  if (job.status === 'queued')
    return `Queued for ${job.execution_backend === 'github_actions' ? 'GitHub Actions' : 'Vercel'}.`;
  if (job.status === 'dispatching') return 'Dedicated GitHub Actions worker is being dispatched.';
  if (job.status === 'retry_scheduled')
    return `Retry ${job.attempts + 1}/${job.max_attempts} is scheduled for ${dateTime(job.next_attempt_at)}.`;
  if (job.status === 'running')
    return `Active at ${job.current_step ?? attempt?.current_step ?? 'prepare'}.`;
  if (job.status === 'succeeded') return `Completed ${dateTime(job.finished_at)}.`;
  return job.last_error ?? 'Terminal failure. Create a linked manual retry to continue.';
}

function etaText(
  job: GenerationJob,
  attempt: GenerationAttempt | null,
  history: HistoricalDuration[],
  now: number,
) {
  if (!attempt || job.status !== 'running') return 'ETA —';
  const provider = job.current_provider ?? attempt.provider;
  const model = job.current_model ?? attempt.model;
  const elapsed = elapsedMs(attempt, now) ?? 0;
  const configuredBudgetMs =
    new Date(attempt.deadline_at ?? 0).getTime() - new Date(attempt.started_at).getTime();
  const eta = estimateGenerationEta(
    history
      .filter(
        (sample) =>
          sample.jobType === job.job_type && sample.provider === provider && sample.model === model,
      )
      .map((sample) => ({ durationMs: sample.durationMs, completedAt: sample.completedAt })),
    configuredBudgetMs > 0
      ? configuredBudgetMs
      : job.execution_backend === 'github_actions'
        ? 120 * 60 * 1000
        : 240 * 1000,
  );
  if (eta.source === 'history') {
    return `ETA ${duration(Math.max(0, eta.p50Ms - elapsed))}–${duration(Math.max(0, eta.p95Ms - elapsed))} (p50–p95, n=${eta.historicalSamples})`;
  }
  if (attempt.deadline_at) {
    const remaining = new Date(attempt.deadline_at).getTime() - now;
    return remaining > 0
      ? `ETA ≤ ${duration(remaining)} (configured budget; limited history n=${eta.historicalSamples})`
      : 'Deadline exceeded; waiting for stale-worker recovery.';
  }
  return 'ETA: collecting history.';
}

function mergeEvents(current: GenerationEvent[], incoming: GenerationEvent[]) {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((left, right) => right.id - left.id).slice(0, 250);
}

export function WeeklyGenerationJobsLive({
  digestId,
  revisionId,
  jobTypes,
  initialJobs,
  initialAttempts,
  initialEvents,
}: {
  digestId: string;
  revisionId: string | null;
  jobTypes: readonly string[];
  initialJobs: GenerationJob[];
  initialAttempts: GenerationAttempt[];
  initialEvents: GenerationEvent[];
}) {
  const [data, setData] = useState<StatusPayload>({
    jobs: initialJobs,
    attempts: initialAttempts,
    events: initialEvents,
    historicalDurations: [],
    cursor: initialEvents.reduce((largest, event) => Math.max(largest, event.id), 0),
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const cursor = useRef(data.cursor);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/admin/weekly/${encodeURIComponent(digestId)}/generation-status?after=${cursor.current}`,
          { cache: 'no-store', credentials: 'same-origin' },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as StatusPayload;
        if (cancelled) return;
        cursor.current = payload.cursor;
        setData((current) => ({
          jobs: payload.jobs,
          attempts: payload.attempts,
          events: mergeEvents(current.events, payload.events),
          historicalDurations: payload.historicalDurations,
          cursor: payload.cursor,
        }));
        setLastUpdatedAt(new Date().getTime());
      } catch {
        // The durable server-rendered snapshot remains visible during a transient poll failure.
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [digestId]);

  const allowed = useMemo(() => new Set(jobTypes), [jobTypes]);
  const jobs = data.jobs.filter((job) => allowed.has(job.job_type));

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[76rem] text-left text-sm">
        <thead className="text-xs font-bold tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="pb-3">Job</th>
            <th className="pb-3">State</th>
            <th className="pb-3">Attempt / backend</th>
            <th className="pb-3">Step / provider</th>
            <th className="pb-3">Progress / time</th>
            <th className="pb-3">Latest result / next action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {jobs.map((job) => {
            const attempt = liveAttempt(job, data.attempts);
            const progress = Math.min(
              100,
              Math.round((100 * job.progress_current) / Math.max(1, job.progress_total)),
            );
            const jobEvents = data.events.filter((event) => event.job_id === job.id).slice(0, 5);
            const elapsed =
              attempt && lastUpdatedAt ? duration(elapsedMs(attempt, lastUpdatedAt) ?? 0) : '—';
            const provider = job.current_provider ?? attempt?.provider;
            const model = job.current_model ?? attempt?.model;
            return (
              <tr key={job.id} className="align-top">
                <td className="py-3 font-semibold text-white">{job.job_type}</td>
                <td className="py-3">
                  <StatusPill value={job.status} />
                </td>
                <td className="py-3 text-xs leading-5 text-slate-300">
                  <p>
                    Attempt {job.attempts}/{job.max_attempts}
                  </p>
                  <p className="text-slate-500">
                    {job.execution_backend === 'github_actions' ? 'GitHub Actions' : 'Vercel'}
                  </p>
                  {attempt?.external_run_url ? (
                    <a
                      href={attempt.external_run_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#47e4d3] underline underline-offset-2"
                    >
                      Open run
                    </a>
                  ) : null}
                </td>
                <td className="py-3 text-xs leading-5 text-slate-300">
                  <p>{job.current_step ?? attempt?.current_step ?? '—'}</p>
                  <p className="text-slate-500">
                    {provider && model ? `${provider} / ${model}` : 'Provider not started yet'}
                  </p>
                </td>
                <td className="py-3 text-xs leading-5 text-slate-300">
                  <p>≈ {progress}%</p>
                  <p className="text-slate-500">
                    {job.execution_backend === 'github_actions' ? 'Actions time' : 'Elapsed'}{' '}
                    {elapsed}
                  </p>
                  <p className="text-slate-500">
                    {etaText(job, attempt, data.historicalDurations, lastUpdatedAt ?? 0)}
                  </p>
                  <p className="text-slate-500">
                    Heartbeat {dateTime(job.heartbeat_at ?? attempt?.heartbeat_at ?? null)}
                  </p>
                </td>
                <td className="max-w-md py-3 text-xs leading-5">
                  <p
                    className={
                      job.status === 'failed'
                        ? 'whitespace-pre-wrap text-red-200'
                        : 'text-slate-300'
                    }
                  >
                    {statusText(job, attempt)}
                  </p>
                  {job.failure_code ? (
                    <p className="mt-1 text-amber-200">Code: {job.failure_code}</p>
                  ) : null}
                  {job.status === 'failed' ? (
                    <form action={retryWeeklyGenerationJobAction} className="mt-2">
                      <input type="hidden" name="weekly_digest_id" value={digestId} />
                      <input type="hidden" name="job_id" value={job.id} />
                      <button
                        type="submit"
                        className="min-h-9 rounded-lg border border-[#47e4d3]/40 px-3 text-xs font-bold text-[#47e4d3] transition hover:bg-[#47e4d3]/10"
                      >
                        Create linked retry
                      </button>
                    </form>
                  ) : null}
                  {job.job_type === 'editorial_master' &&
                  job.status === 'succeeded' &&
                  revisionId &&
                  job.revision_id === revisionId ? (
                    <form action={enqueueWeeklyGenerationAction} className="mt-2">
                      <input type="hidden" name="weekly_digest_id" value={digestId} />
                      <input type="hidden" name="revision_id" value={revisionId} />
                      <input type="hidden" name="job_type" value="editorial_master" />
                      <ActionSubmitButton
                        idleLabel="Regenerate master"
                        pendingLabel="Queueing…"
                        className="min-h-9 rounded-lg border border-[#47e4d3]/40 px-3 text-xs font-bold text-[#47e4d3] transition hover:bg-[#47e4d3]/10"
                      />
                      <p className="mt-1 text-slate-500">
                        Runs the writer/critic loop again against the same approved research,
                        billed on top of this revision&apos;s spend cap.
                      </p>
                    </form>
                  ) : null}
                  {job.last_error && job.status !== 'failed' ? (
                    <p className="mt-1 whitespace-pre-wrap text-red-200">{job.last_error}</p>
                  ) : null}
                  {jobEvents.length > 0 ? (
                    <details className="mt-2 text-slate-500">
                      <summary className="cursor-pointer text-[#47e4d3]">
                        Timeline ({jobEvents.length})
                      </summary>
                      <ol className="mt-2 space-y-1 border-l border-white/10 pl-3">
                        {jobEvents.map((event) => (
                          <li key={event.id}>
                            {dateTime(event.created_at)} · {event.step ?? event.event_type}
                            {event.provider && event.model
                              ? ` · ${event.provider}/${event.model}`
                              : ''}
                            {event.message ? ` · ${event.message}` : ''}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {jobs.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No generation jobs for this tab yet.
        </p>
      ) : null}
      <p className="mt-3 text-right text-xs text-slate-600">
        Live status refreshes every 5 seconds
        {lastUpdatedAt ? ` · updated ${dateTime(new Date(lastUpdatedAt).toISOString())}` : ''}.
      </p>
    </div>
  );
}
