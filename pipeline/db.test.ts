import { describe, expect, it } from 'vitest';
import { computeNextBriefEdition, ukReviewComment } from './db';

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

describe('ukReviewComment', () => {
  it('lists the suspect fields for the reviewer', () => {
    expect(ukReviewComment(['title_uk', 'deep_dive_uk'])).toBe(
      '⚠️ Авто-перевірка мови: підозрілі поля — title_uk, deep_dive_uk',
    );
  });
});
