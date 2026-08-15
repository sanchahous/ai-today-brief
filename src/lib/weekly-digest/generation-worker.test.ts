import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: [] as unknown[],
  error: null as { message: string } | null,
}));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import {
  computeSocialCopyCheckpointHash,
  masterInputStories,
  masterRunStateFromOutput,
  runWeeklyDigestGenerationJobs,
} from './generation-worker';
import { computeMasterPlanHash } from './master-engine';
import type { Json } from '@/lib/database.types';
import type { WeeklyResearchPack, WeeklyMasterBundle } from './content-studio';
import type { WeeklyMasterRetryGuidance } from './editorial-llm';
import type { SocialChannel, SocialLocale } from '@/lib/social/types';
import type { WeeklyReportageSceneBriefResult } from '../../../pipeline/card-image';
import { exportManualImagePrompts } from '../../../pipeline/prompt-export';
import {
  produceStoryPrompts,
  resolveWeeklyStoryImageMode,
  storyImageJobPath,
} from './story-prompt-job';

const SHORT_JOB_TYPES = ['research_pack', 'cover', 'pdf', 'social_asset', 'video_manifest'];

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

describe('computeMasterPlanHash', () => {
  it('is deterministic for identical inputs', () => {
    const packs = [pack()];
    const guidance: WeeklyMasterRetryGuidance[] = [];
    expect(computeMasterPlanHash(packs, guidance)).toBe(computeMasterPlanHash(packs, guidance));
  });

  it('changes when research packs change, so stale segments are never resumed onto new evidence', () => {
    const a = computeMasterPlanHash([pack({ revisionItemId: 'item-1' })], []);
    const b = computeMasterPlanHash([pack({ revisionItemId: 'item-2' })], []);
    expect(a).not.toBe(b);
  });

  it('changes when retry guidance changes', () => {
    const packs = [pack()];
    const before = computeMasterPlanHash(packs, []);
    const after = computeMasterPlanHash(packs, [
      { code: 'dimension_low_score:naturalness', message: 'Fix the Ukrainian.', locale: 'uk' },
    ]);
    expect(after).not.toBe(before);
  });
});

describe('masterRunStateFromOutput', () => {
  const planHash = computeMasterPlanHash([pack()], []);
  const savedState = {
    master_run_state: {
      version: 'weekly-master-run-v2',
      planHash,
      segments: { 'en:story:item-1': { value: { body: 'x' }, metadata: {} } },
      repairs: [],
      repairAttempts: {},
      criticRounds: 0,
      quality: null,
      unresolved: [],
      calls: { english: [], ukrainian: [], critic: [] },
    },
  } as unknown as Json;

  it('restores a state written for the same plan', () => {
    expect(masterRunStateFromOutput(savedState, planHash)?.segments).toHaveProperty(
      'en:story:item-1',
    );
  });

  // A resume onto a different plan would splice copy written against
  // superseded research into a new edition -- the one silent-corruption risk
  // a resumable worker introduces.
  it('refuses a state written for a different plan', () => {
    expect(masterRunStateFromOutput(savedState, 'some-other-hash')).toBeNull();
  });

  it('refuses a state written by an older engine version', () => {
    const legacy = {
      master_run_state: { version: 'weekly-master-run-v1', planHash, segments: {} },
    } as unknown as Json;
    expect(masterRunStateFromOutput(legacy, planHash)).toBeNull();
  });

  it('returns null for an output that has no saved state at all', () => {
    expect(masterRunStateFromOutput({ quality_score: 90 } as unknown as Json, planHash)).toBeNull();
  });
});

function bundle(overrides: Partial<WeeklyMasterBundle> = {}): WeeklyMasterBundle {
  return {
    en: { title: 'Weekly Digest' },
    uk: { title: 'Тижневий дайджест' },
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

  it('claims only short jobs on the Vercel worker by default', async () => {
    await runWeeklyDigestGenerationJobs(5);
    expect(rpc).toHaveBeenCalledWith('claim_weekly_digest_generation_jobs_v2', {
      p_backend: 'vercel',
      p_job_types: SHORT_JOB_TYPES,
      p_limit: 5,
    });
  });

  it('passes the fenced GitHub job and dispatch token to the claim RPC', async () => {
    await runWeeklyDigestGenerationJobs(1, ['editorial_master'], {
      backend: 'github_actions',
      jobId: 'job-1',
      dispatchToken: 'token-1',
      externalRunId: '123',
      externalRunUrl: 'https://github.example/run/123',
    });
    expect(rpc).toHaveBeenCalledWith('claim_weekly_digest_generation_jobs_v2', {
      p_backend: 'github_actions',
      p_job_types: ['editorial_master'],
      p_limit: 1,
      p_job_id: 'job-1',
      p_dispatch_token: 'token-1',
      p_external_run_id: '123',
      p_external_run_url: 'https://github.example/run/123',
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
  it("attaches the angle when a direction exists for the story's brief_item_id", () => {
    const context = { items: [revisionItem()] } as unknown as Parameters<
      typeof masterInputStories
    >[0];
    const directions = new Map([['brief-1', 'Frame this as a cautionary infra-trust story.']]);
    const [story] = masterInputStories(context, [], directions);
    expect(story!.angle).toBe('Frame this as a cautionary infra-trust story.');
  });

  it('omits angle entirely (not an empty string) when no direction is set for this brief_item_id', () => {
    const context = { items: [revisionItem()] } as unknown as Parameters<
      typeof masterInputStories
    >[0];
    const [story] = masterInputStories(context, [], new Map([['brief-999', 'unrelated story']]));
    expect(story).not.toHaveProperty('angle');
  });

  it('defaults to no directions map at all without throwing', () => {
    const context = { items: [revisionItem()] } as unknown as Parameters<
      typeof masterInputStories
    >[0];
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

describe('weekly story image prompt_only mode', () => {
  const sceneInput = {
    headline: 'CLI tools land on the command line',
    summary: 'A plugin exposes server-side tools through a local command.',
  };
  const cfg = { geminiApiKey: '' };

  function sceneBrief(
    partial: Partial<WeeklyReportageSceneBriefResult> = {},
  ): WeeklyReportageSceneBriefResult {
    return {
      scene:
        'A brass adapter card being pushed into the expansion slot of a 1970s teleprinter terminal',
      source: 'openrouter',
      conceptLens: 'mechanism',
      metaphorTitle: 'Teleprinter adapter',
      storyContext: sceneInput.headline,
      meaning: sceneInput.summary,
      essence: sceneInput.headline,
      mechanism: 'A CLI plugin exposes server-side tools through a local command.',
      consequence: 'Developers invoke those tools from the command line.',
      visualThesis: 'An adapter card connecting into a terminal lets the old system run new tools.',
      readerTest: 'grasp: server-side tools now plug into the command line',
      storyAnchor: 'a brass adapter card in a teleprinter slot',
      visibleMechanism: 'the card connecting server tools into the local command',
      visibleConsequence: 'the old terminal runs the new tools',
      ...partial,
    };
  }

  it('story_image job in prompt_only mode writes a prompt set and never calls the image provider', async () => {
    const generateWeeklyReportageIllustrations = vi.fn();
    const sceneBriefs = vi.fn(async () => [
      sceneBrief({ conceptLens: 'literal_context', metaphorTitle: 'Literal' }),
      sceneBrief({ conceptLens: 'mechanism', metaphorTitle: 'Mechanism' }),
      sceneBrief({ conceptLens: 'consequence', metaphorTitle: 'Consequence' }),
    ]);
    const result = await produceStoryPrompts({
      headline: sceneInput.headline,
      sceneBriefs,
      exportPrompts: exportManualImagePrompts,
      sceneInput,
      cfg,
      policy: 'weekly-semantic-story-v5.1',
      generatedAt: '2026-08-15T12:00:00.000Z',
    });
    expect(generateWeeklyReportageIllustrations).not.toHaveBeenCalled();
    expect(sceneBriefs).toHaveBeenCalledWith(sceneInput, cfg, { count: 3 });
    expect(result.content.prompts).toHaveLength(3);
    expect(result.content.policy).toBe('weekly-semantic-story-v5.1');
    expect(result.content.prompts[0]?.canonical).toMatch(/brass adapter card/i);
    expect(result.content.prompts[0]?.midjourney).toContain('--ar 16:9');
    expect(result.output).toEqual({ needs_owner_review: true, prompt_count: 3 });
    expect(storyImageJobPath(null, 'prompt_only')).toBe('prompt_only');
  });

  it('story_image job with source_url still ingests the URL', () => {
    expect(storyImageJobPath('https://cdn.example/story.jpg', 'prompt_only')).toBe('ingest_url');
    expect(storyImageJobPath('https://cdn.example/story.jpg', 'render')).toBe('ingest_url');
    expect(resolveWeeklyStoryImageMode(undefined)).toBe('prompt_only');
    expect(resolveWeeklyStoryImageMode('render')).toBe('render');
  });
});
