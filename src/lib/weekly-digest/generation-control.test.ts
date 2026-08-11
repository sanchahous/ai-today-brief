import { describe, expect, it } from 'vitest';
import {
  backendForGenerationJob,
  clampMonotonicProgress,
  classifyGenerationFailure,
  estimateGenerationEta,
  redactGenerationMessage,
  stageManifest,
} from './generation-control';

describe('Weekly generation control helpers', () => {
  it('routes long editorial and semantic image jobs to GitHub Actions', () => {
    expect(backendForGenerationJob('editorial_master')).toBe('github_actions');
    expect(backendForGenerationJob('social_copy')).toBe('github_actions');
    expect(backendForGenerationJob('story_image')).toBe('github_actions');
    expect(backendForGenerationJob('research_pack')).toBe('vercel');
  });

  it('defines a complete, weighted master stage manifest', () => {
    expect(stageManifest('editorial_master').reduce((sum, stage) => sum + stage.weight, 0)).toBe(
      100,
    );
  });

  it('keeps progress monotonic and bounded', () => {
    expect(clampMonotonicProgress(42, 38)).toBe(42);
    expect(clampMonotonicProgress(42, 118)).toBe(100);
  });

  it('does not automatically retry validation, quality, or quota failures', () => {
    expect(classifyGenerationFailure('Master quality gate failed').retryable).toBe(false);
    expect(classifyGenerationFailure('schema validation failed').code).toBe('validation');
    expect(classifyGenerationFailure('provider quota exhausted').code).toBe('quota');
  });

  // A paused master run has every finished segment on the job row, so the
  // retry continues rather than restarting -- it must not be classified as a
  // plain timeout, and it must never read as a terminal quality failure.
  it('classifies a paused, resumable master run as retryable', () => {
    const paused = classifyGenerationFailure(
      'Master run paused with 9/14 segments saved — a retry resumes from the saved state. Reason: Run deadline reached while writing UK feature story #2.',
    );
    expect(paused).toMatchObject({ code: 'resumable', retryable: true });
  });

  it('retries transient network and timeout failures', () => {
    expect(classifyGenerationFailure('fetch failed: ECONNRESET').retryable).toBe(true);
    expect(classifyGenerationFailure('request timed out').code).toBe('timeout');
    expect(classifyGenerationFailure('provider returned HTTP 503').retryable).toBe(true);
  });

  it('redacts secrets before they reach the event ledger', () => {
    expect(redactGenerationMessage('Bearer secret-value api_key=abc123')).not.toContain('abc123');
    expect(redactGenerationMessage('Bearer secret-value api_key=abc123')).not.toContain(
      'secret-value',
    );
  });

  it('uses configured budget until enough history exists, then p50/p95', () => {
    expect(estimateGenerationEta([{ durationMs: 1000 }], 10_000).source).toBe('configured_budget');
    const eta = estimateGenerationEta(
      [1000, 2000, 3000, 4000, 5000].map((durationMs) => ({ durationMs })),
      10_000,
    );
    expect(eta).toMatchObject({ p50Ms: 3000, p95Ms: 5000, source: 'history' });
  });

  it('uses the latest 30 completed attempts rather than the slowest 30', () => {
    const samples = Array.from({ length: 31 }, (_, index) => ({
      durationMs: index === 0 ? 60_000 : 1_000,
      completedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }));
    expect(estimateGenerationEta(samples, 10_000)).toMatchObject({ p50Ms: 1_000, p95Ms: 1_000 });
  });
});
