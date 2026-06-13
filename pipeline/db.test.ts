import { describe, expect, it } from 'vitest';
import { articleScoreColumns, autoReviewComment, computeNextBriefEdition } from './db';

describe('computeNextBriefEdition', () => {
  it('refreshes an existing draft pack', () => {
    expect(computeNextBriefEdition({ edition: 2 }, { edition: 2, status: 'draft' })).toEqual({
      mode: 'draft',
      edition: 2,
    });
  });

  it('opens edition 1 on a new calendar day', () => {
    expect(computeNextBriefEdition(null, null)).toEqual({ mode: 'insert', edition: 1 });
  });

  it('opens the next pack after publish', () => {
    expect(computeNextBriefEdition(null, { edition: 1, status: 'published' })).toEqual({
      mode: 'insert',
      edition: 2,
    });
    expect(computeNextBriefEdition(null, { edition: 3, status: 'published' })).toEqual({
      mode: 'insert',
      edition: 4,
    });
  });

  it('throws when latest is draft but no draft row was returned', () => {
    expect(() => computeNextBriefEdition(null, { edition: 1, status: 'draft' })).toThrow(
      'unexpected brief state',
    );
  });
});

describe('articleScoreColumns', () => {
  it('maps the score + all six components + version/cluster/as-of onto db columns', () => {
    const cols = articleScoreColumns({
      score: 0.42,
      mentions: 3,
      components: {
        velocity: 0.5,
        crossSource: 0.25,
        authority: 0.9,
        recency: 0.8,
        inbrief: 0.1,
        breadth: 0.2,
      },
      clusterId: 'abc123def456',
      version: 2,
      scoredAsOf: '2026-06-13T00:00:00.000Z',
    });
    expect(cols).toEqual({
      composite_score: 0.42,
      mentions_count: 3,
      score_velocity: 0.5,
      score_cross_source: 0.25,
      score_authority: 0.9,
      score_recency: 0.8,
      score_inbrief: 0.1,
      score_breadth: 0.2,
      score_version: 2,
      cluster_id: 'abc123def456',
      scored_as_of: '2026-06-13T00:00:00.000Z',
    });
  });
});

describe('autoReviewComment', () => {
  it('combines language flags and unsupported claims for the reviewer', () => {
    expect(
      autoReviewComment({
        uk_quality_flags: ['title_uk'],
        unsupported_claims: ['costs $5/1M tokens'],
      }),
    ).toBe('⚠️ Авто-перевірка: мова: title_uk | джерело не підтверджує: costs $5/1M tokens');
  });

  it('returns null when both checks are clean', () => {
    expect(autoReviewComment({ uk_quality_flags: [], unsupported_claims: [] })).toBeNull();
  });

  it('caps unsupported claims at three', () => {
    const comment = autoReviewComment({
      uk_quality_flags: [],
      unsupported_claims: ['a', 'b', 'c', 'd'],
    })!;
    expect(comment).toContain('a; b; c');
    expect(comment).not.toContain('d');
  });
});
