import { describe, expect, it } from 'vitest';
import {
  applyLifecycle,
  buildGdeltUrl,
  classifyTrendCaptureHealth,
  parseGdeltTimeline,
  risingScore,
  selectStalestTrendEntities,
  TREND_ENTITIES,
} from './trend-signals';

describe('buildGdeltUrl', () => {
  it('requests a JSON timelinevol series for the encoded query', () => {
    const url = buildGdeltUrl('"model context protocol"', '3m');
    expect(url).toContain('mode=timelinevol');
    expect(url).toContain('format=json');
    expect(url).toContain('timespan=3m');
    // the quoted phrase is URL-encoded
    expect(url).toContain('query=%22model+context+protocol%22');
  });
});

describe('parseGdeltTimeline', () => {
  const body = JSON.stringify({
    timeline: [
      {
        series: 'Volume Intensity',
        data: [
          { date: '2026-03-01T00:00:00Z', value: 0.01 },
          { date: '2026-03-02T00:00:00Z', value: '0.02' }, // string value tolerated
          { date: '2026-03-03T00:00:00Z', value: 0.04 },
        ],
      },
    ],
  });

  it('extracts chronological {date,value} points from the documented shape', () => {
    const points = parseGdeltTimeline(body);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ date: '2026-03-01T00:00:00Z', value: 0.01 });
    expect(points[1]!.value).toBeCloseTo(0.02);
  });

  it('returns [] for junk, empty, or malformed bodies', () => {
    expect(parseGdeltTimeline('not json')).toEqual([]);
    expect(parseGdeltTimeline('{}')).toEqual([]);
    expect(parseGdeltTimeline(JSON.stringify({ timeline: [] }))).toEqual([]);
    expect(parseGdeltTimeline(JSON.stringify({ timeline: [{ data: 'nope' }] }))).toEqual([]);
  });
});

describe('risingScore', () => {
  it('is high for an accelerating series, zero for flat or declining', () => {
    const rising = risingScore([1, 1, 1, 1, 3, 4, 5]);
    const flat = risingScore([2, 2, 2, 2, 2, 2]);
    const declining = risingScore([5, 4, 3, 2, 1, 1]);
    expect(rising).toBeGreaterThan(0.5);
    expect(flat).toBe(0);
    expect(declining).toBe(0);
  });

  it('stays within [0,1] and needs at least three points', () => {
    expect(risingScore([1, 9])).toBe(0);
    const s = risingScore([1, 1, 1, 100, 100, 100]);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('applyLifecycle', () => {
  it('halves decaying entities, floors surging ones, leaves flat untouched', () => {
    expect(applyLifecycle(0.8, 'decay')).toBeCloseTo(0.4);
    expect(applyLifecycle(0.1, 'surge')).toBe(0.5); // floor
    expect(applyLifecycle(0.8, 'surge')).toBe(0.8); // already above floor
    expect(applyLifecycle(0.3, 'flat')).toBe(0.3);
  });
});

describe('TREND_ENTITIES', () => {
  it('is a non-empty set of unique keys with valid lifecycles', () => {
    expect(TREND_ENTITIES.length).toBeGreaterThan(10);
    const keys = TREND_ENTITIES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of TREND_ENTITIES) {
      expect(['surge', 'flat', 'decay']).toContain(e.lifecycle);
      expect(e.query.length).toBeGreaterThan(0);
    }
  });
});

describe('selectStalestTrendEntities', () => {
  const entities = TREND_ENTITIES.slice(0, 4);

  it('prioritises missing and oldest captures within the batch limit', () => {
    const lastCapturedAt = new Map([
      [entities[0]!.key, '2026-07-20T00:00:00Z'],
      [entities[1]!.key, '2026-07-18T00:00:00Z'],
      [entities[2]!.key, '2026-07-19T00:00:00Z'],
    ]);
    const selected = selectStalestTrendEntities(entities, lastCapturedAt, '2026-07-22', 3);
    expect(selected.map((entity) => entity.key)).toEqual([
      entities[3]!.key,
      entities[1]!.key,
      entities[2]!.key,
    ]);
  });

  it('rotates deterministic fallbacks when capture history is unavailable', () => {
    const first = selectStalestTrendEntities(entities, new Map(), '2026-07-22', 2);
    const next = selectStalestTrendEntities(entities, new Map(), '2026-07-23', 2);
    expect(first).toHaveLength(2);
    expect(next).toHaveLength(2);
    expect(next.map((entity) => entity.key)).not.toEqual(first.map((entity) => entity.key));
  });
});

describe('classifyTrendCaptureHealth', () => {
  it('separates complete, partial, and insufficient batches', () => {
    expect(classifyTrendCaptureHealth(6, 6)).toBe('healthy');
    expect(classifyTrendCaptureHealth(6, 2)).toBe('degraded');
    expect(classifyTrendCaptureHealth(6, 1)).toBe('failed');
    expect(classifyTrendCaptureHealth(0, 0)).toBe('failed');
  });
});
