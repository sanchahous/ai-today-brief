import { describe, expect, it } from 'vitest';
import { autoReviewComment, computeNextBriefEdition } from './db';

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
