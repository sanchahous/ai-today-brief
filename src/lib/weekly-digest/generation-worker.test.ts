import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: [] as unknown[],
  error: null as { message: string } | null,
}));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import {
  computeEnglishCheckpointHash,
  computeSocialCopyCheckpointHash,
  computeUkrainianCheckpointHash,
  masterInputStories,
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
  'video_script',
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

describe('computeEnglishCheckpointHash', () => {
  it('is deterministic for identical inputs', () => {
    const packs = [pack()];
    const guidance: WeeklyMasterRetryGuidance[] = [];
    expect(computeEnglishCheckpointHash(packs, guidance)).toBe(
      computeEnglishCheckpointHash(packs, guidance),
    );
  });

  it('changes when research packs change', () => {
    const a = computeEnglishCheckpointHash([pack({ revisionItemId: 'item-1' })], []);
    const b = computeEnglishCheckpointHash([pack({ revisionItemId: 'item-2' })], []);
    expect(a).not.toBe(b);
  });

  it('changes once English-tagged retry guidance from a saved critic verdict is present', () => {
    const before = computeEnglishCheckpointHash([pack()], []);
    const after = computeEnglishCheckpointHash([pack()], [
      { code: 'FACT-001', message: 'Unsupported claim', blocker: true } as unknown as WeeklyMasterRetryGuidance,
    ]);
    expect(before).not.toBe(after);
  });

  it('stays identical across two attempts that both failed before any guidance was saved', () => {
    // Mirrors the real failure mode: a transient provider/JSON error on the
    // critic step never produces a saved quality report, so retryGuidance
    // stays empty on the next attempt and the checkpoint should still hit.
    const packs = [pack(), pack({ revisionItemId: 'item-2', placement: 'radar' })];
    const attempt1 = computeEnglishCheckpointHash(packs, []);
    const attempt2 = computeEnglishCheckpointHash(packs, []);
    expect(attempt1).toBe(attempt2);
  });

  it('is unaffected by Ukrainian-only guidance -- a naturalness-only retry keeps the English/video cache valid', () => {
    // This is the exact case that motivated the split: "Master quality gate
    // failed (88/100): dimension "naturalness" scored 80/100 ...". Nothing
    // about the English content was wrong, so the next attempt must not pay
    // to regenerate it.
    const packs = [pack()];
    const withoutGuidance = computeEnglishCheckpointHash(packs, []);
    const withUkrainianGuidance = computeEnglishCheckpointHash(packs, [
      {
        code: 'dimension_low_score:naturalness',
        message: 'The "naturalness" dimension scored 80/100 (needs 80+).',
        locale: 'uk',
      } as WeeklyMasterRetryGuidance,
    ]);
    expect(withoutGuidance).toBe(withUkrainianGuidance);
  });
});

describe('computeUkrainianCheckpointHash', () => {
  it('is deterministic for identical inputs', () => {
    const packs = [pack()];
    const englishHash = computeEnglishCheckpointHash(packs, []);
    expect(computeUkrainianCheckpointHash(packs, englishHash, [])).toBe(
      computeUkrainianCheckpointHash(packs, englishHash, []),
    );
  });

  it('changes when Ukrainian-tagged guidance changes, independent of English guidance', () => {
    const packs = [pack()];
    const englishHash = computeEnglishCheckpointHash(packs, []);
    const before = computeUkrainianCheckpointHash(packs, englishHash, []);
    const after = computeUkrainianCheckpointHash(packs, englishHash, [
      {
        code: 'dimension_low_score:naturalness',
        message: 'The "naturalness" dimension scored 80/100 (needs 80+).',
        locale: 'uk',
      } as WeeklyMasterRetryGuidance,
    ]);
    expect(before).not.toBe(after);
  });

  it('changes when the upstream English checkpoint hash changes -- a fresh English pass always invalidates the translation', () => {
    const packs = [pack()];
    const before = computeUkrainianCheckpointHash(packs, 'english-hash-a', []);
    const after = computeUkrainianCheckpointHash(packs, 'english-hash-b', []);
    expect(before).not.toBe(after);
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

function revisionItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'revitem-1',
    brief_item_id: 'brief-1',
    rank: 1,
    title_en: 'Title',
    title_uk: 'Заголовок',
    summary_en: 'Summary sentence.',
    summary_uk: 'Речення підсумку.',
    why_en: null,
    why_uk: null,
    sources: [],
    source_snapshot: {},
    ...overrides,
  };
}

describe('masterInputStories (PR4 -- story angle join)', () => {
  it('attaches the angle when a direction exists for the story\'s brief_item_id', () => {
    const context = { items: [revisionItem()] } as unknown as Parameters<typeof masterInputStories>[0];
    const directions = new Map([['brief-1', 'Frame this as a cautionary infra-trust story.']]);
    const [story] = masterInputStories(context, [], directions);
    expect(story!.angle).toBe('Frame this as a cautionary infra-trust story.');
  });

  it('omits angle entirely (not an empty string) when no direction is set for this brief_item_id', () => {
    const context = { items: [revisionItem()] } as unknown as Parameters<typeof masterInputStories>[0];
    const [story] = masterInputStories(context, [], new Map([['brief-999', 'unrelated story']]));
    expect(story).not.toHaveProperty('angle');
  });

  it('defaults to no directions map at all without throwing', () => {
    const context = { items: [revisionItem()] } as unknown as Parameters<typeof masterInputStories>[0];
    expect(() => masterInputStories(context, [])).not.toThrow();
    expect(masterInputStories(context, [])[0]).not.toHaveProperty('angle');
  });

  it('never attaches an angle for an item with no linked brief_item_id', () => {
    const context = {
      items: [revisionItem({ brief_item_id: null })],
    } as unknown as Parameters<typeof masterInputStories>[0];
    const [story] = masterInputStories(context, [], new Map([['brief-1', 'should not apply']]));
    expect(story).not.toHaveProperty('angle');
  });
});
