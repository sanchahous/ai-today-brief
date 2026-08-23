import { describe, expect, it } from 'vitest';
import { rankFromStoryHash } from './weekly-toc';

describe('rankFromStoryHash', () => {
  it('accepts a positive weekly-story anchor', () => {
    expect(rankFromStoryHash('#story-3')).toBe(3);
  });

  it('rejects unrelated, zero, and malformed anchors', () => {
    expect(rankFromStoryHash('#stories')).toBeNull();
    expect(rankFromStoryHash('#story-0')).toBeNull();
    expect(rankFromStoryHash('#story-three')).toBeNull();
  });
});
