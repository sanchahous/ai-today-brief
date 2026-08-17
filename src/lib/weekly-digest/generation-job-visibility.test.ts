import { describe, expect, it } from 'vitest';
import { partitionGenerationJobsForDisplay } from './generation-job-visibility';

interface Job {
  id: string;
  created_at: string;
  job_type: string;
  status: string;
}

function job(id: string, status: string, createdAt: string, jobType = 'social_copy'): Job {
  return { id, status, created_at: createdAt, job_type: jobType };
}

describe('partitionGenerationJobsForDisplay', () => {
  it('shows only the latest terminal Social run and collapses superseded failures', () => {
    const result = partitionGenerationJobsForDisplay(
      [
        job('failed-old', 'failed', '2026-08-17T18:00:00Z'),
        job('failed-newer', 'failed', '2026-08-17T19:00:00Z'),
        job('success', 'succeeded', '2026-08-17T20:00:00Z'),
      ],
      ['social_copy'],
    );

    expect(result.current.map(({ id }) => id)).toEqual(['success']);
    expect(result.history.map(({ id }) => id)).toEqual(['failed-newer', 'failed-old']);
  });

  it('keeps active Social jobs prominent while retaining completed runs in history', () => {
    const result = partitionGenerationJobsForDisplay(
      [
        job('success', 'succeeded', '2026-08-17T20:00:00Z'),
        job('queued', 'queued', '2026-08-17T20:01:00Z'),
        job('running', 'running', '2026-08-17T20:02:00Z'),
      ],
      ['social_copy'],
    );

    expect(result.current.map(({ id }) => id)).toEqual(['running', 'queued']);
    expect(result.history.map(({ id }) => id)).toEqual(['success']);
  });

  it('preserves full job history for non-Social tabs', () => {
    const jobs = [
      job('research-1', 'failed', '2026-08-17T18:00:00Z', 'research'),
      job('research-2', 'succeeded', '2026-08-17T19:00:00Z', 'research'),
    ];

    expect(partitionGenerationJobsForDisplay(jobs, ['research'])).toEqual({
      current: jobs,
      history: [],
    });
  });
});
