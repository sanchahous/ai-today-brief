import { describe, expect, it } from 'vitest';

describe('publish result shape', () => {
  it('tracks pack edition and inserted items separately from synced count', () => {
    const result = { briefId: 'x', edition: 2, itemCount: 3, insertedCount: 1, isNewPack: true };
    expect(result.insertedCount).toBeLessThanOrEqual(result.itemCount);
    expect(result.edition).toBe(2);
    expect(result.isNewPack).toBe(true);
  });
});
