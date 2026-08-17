interface GenerationJobVisibilityRow {
  id: string;
  created_at: string;
  job_type: string;
  status: string;
}

const TERMINAL_STATUSES = new Set(['cancelled', 'failed', 'succeeded']);

/**
 * Social generation is frequently resumed through linked jobs. Keep the
 * current run (or latest terminal result) prominent and move superseded runs
 * into opt-in history so old failures do not look like current blockers.
 * Other workspace tabs retain their existing full-history presentation.
 */
export function partitionGenerationJobsForDisplay<T extends GenerationJobVisibilityRow>(
  jobs: T[],
  jobTypes: readonly string[],
): { current: T[]; history: T[] } {
  const allowed = new Set(jobTypes);
  const filtered = jobs.filter((job) => allowed.has(job.job_type));
  const socialOnly = jobTypes.length === 1 && jobTypes[0] === 'social_copy';

  if (!socialOnly || filtered.length <= 1) return { current: filtered, history: [] };

  const ordered = [...filtered].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
  const active = ordered.filter((job) => !TERMINAL_STATUSES.has(job.status));
  const current = active.length > 0 ? active : ordered.slice(0, 1);
  const currentIds = new Set(current.map((job) => job.id));

  return {
    current,
    history: ordered.filter((job) => !currentIds.has(job.id)),
  };
}
