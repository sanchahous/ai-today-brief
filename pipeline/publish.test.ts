import { describe, expect, it } from 'vitest';
import { isPublishedConflict } from './publish';

describe('isPublishedConflict', () => {
  it('treats an already-published brief on the same date as a conflict', () => {
    expect(isPublishedConflict({ status: 'published' })).toBe(true);
  });

  it('lets a still-draft brief be refreshed (idempotent re-run)', () => {
    expect(isPublishedConflict({ status: 'draft' })).toBe(false);
  });

  it('is not a conflict when no brief exists yet for the date', () => {
    expect(isPublishedConflict(null)).toBe(false);
    expect(isPublishedConflict(undefined)).toBe(false);
  });
});
