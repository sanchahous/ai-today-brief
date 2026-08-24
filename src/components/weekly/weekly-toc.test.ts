import { describe, expect, it } from 'vitest';
import {
  activeRankFromStoryViewport,
  rankFromStoryHash,
  shouldKeepAnchorActiveDuringSmoothScroll,
} from './weekly-toc';

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

describe('activeRankFromStoryViewport', () => {
  it('uses the story crossed by the orientation line instead of a transient observer entry', () => {
    expect(
      activeRankFromStoryViewport(
        [
          { rank: 1, top: -120, bottom: 920 },
          { rank: 2, top: 980, bottom: 1_800 },
        ],
        1_000,
      ),
    ).toBe(1);
  });

  it('keeps the preceding story active in a visual gap and switches once the next story crosses', () => {
    expect(
      activeRankFromStoryViewport(
        [
          { rank: 1, top: -900, bottom: 80 },
          { rank: 2, top: 420, bottom: 1_200 },
        ],
        1_000,
      ),
    ).toBe(1);
    expect(
      activeRankFromStoryViewport(
        [
          { rank: 1, top: -1_300, bottom: -20 },
          { rank: 2, top: 180, bottom: 960 },
        ],
        1_000,
      ),
    ).toBe(2);
  });

  it('does not mark a story before any story is visible on a narrow first screen', () => {
    expect(activeRankFromStoryViewport([{ rank: 1, top: 1_100, bottom: 1_700 }], 800)).toBeNull();
  });
});

describe('shouldKeepAnchorActiveDuringSmoothScroll', () => {
  it('holds the clicked TOC item until a below-the-fold target reaches the orientation line', () => {
    expect(
      shouldKeepAnchorActiveDuringSmoothScroll({ rank: 4, top: 1_400, bottom: 2_200 }, 1_000),
    ).toBe(true);
    expect(
      shouldKeepAnchorActiveDuringSmoothScroll({ rank: 4, top: 160, bottom: 960 }, 1_000),
    ).toBe(false);
  });

  it('holds an upward target until it has returned into the viewport', () => {
    expect(
      shouldKeepAnchorActiveDuringSmoothScroll({ rank: 2, top: -700, bottom: -40 }, 1_000),
    ).toBe(true);
  });
});
