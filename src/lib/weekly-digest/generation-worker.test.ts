import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: [] as unknown[],
  error: null as { message: string } | null,
}));
// Default no-op chain so tests that don't touch `.from(...)` (most of this
// file) are unaffected; priorMasterRetryGuidance tests below override this
// per-test with mockReturnValueOnce.
function defaultFromChain(_table?: string) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.order = self;
  chain.limit = () => Promise.resolve({ data: [], error: null });
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return chain;
}
const from = vi.fn(defaultFromChain);
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc, from }) }));

import {
  computeSocialCopyCheckpointHash,
  masterBundleFromArtifacts,
  masterInputStories,
  masterRunStateFromOutput,
  masterResumeGuidanceBoundary,
  priorMasterRetryGuidance,
  resolveMasterResumeState,
  resolveSocialPostForRepair,
  runWeeklyDigestGenerationJobs,
  siblingHintsFromStorySiblingArtifact,
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

describe('resolveMasterResumeState', () => {
  const planHash = computeMasterPlanHash([pack()], []);
  const resumableOutput = {
    master_run_state: {
      version: 'weekly-master-run-v2',
      planHash,
      segments: { 'en:story:item-1': { value: { body: 'x' }, metadata: {} } },
      repairs: [],
      repairAttempts: { 'stale-target': 2 },
      criticRounds: 3,
      quality: null,
      unresolved: [{ code: 'stale', reason: 'stale' }],
      calls: { english: [], ukrainian: [], critic: [] },
    },
  } as unknown as Json;

  it('resets critic budget so a resumed run gets a fresh repair pass', () => {
    const resolved = resolveMasterResumeState({ id: 'source-1', output: resumableOutput }, planHash);
    expect(resolved.sourceJobId).toBe('source-1');
    expect(resolved.state.criticRounds).toBe(0);
    expect(resolved.state.repairAttempts).toEqual({});
    expect(resolved.state.unresolved).toEqual([]);
    expect(resolved.state.segments).toHaveProperty('en:story:item-1');
  });

  // The exact failure this codebase hit live 2026-08-22: a "Create linked
  // retry" of this failure must not blindly retry the same resume (fixed
  // separately in retry_weekly_digest_generation_job) -- but the message
  // itself, and its non-null-state trigger, must keep pointing owners at
  // "Regenerate master" via classifyGenerationFailure's resume_source_stale.
  it('throws a named error when the source has no state for the current plan', () => {
    expect(() =>
      resolveMasterResumeState({ id: 'source-1', output: { retryable: true } as unknown as Json }, planHash),
    ).toThrow(/Master resume source has no saved state/);
  });
});

describe('priorMasterRetryGuidance', () => {
  beforeEach(() => from.mockClear());

  function stubReportQuery(rows: Array<{ content: unknown; created_at: string }>) {
    const calls: { lt?: unknown[] } = {};
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = self;
    chain.lt = (...args: unknown[]) => {
      calls.lt = args;
      return chain;
    };
    chain.order = self;
    chain.limit = () => Promise.resolve({ data: rows, error: null });
    from.mockReturnValueOnce(chain);
    return calls;
  }

  // The bug this guards: resuming a `needs_owner_review` master job picked up
  // that job's *own* just-written quality report as "latest guidance," which
  // changed the plan hash relative to what the job started with and made its
  // checkpoint permanently unresumable the instant it finished (live
  // 2026-08-22, weekly_digest_id 71af784b-3c89-47f8-bc38-e3eae4def2a7, job
  // 411aba45). Bounding the query to reports written before the resume
  // source started recovers the guidance that job actually saw.
  it('excludes reports at/after the resume source job when a bound is given', async () => {
    const calls = stubReportQuery([]);
    await priorMasterRetryGuidance('revision-1', '2026-08-22T09:26:00.000Z');
    expect(calls.lt).toEqual(['created_at', '2026-08-22T09:26:00.000Z']);
  });

  it('does not bound the query for a fresh, non-resume run', async () => {
    const calls = stubReportQuery([]);
    await priorMasterRetryGuidance('revision-1');
    expect(calls.lt).toBeUndefined();
  });

  it('turns a below-floor dimension score into retry guidance', async () => {
    stubReportQuery([
      {
        created_at: '2026-08-22T09:21:40.000Z',
        content: { dimensions: [{ name: 'naturalness', score: 55 }], issues: [] },
      },
    ]);
    const guidance = await priorMasterRetryGuidance('revision-1');
    expect(guidance.some((entry) => entry.code.includes('naturalness'))).toBe(true);
  });
});

describe('masterResumeGuidanceBoundary', () => {
  beforeEach(() => from.mockClear());
  afterEach(() => from.mockImplementation(defaultFromChain));

  function stubJobLookup(rows: Record<string, { input: unknown; created_at: string } | null>) {
    from.mockImplementation((table?: string) => {
      if (table !== 'weekly_digest_generation_jobs') {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        chain.select = self;
        chain.eq = self;
        chain.order = self;
        chain.limit = () => Promise.resolve({ data: [], error: null });
        return chain;
      }
      const chain: Record<string, unknown> = {};
      let byId: string | undefined;
      chain.select = () => chain;
      chain.eq = (_col: string, value: string) => {
        byId = value;
        return chain;
      };
      chain.maybeSingle = () => Promise.resolve({ data: byId ? (rows[byId] ?? null) : null, error: null });
      return chain;
    });
  }

  // The exact case reproduced live 2026-08-22 on weekly_digest_id
  // 71af784b-3c89-47f8-bc38-e3eae4def2a7: resuming job 411aba45 (a fresh
  // run, no resume_from_job_id) succeeded once bounded guidance shipped, but
  // resuming its child 7bf3974d (created via that first resume) immediately
  // failed again with resume_source_stale, because bounding by 7bf3974d's
  // own created_at pulled in a report 411aba45 never saw. This test is the
  // regression guard for that second bug.
  it('walks a chained resume back to the original (non-resume) writer', async () => {
    stubJobLookup({
      'source-7bf3974d': {
        input: { resume_from_job_id: 'root-411aba45' },
        created_at: '2026-08-22T10:11:15.000Z',
      },
      'root-411aba45': { input: {}, created_at: '2026-08-22T08:28:19.000Z' },
    });
    const boundary = await masterResumeGuidanceBoundary({
      createdAt: '2026-08-22T10:11:15.000Z',
      input: { resume_from_job_id: 'root-411aba45' } as unknown as Json,
    });
    expect(boundary).toBe('2026-08-22T08:28:19.000Z');
  });

  it('uses the source own created_at when it is not itself a resume', async () => {
    const boundary = await masterResumeGuidanceBoundary({
      createdAt: '2026-08-22T08:28:19.000Z',
      input: {} as unknown as Json,
    });
    expect(boundary).toBe('2026-08-22T08:28:19.000Z');
    expect(from).not.toHaveBeenCalled();
  });

  it('walks more than one hop', async () => {
    stubJobLookup({
      'mid-2': { input: { resume_from_job_id: 'root-1' }, created_at: '2026-08-22T09:00:00.000Z' },
      'root-1': { input: {}, created_at: '2026-08-22T07:00:00.000Z' },
    });
    const boundary = await masterResumeGuidanceBoundary({
      createdAt: '2026-08-22T10:00:00.000Z',
      input: { resume_from_job_id: 'mid-2' } as unknown as Json,
    });
    expect(boundary).toBe('2026-08-22T07:00:00.000Z');
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

describe('resolveSocialPostForRepair', () => {
  it('returns a legacy package/channel post when no checkpoint post id exists', async () => {
    const findCheckpointPost = vi.fn();
    const existing = { id: 'legacy-post', blockerCount: 10 };
    const findExistingPost = vi.fn(async () => existing);

    await expect(
      resolveSocialPostForRepair({ findCheckpointPost, findExistingPost }),
    ).resolves.toBe(existing);
    expect(findCheckpointPost).not.toHaveBeenCalled();
    expect(findExistingPost).toHaveBeenCalledOnce();
  });

  it('prefers the checkpoint-addressed post without doing a fallback lookup', async () => {
    const checkpoint = { id: 'checkpoint-post' };
    const findCheckpointPost = vi.fn(async () => checkpoint);
    const findExistingPost = vi.fn(async () => ({ id: 'legacy-post' }));

    await expect(
      resolveSocialPostForRepair({
        checkpointPostId: checkpoint.id,
        findCheckpointPost,
        findExistingPost,
      }),
    ).resolves.toBe(checkpoint);
    expect(findExistingPost).not.toHaveBeenCalled();
  });
});

describe('masterBundleFromArtifacts', () => {
  it('rehydrates normalized article artifacts from the active revision', () => {
    const context = {
      revision: {
        title_en: 'Revision title',
        title_uk: 'Назва ревізії',
        intro_en: 'Revision intro',
        intro_uk: 'Вступ ревізії',
        editor_note_en: 'Revision editor note',
        editor_note_uk: 'Нотатка редактора',
        key_takeaways_en: ['Revision takeaway'],
        key_takeaways_uk: ['Висновок ревізії'],
      },
      items: Array.from({ length: 7 }, (_, index) =>
        revisionItem({
          id: `item-${index + 1}`,
          rank: index + 1,
          body_en: `English body ${index + 1}`,
          body_uk: `Український текст ${index + 1}`,
          why_en: `English why ${index + 1}`,
          why_uk: `Українське пояснення ${index + 1}`,
          practical_en: `English practical ${index + 1}`,
          practical_uk: `Український крок ${index + 1}`,
          takeaway_en: `English takeaway ${index + 1}`,
          takeaway_uk: `Український висновок ${index + 1}`,
        }),
      ),
      artifacts: ['en', 'uk'].map((locale) => ({
        artifact_type: 'article',
        locale,
        is_current: true,
        content: {
          title: `${locale} title`,
          seoTitle: `${locale} SEO title`,
          metaDescription: `${locale} meta description`,
          ogTitle: `${locale} OG title`,
          ogDescription: `${locale} OG description`,
          standfirst: `${locale} standfirst`,
          theme: `${locale} theme`,
          intro: `${locale} intro`,
          editor_note: `${locale} editor note`,
          key_takeaways: [`${locale} takeaway`],
          topics: ['AI'],
          entities: ['Example'],
          internalLinks: [{ anchor: 'AI', query: 'ai' }],
        },
      })),
    } as unknown as Parameters<typeof masterBundleFromArtifacts>[0];

    const bundle = masterBundleFromArtifacts(context);

    expect(bundle.en.editorNote).toBe('en editor note');
    expect(bundle.en.keyTakeaways).toEqual(['en takeaway']);
    expect(bundle.en.conclusion).toBe('en editor note');
    expect(bundle.en.stories).toHaveLength(7);
    expect(bundle.en.stories[0]).toMatchObject({
      revisionItemId: 'item-1',
      placement: 'feature',
      hook: 'Summary sentence.',
      claimIds: ['W1-C1', 'W1-C2'],
    });
    expect(bundle.en.stories[3]).toMatchObject({ revisionItemId: 'item-4', placement: 'radar' });
  });

  it('restores claim IDs and editorial fields from the revision content_studio snapshot', () => {
    const context = {
      revision: {
        title_en: 'Revision title',
        title_uk: 'Назва ревізії',
        intro_en: 'Revision intro',
        intro_uk: 'Вступ ревізії',
        editor_note_en: 'Revision editor note',
        editor_note_uk: 'Нотатка редактора',
        key_takeaways_en: ['Revision takeaway'],
        key_takeaways_uk: ['Висновок ревізії'],
      },
      items: Array.from({ length: 7 }, (_, index) =>
        revisionItem({
          id: `item-${index + 1}`,
          rank: index + 1,
          body_en: `English body ${index + 1}`,
          body_uk: `Український текст ${index + 1}`,
          why_en: `English why ${index + 1}`,
          why_uk: `Українське пояснення ${index + 1}`,
          practical_en: `English practical ${index + 1}`,
          practical_uk: `Український крок ${index + 1}`,
          takeaway_en: `English takeaway ${index + 1}`,
          takeaway_uk: `Український висновок ${index + 1}`,
          source_snapshot: {
            content_studio: {
              hook_en: `Studio hook ${index + 1}`,
              hook_uk: `Студійний хук ${index + 1}`,
              limitation_en: `Studio limitation ${index + 1}`,
              limitation_uk: `Студійне обмеження ${index + 1}`,
              editors_view_en: `Studio editors view ${index + 1}`,
              editors_view_uk: `Студійний погляд ${index + 1}`,
              discussion_en: `Studio discussion ${index + 1}?`,
              discussion_uk: `Студійне питання ${index + 1}?`,
              claim_ids: [`W${index + 1}-C1`, `W${index + 1}-C2`],
            },
          },
        }),
      ),
      artifacts: ['en', 'uk'].map((locale) => ({
        artifact_type: 'article',
        locale,
        is_current: true,
        content: {
          title: `${locale} title`,
          seoTitle: `${locale} SEO title`,
          metaDescription: `${locale} meta description`,
          ogTitle: `${locale} OG title`,
          ogDescription: `${locale} OG description`,
          standfirst: `${locale} standfirst`,
          theme: `${locale} theme`,
          intro: `${locale} intro`,
          editor_note: `${locale} editor note`,
          key_takeaways: [`${locale} takeaway`],
          topics: ['AI'],
          entities: ['Example'],
          internalLinks: [{ anchor: 'AI', query: 'ai' }],
        },
      })),
    } as unknown as Parameters<typeof masterBundleFromArtifacts>[0];

    const bundle = masterBundleFromArtifacts(context);

    expect(bundle.en.stories[0]).toMatchObject({
      revisionItemId: 'item-1',
      placement: 'feature',
      hook: 'Studio hook 1',
      limitation: 'Studio limitation 1',
      editorsView: 'Studio editors view 1',
      discussionQuestion: 'Studio discussion 1?',
      claimIds: ['W1-C1', 'W1-C2'],
    });
    expect(bundle.uk.stories[2]).toMatchObject({
      revisionItemId: 'item-3',
      hook: 'Студійний хук 3',
      editorsView: 'Студійний погляд 3',
      claimIds: ['W3-C1', 'W3-C2'],
    });
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

describe('siblingHintsFromStorySiblingArtifact (R1.1 -- cross-story diversification)', () => {
  it('builds a sibling hint from another story’s story_prompt_set (the prompt_only default)', () => {
    const hints = siblingHintsFromStorySiblingArtifact({
      artifact_type: 'story_prompt_set',
      content: {
        prompts: [
          {
            conceptLens: 'mechanism',
            grammar: 'cinematic_domain_scene',
            title: 'Single Slot Tool Cabinet',
            canonical: 'A single slot tool cabinet holding one command flag.',
            midjourney: 'a single slot tool cabinet --ar 16:9 --style raw --no text',
            negative: 'no text',
            aspectRatio: '16:9',
            notes: [],
            motifClass: 'single_slot_cabinet',
            subjectKind: 'object',
            composition: 'single',
            scene: 'A single slot tool cabinet in a workshop, one open bay',
            subject: 'a single slot tool cabinet',
            setting: 'workshop bench',
          },
        ],
      } as unknown as Json,
      metadata: null,
    });
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      motifClass: 'single_slot_cabinet',
      subjectKind: 'object',
      composition: 'single',
      sceneSummary: 'A single slot tool cabinet in a workshop, one open bay',
      // R2.3 / F9: subject/setting must survive the round trip, or
      // motifFamilyKey falls back to sceneSummary/'' for every cross-story
      // sibling and family matching never fires across stories.
      subject: 'a single slot tool cabinet',
      setting: 'workshop bench',
    });
  });

  it('an artifact with an empty story_prompt_set (mapping-gate wipeout) contributes no hints', () => {
    const hints = siblingHintsFromStorySiblingArtifact({
      artifact_type: 'story_prompt_set',
      content: { prompts: [], mapping_gate_issues: ['missing_visible_outcome'] } as unknown as Json,
      metadata: null,
    });
    expect(hints).toEqual([]);
  });

  it('falls back to story_image metadata for a render-mode sibling', () => {
    const hints = siblingHintsFromStorySiblingArtifact({
      artifact_type: 'story_image',
      content: null,
      metadata: {
        scene: 'A clay golem guarding a sealed journal in a vault',
        motif_class: 'anthropomorphic_guardian',
        subject_kind: 'character',
        composition: 'dual_contrast',
      } as unknown as Json,
    });
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      motifClass: 'anthropomorphic_guardian',
      subjectKind: 'character',
      composition: 'dual_contrast',
    });
  });

  it('a manual-upload story_image (no scene metadata) contributes no hint', () => {
    const hints = siblingHintsFromStorySiblingArtifact({
      artifact_type: 'story_image',
      content: null,
      metadata: {
        source: 'manual_upload',
        original_name: 'story.jpg',
        sha256: 'deadbeef',
      } as unknown as Json,
    });
    expect(hints).toEqual([]);
  });
});
