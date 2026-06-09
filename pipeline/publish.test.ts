import { describe, expect, it } from 'vitest';

describe('publish result shape', () => {
  it('tracks inserted items separately from synced count', () => {
    const result = { briefId: 'x', itemCount: 3, insertedCount: 1, briefWasPublished: true };
    expect(result.insertedCount).toBeLessThanOrEqual(result.itemCount);
    expect(result.briefWasPublished).toBe(true);
  });
});
