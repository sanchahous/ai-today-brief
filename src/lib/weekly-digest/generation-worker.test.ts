import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: [] as unknown[],
  error: null as { message: string } | null,
}));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import {
  computeMasterCheckpointHash,
  computeSocialCopyCheckpointHash,
  runWeeklyDigestGenerationJobs,
} from './generation-worker';
import type { WeeklyResearchPack, WeeklyMasterBundle } from './content-studio';
import type { WeeklyMasterRetryGuidance } from './editorial-llm';
import type { SocialChannel, SocialLocale } from '@/lib/social/types';

const ALL_JOB_TYPES = [
  'research_pack',
  'editorial_master',
  'story_image',
  'cover',
  'social_copy',
  'video_manifest',
  'pdf',
  'social_asset',
];

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

function bundle(overrides: Partial<WeeklyMasterBundle> = {}): WeeklyMasterBundle {
  return {
    en: { title: 'Weekly Digest' },
    uk: { title: 'Тижневий дайджест' },
    video: {},
    socialAngles: [],
    ...overrides,
  } as unknown as WeeklyMasterBundle;
}

function locales(): Map<SocialChannel, SocialLocale> {
  return new Map([['x', 'en']]) as Map<SocialChannel, SocialLocale>;
}

describe('computeSocialCopyCheckpointHash', () => {
  it('is deterministic for identical inputs', () => {
    const input = { bundle: bundle(), sourceFacts: ['fact one'], locales: locales() };
    expect(computeSocialCopyCheckpointHash(input)).toBe(computeSocialCopyCheckpointHash(input));
  });

  it('changes when the approved article content changes', () => {
    const a = computeSocialCopyCheckpointHash({
      bundle: bundle({ en: { title: 'Version A' } as never }),
      sourceFacts: ['fact one'],
      locales: locales(),
    });
    const b = computeSocialCopyCheckpointHash({
      bundle: bundle({ en: { title: 'Version B' } as never }),
      sourceFacts: ['fact one'],
      locales: locales(),
    });
    expect(a).not.toBe(b);
  });

  it('changes when the default locale map changes', () => {
    const a = computeSocialCopyCheckpointHash({
      bundle: bundle(),
      sourceFacts: ['fact one'],
      locales: new Map([['x', 'en']]) as Map<SocialChannel, SocialLocale>,
    });
    const b = computeSocialCopyCheckpointHash({
      bundle: bundle(),
      sourceFacts: ['fact one'],
      locales: new Map([['x', 'uk']]) as Map<SocialChannel, SocialLocale>,
    });
    expect(a).not.toBe(b);
  });
});

describe('runWeeklyDigestGenerationJobs job type filter', () => {
  beforeEach(() => {
    rpc.mockClear();
  });

  it('claims the full job type list when none is given, unchanged from before', async () => {
    await runWeeklyDigestGenerationJobs(5);
    expect(rpc).toHaveBeenCalledWith('claim_weekly_digest_generation_jobs', {
      p_job_types: ALL_JOB_TYPES,
      p_limit: 5,
    });
  });

  it('narrows the claim to the given job types', async () => {
    await runWeeklyDigestGenerationJobs(2, ['editorial_master']);
    expect(rpc).toHaveBeenCalledWith('claim_weekly_digest_generation_jobs', {
      p_job_types: ['editorial_master'],
      p_limit: 2,
    });
  });
});
