import { describe, it, expect } from 'vitest';
import { computeMasterCheckpointHash } from './generation-worker';
import type { WeeklyResearchPack } from './content-studio';
import type { WeeklyMasterRetryGuidance } from './editorial-llm';

function pack(overrides: Partial<WeeklyResearchPack> = {}): WeeklyResearchPack {
  return {
    schemaVersion: 'weekly-research-v2',
    digestId: 'digest-1',
    revisionId: 'revision-1',
    revisionItemId: 'item-1',
    placement: 'feature',
    primarySource: { url: 'https://example.com', title: 'Example', publishedAt: '2026-01-01' },
    corroboratingSources: [],
    claims: [],
    context: [],
    contradictions: [],
    limitations: [],
    risks: [],
    researchedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as WeeklyResearchPack;
}

describe('computeMasterCheckpointHash', () => {
  it('is deterministic for identical inputs', () => {
    const packs = [pack()];
    const guidance: WeeklyMasterRetryGuidance[] = [];
    expect(computeMasterCheckpointHash(packs, guidance)).toBe(computeMasterCheckpointHash(packs, guidance));
  });

  it('changes when research packs change', () => {
    const a = computeMasterCheckpointHash([pack({ revisionItemId: 'item-1' })], []);
    const b = computeMasterCheckpointHash([pack({ revisionItemId: 'item-2' })], []);
    expect(a).not.toBe(b);
  });

  it('changes once retry guidance from a saved critic verdict is present', () => {
    const before = computeMasterCheckpointHash([pack()], []);
    const after = computeMasterCheckpointHash([pack()], [
      { code: 'FACT-001', message: 'Unsupported claim', blocker: true } as unknown as WeeklyMasterRetryGuidance,
    ]);
    expect(before).not.toBe(after);
  });

  it('stays identical across two attempts that both failed before any guidance was saved', () => {
    // Mirrors the real failure mode: a transient provider/JSON error on the
    // critic step never produces a saved quality report, so retryGuidance
    // stays empty on the next attempt and the checkpoint should still hit.
    const packs = [pack(), pack({ revisionItemId: 'item-2', placement: 'radar' })];
    const attempt1 = computeMasterCheckpointHash(packs, []);
    const attempt2 = computeMasterCheckpointHash(packs, []);
    expect(attempt1).toBe(attempt2);
  });
});
