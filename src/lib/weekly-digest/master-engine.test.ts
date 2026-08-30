import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OPENROUTER_CATALOG = [
  {
    id: 'vendor/critic-model',
    context_length: 128_000,
    architecture: { modality: 'text' },
    pricing: { prompt: '0.0000003', completion: '0.000001' },
    benchmarks: { artificial_analysis: { intelligence_index: 60 } },
  },
  {
    // A distinct vendor so the independent critic's OpenRouter fallback
    // (which excludes the writer's vendor) still has a model to pick.
    id: 'other-vendor/writer-model',
    context_length: 128_000,
    architecture: { modality: 'text' },
    pricing: { prompt: '0.0000003', completion: '0.000001' },
    benchmarks: { artificial_analysis: { intelligence_index: 60 } },
  },
];

vi.mock('../../../pipeline/openrouter-models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../pipeline/openrouter-models')>();
  return { ...actual, fetchOpenRouterModels: vi.fn() };
});
vi.mock('../../../pipeline/openrouter-summarize', () => ({
  generateWithOpenRouterChain: vi.fn(),
}));
vi.mock('../../../pipeline/claude-cli', () => ({ generateWithClaudeCli: vi.fn() }));
vi.mock('../../../pipeline/providers/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../pipeline/providers/registry')>();
  return { ...actual, loadProviderRegistry: vi.fn() };
});

import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
import { fetchOpenRouterModels } from '../../../pipeline/openrouter-models';
import { loadProviderRegistry } from '../../../pipeline/providers/registry';
import {
  computeMasterPlanHash,
  reusableMasterRunState,
  runWeeklyMaster,
  seedMasterRunStateFromBundle,
  type MasterRunState,
} from './master-engine';
import { masterSegmentKey } from './master-segments';
import type { WeeklyMasterInputStory } from './editorial-llm';
import type { WeeklyResearchPack } from './content-studio';

/**
 * Six stories (three features + three radar) so the deterministic
 * `top3_radar_structure` gate is satisfied and the assertions below are about
 * the engine's behavior rather than a fixture that could never pass anyway.
 */
const STORIES: WeeklyMasterInputStory[] = Array.from({ length: 6 }, (_, index) => ({
  revisionItemId: `item-${index + 1}`,
  rank: index + 1,
  placement: index < 3 ? 'feature' : 'radar',
  titleEn: `Title ${index + 1}`,
  titleUk: `Заголовок ${index + 1}`,
  summaryEn: 'Summary',
  summaryUk: 'Підсумок',
  whyEn: null,
  whyUk: null,
  sources: [{ name: 'Example', url: 'https://example.com' }],
  claims: [
    { id: `claim-${index + 1}`, text: 'A supported claim.', evidenceUrls: ['https://example.com'] },
  ],
}));

const RESEARCH: WeeklyResearchPack[] = [];

const WRITE_USAGE = { promptTokens: 900, completionTokens: 800, totalTokens: 1700, costUsd: 0.004 };
const CRITIC_USAGE = { promptTokens: 500, completionTokens: 300, totalTokens: 800, costUsd: 0.02 };

/** Body long enough to clear the deterministic feature/radar word floors. */
function body(words: number, marker = 'sentence') {
  return `${marker} `.repeat(words).trim();
}

/** Radar bodies must stay short or the edition blows the article_length gate. */
function isRadarPrompt(prompt: string) {
  return prompt.includes('radar)') || prompt.includes('80-120');
}

function storyJson(
  overrides: Record<string, unknown> = {},
  claimId = 'claim-1',
  bodyWords = 430,
) {
  return JSON.stringify({
    story: {
      headline: 'Anthropic ships a measurable change',
      summary: 'Summary of what happened.',
      hook: 'One concrete hook sentence.',
      body: body(bodyWords),
      why: 'Why this matters in one paragraph.',
      practical: 'A platform team could route one staging workload through it and measure latency.',
      limitation: 'The evidence covers one vendor and one workload.',
      takeaway: 'Decide whether to pilot it this quarter.',
      editorsView: `Our read: ${body(70, 'speculation')}`,
      discussionQuestion: 'What would you watch for next?',
      claimIds: [claimId],
      ...overrides,
    },
  });
}

function frameJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    frame: {
      title: 'Anthropic, NVIDIA and GitHub each shipped something measurable',
      seoTitle: 'Anthropic, NVIDIA and GitHub ship',
      metaDescription: 'What three vendors actually shipped this week and what it changes.',
      ogTitle: 'Anthropic, NVIDIA and GitHub ship',
      ogDescription: 'What three vendors actually shipped this week.',
      standfirst: 'Three vendors shipped measurable changes this week.',
      theme: 'Measured shipping',
      intro: body(150, 'intro'),
      editorNote: 'Stories rest on cited primary sources; editorial analysis is labeled.',
      keyTakeaways: ['One takeaway'],
      topics: ['agents'],
      entities: ['Anthropic'],
      internalLinks: [{ anchor: 'agents', query: 'agents' }],
      conclusion: body(120, 'conclusion'),
      ...overrides,
    },
  });
}

function criticJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    score: 90,
    dimensions: ['engagement', 'voice', 'clarity', 'trust', 'usefulness', 'naturalness', 'parity']
      .map((name, index) => ({ name, score: 88 + (index % 3), note: 'ok' })),
    factualFlags: [],
    issues: [],
    ...overrides,
  });
}

interface RouterHandlers {
  critic?: (callIndex: number) => string;
  repair?: (prompt: string, callIndex: number) => string;
  story?: (prompt: string, callIndex: number) => string;
}

interface RouterLog {
  prompts: string[];
  kinds: string[];
  criticQueues: string[][];
}

function promptKind(prompt: string): string {
  if (prompt.includes('independent factual and editorial critic')) return 'critic';
  if (prompt.includes('line-editing ONE field')) return 'repair';
  if (prompt.includes('Адаптуйте рамку випуску')) return 'uk-frame';
  if (prompt.includes('Адаптуйте ОДНУ історію')) return 'uk-story';
  if (prompt.includes('Write the edition frame')) return 'en-frame';
  return 'en-story';
}

function mockRouter(handlers: RouterHandlers = {}): RouterLog {
  const log: RouterLog = { prompts: [], kinds: [], criticQueues: [] };
  const counts: Record<string, number> = {};
  vi.mocked(generateWithOpenRouterChain).mockImplementation(
    async (prompt: string, options?: { modelQueue?: string[] }) => {
      const kind = promptKind(prompt);
      counts[kind] = (counts[kind] ?? 0) + 1;
      log.prompts.push(prompt);
      log.kinds.push(kind);
      const text =
        kind === 'critic'
          ? (handlers.critic?.(counts[kind]!) ?? criticJson())
          : kind === 'repair'
            ? (handlers.repair?.(prompt, counts[kind]!) ?? JSON.stringify({ value: 'Repaired value.' }))
            : kind.endsWith('frame')
              ? frameJson()
              : (handlers.story?.(prompt, counts[kind]!) ??
                storyJson({}, claimIdFor(prompt), isRadarPrompt(prompt) ? 100 : 430));
      if (kind === 'critic') log.criticQueues.push(options?.modelQueue ?? []);
      return {
        text,
        provider: 'openrouter',
        model:
          kind === 'critic'
            ? (options?.modelQueue?.[0] ?? 'vendor/critic-model')
            : 'other-vendor/writer-model',
        usage: kind === 'critic' ? CRITIC_USAGE : WRITE_USAGE,
      };
    },
  );
  return log;
}

/** The English story prompt carries exactly one story's approved claim ids. */
function claimIdFor(prompt: string): string {
  const match = /"id":"(claim-\d+)"/.exec(prompt);
  return match?.[1] ?? 'claim-1';
}

beforeEach(() => {
  vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
  vi.stubEnv('WEEKLY_MASTER_PROVIDER_ORDER', 'openrouter');
  vi.mocked(fetchOpenRouterModels).mockResolvedValue(OPENROUTER_CATALOG);
});

afterEach(() => {
  vi.mocked(generateWithOpenRouterChain).mockReset();
  vi.mocked(loadProviderRegistry).mockReset();
  vi.unstubAllEnvs();
});

describe('segmented writing', () => {
  it('writes one call per story plus one per locale frame, and checkpoints after each', async () => {
    const log = mockRouter();
    const states: MasterRunState[] = [];

    const outcome = await runWeeklyMaster({
      stories: STORIES,
      researchPacks: RESEARCH,
      hooks: { onState: (state) => void states.push(structuredClone(state)) },
    });

    expect(outcome.status).toBe('complete');
    // 6 EN stories + EN frame + 6 UK stories + UK frame = 14 writes.
    expect(log.kinds.filter((kind) => kind !== 'critic' && kind !== 'repair')).toHaveLength(14);
    // Every segment produced its own durable checkpoint on the way through.
    const segmentCounts = states.map((state) => Object.keys(state.segments).length);
    expect(segmentCounts).toContain(1);
    expect(segmentCounts[segmentCounts.length - 1]).toBe(14);
  });

  it('writes the English frame only after every English story exists', async () => {
    const log = mockRouter();
    await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });
    expect(log.kinds.indexOf('en-frame')).toBeGreaterThan(log.kinds.lastIndexOf('en-story'));
  });

  // Story identity, placement and Ukrainian claim ids are all structural now,
  // so the blockers that used to punish a confused writer for echoing them
  // wrong (story_set_mismatch, placement_mismatch, bilingual_claim_parity)
  // cannot be produced at all.
  it('copies Ukrainian claim ids from English rather than asking for them again', async () => {
    mockRouter({
      story: (prompt) =>
        promptKind(prompt) === 'uk-story'
          ? storyJson({ claimIds: ['invented-claim'] }, 'claim-1', isRadarPrompt(prompt) ? 100 : 430)
          : storyJson({}, claimIdFor(prompt), isRadarPrompt(prompt) ? 100 : 430),
    });
    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });
    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    for (const [index, story] of outcome.bundle.uk.stories.entries()) {
      expect(story.claimIds).toEqual(outcome.bundle.en.stories[index]!.claimIds);
      expect(story.revisionItemId).toBe(`item-${index + 1}`);
    }
  });

  it('resumes from saved segments instead of re-paying for them', async () => {
    mockRouter();
    const first = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });
    if (first.status !== 'complete') throw new Error('expected a complete run');

    vi.mocked(generateWithOpenRouterChain).mockClear();
    const log = mockRouter();
    await runWeeklyMaster({
      stories: STORIES,
      researchPacks: RESEARCH,
      state: { ...first.state, criticRounds: 0 },
    });
    expect(log.kinds.filter((kind) => kind !== 'critic' && kind !== 'repair')).toHaveLength(0);
  });

  it('does not rewrite an existing working copy when seeded from the current article', async () => {
    mockRouter();
    const first = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });
    if (first.status !== 'complete') throw new Error('expected a complete run');

    const guidance = [
      { code: 'trust_attribution', message: 'Name the source inline.', blocker: false },
    ];
    const planHash = computeMasterPlanHash(RESEARCH, guidance);
    const seeded = seedMasterRunStateFromBundle({
      bundle: first.bundle,
      stories: STORIES.map((story) => ({
        revisionItemId: story.revisionItemId,
        placement: story.placement,
        rank: story.rank,
      })),
      planHash,
      metadata: first.generation.english,
    });
    expect(Object.keys(seeded.segments)).toHaveLength(14);

    vi.mocked(generateWithOpenRouterChain).mockClear();
    const log = mockRouter();
    await runWeeklyMaster({
      stories: STORIES,
      researchPacks: RESEARCH,
      retryGuidance: guidance,
      state: seeded,
    });
    expect(log.kinds.filter((kind) => kind !== 'critic' && kind !== 'repair')).toHaveLength(0);
    expect(log.kinds.filter((kind) => kind === 'critic').length).toBeGreaterThan(0);
  });

  it('returns a resumable incomplete outcome when a segment cannot be written at all', async () => {
    let calls = 0;
    vi.mocked(generateWithOpenRouterChain).mockImplementation(async (prompt: string) => {
      calls += 1;
      if (calls > 2) throw new Error('provider exploded');
      return {
        text: storyJson({}, claimIdFor(prompt), isRadarPrompt(prompt) ? 100 : 430),
        provider: 'openrouter',
        model: 'other-vendor/writer-model',
        usage: WRITE_USAGE,
      };
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    expect(outcome.status).toBe('incomplete');
    if (outcome.status !== 'incomplete') throw new Error('unreachable');
    // The finished work survives: a retry resumes from segment three.
    expect(outcome.completedSegments).toBe(2);
    expect(outcome.totalSegments).toBe(14);
    expect(outcome.state.segments).toHaveProperty(masterSegmentKey({ kind: 'story', locale: 'en', revisionItemId: 'item-1', placement: 'feature', rank: 1 }));
  });

  it('returns a resumable incomplete outcome when the critic cannot score saved copy', async () => {
    const notes: string[] = [];
    const log = mockRouter({
      critic: () => {
        throw new Error('critic provider is unavailable');
      },
    });

    const outcome = await runWeeklyMaster({
      stories: STORIES,
      researchPacks: RESEARCH,
      hooks: { onNote: (entry) => void notes.push(entry.message) },
    });

    expect(outcome.status).toBe('incomplete');
    if (outcome.status !== 'incomplete') throw new Error('unreachable');
    expect(outcome.completedSegments).toBe(14);
    expect(outcome.totalSegments).toBe(14);
    expect(outcome.state.quality).toBeNull();
    expect(outcome.state.criticRounds).toBe(0);
    expect(outcome.state.calls.critic).toEqual([]);
    expect(log.kinds.filter((kind) => kind === 'critic')).toHaveLength(1);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('Critic round 1 could not score the edition:');
    expect(notes[0]).toContain('critic provider is unavailable');
  });
});

describe('targeted repair', () => {
  it('repairs a deterministic blocker before spending anything on the critic', async () => {
    const log = mockRouter({
      story: (prompt) =>
        // A banned category-label opener: caught by code, not judgment.
        storyJson(
          { body: `Why it matters: ${body(isRadarPrompt(prompt) ? 100 : 430)}` },
          claimIdFor(prompt),
          isRadarPrompt(prompt) ? 100 : 430,
        ),
      repair: (prompt) => JSON.stringify({ value: body(isRadarPrompt(prompt) ? 100 : 430, 'repaired') }),
    });

    await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    const firstRepair = log.kinds.indexOf('repair');
    const firstCritic = log.kinds.indexOf('critic');
    expect(firstRepair).toBeGreaterThan(-1);
    expect(firstRepair).toBeLessThan(firstCritic);
  });

  it('sends only the failing field, not the article, to the repair call', async () => {
    const log = mockRouter({
      critic: (callIndex) =>
        callIndex === 1
          ? criticJson({
              score: 70,
              issues: [
                {
                  code: 'usefulness_generic',
                  message: 'The practical example could attach to any story.',
                  blocker: true,
                  locale: 'en',
                  revisionItemId: 'item-2',
                  field: 'practical',
                  suggestedFix: 'Name a concrete actor and observable result.',
                },
              ],
            })
          : criticJson(),
      repair: () => JSON.stringify({ value: 'A payments team routed one staging queue through it.' }),
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    expect(outcome.converged).toBe(true);
    expect(outcome.bundle.en.stories[1]!.practical).toBe(
      'A payments team routed one staging queue through it.',
    );
    // Untouched stories keep their original copy byte for byte.
    expect(outcome.bundle.en.stories[0]!.practical).toContain('platform team');
    const repairPrompt = log.prompts[log.kinds.indexOf('repair')]!;
    expect(repairPrompt).toContain('FIELD: practical');
    expect(repairPrompt.length).toBeLessThan(20_000);
  });

  it('re-adapts the Ukrainian counterpart after an English prose repair, without rewriting the locale', async () => {
    const log = mockRouter({
      critic: (callIndex) =>
        callIndex === 1
          ? criticJson({
              score: 70,
              issues: [
                {
                  code: 'engagement_structure',
                  message: 'The opening is an abstract thesis.',
                  blocker: true,
                  locale: 'en',
                  revisionItemId: 'item-1',
                  field: 'hook',
                },
              ],
            })
          : criticJson(),
    });

    await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    const repairPrompts = log.prompts.filter((_, index) => log.kinds[index] === 'repair');
    expect(repairPrompts).toHaveLength(2);
    expect(repairPrompts[1]).toContain('ENGLISH COUNTERPART');
    // A whole-locale re-adaptation is exactly what this replaces.
    expect(log.kinds.filter((kind) => kind === 'uk-story')).toHaveLength(6);
  });

  it('splices a Ukrainian homoglyph before the critic instead of LLM-rewriting the field', async () => {
    const latinE = '\u0065';
    const log = mockRouter({
      story: (prompt) => {
        if (promptKind(prompt) === 'uk-story' && claimIdFor(prompt) === 'claim-1') {
          return storyJson(
            { hook: `Розрив між найм${latinE}ншим флагманом і найбільшими моделями зростає.` },
            'claim-1',
            430,
          );
        }
        return storyJson({}, claimIdFor(prompt), isRadarPrompt(prompt) ? 100 : 430);
      },
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    expect(log.kinds.filter((kind) => kind === 'repair')).toEqual([]);
    expect(outcome.bundle.uk.stories[0]!.hook).toContain('найменшим');
    expect(outcome.bundle.uk.stories[0]!.hook).not.toContain(`найм${latinE}ншим`);
  });

  it('does not re-adapt the Ukrainian body after an English template-leak strip', async () => {
    const log = mockRouter({
      story: (prompt) => {
        if (promptKind(prompt) === 'en-story' && claimIdFor(prompt) === 'claim-1') {
          return storyJson(
            { body: `${body(430)} The takeaway here is that isolation must be enforced.` },
            'claim-1',
            430,
          );
        }
        return storyJson({}, claimIdFor(prompt), isRadarPrompt(prompt) ? 100 : 430);
      },
      repair: () =>
        JSON.stringify({
          value: `${body(430)} Isolation must be enforced at the boundary.`,
        }),
    });

    await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    const repairPrompts = log.prompts.filter((_, index) => log.kinds[index] === 'repair');
    expect(repairPrompts.length).toBeGreaterThanOrEqual(1);
    expect(repairPrompts.some((prompt) => prompt.includes('ENGLISH COUNTERPART'))).toBe(false);
  });

  it('repairs a factual flag instead of refusing to touch the edition', async () => {
    const log = mockRouter({
      critic: (callIndex) =>
        callIndex === 1
          ? criticJson({
              score: 70,
              factualFlags: [
                'Unsupported: "A platform team could route one staging workload through it and measure latency."',
              ],
            })
          : criticJson(),
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    expect(log.kinds).toContain('repair');
    expect(outcome.converged).toBe(true);
  });

  it('stops re-sending a field the model will not fix, and reports it as unresolved', async () => {
    vi.stubEnv('WEEKLY_MASTER_MAX_REPAIR_ATTEMPTS', '1');
    mockRouter({
      critic: () =>
        criticJson({
          score: 70,
          issues: [
            {
              code: 'voice_register',
              message: 'Reads like a compliance memo.',
              blocker: true,
              locale: 'en',
              revisionItemId: 'item-1',
              field: 'body',
            },
          ],
        }),
      repair: () => JSON.stringify({ value: body(430, 'stillbad') }),
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    expect(outcome.converged).toBe(false);
    expect(outcome.unresolved.length).toBeGreaterThan(0);
  });

  it('keeps repairing the other fields when one repair call fails outright', async () => {
    let repairCalls = 0;
    mockRouter({
      critic: (callIndex) =>
        callIndex === 1
          ? criticJson({
              score: 70,
              issues: [
                {
                  code: 'usefulness_generic',
                  message: 'Generic practical example.',
                  blocker: true,
                  locale: 'en',
                  revisionItemId: 'item-1',
                  field: 'practical',
                },
                {
                  code: 'clarity_unclear',
                  message: 'The limitation is unreadable.',
                  blocker: true,
                  locale: 'en',
                  revisionItemId: 'item-2',
                  field: 'limitation',
                },
              ],
            })
          : criticJson(),
      repair: () => {
        repairCalls += 1;
        if (repairCalls === 1) throw new Error('repair provider exploded');
        return JSON.stringify({ value: 'A concrete replacement sentence.' });
      },
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    expect(repairCalls).toBeGreaterThan(1);
    expect(outcome.bundle.en.stories[1]!.limitation).toBe('A concrete replacement sentence.');
  });

  it('rejects an empty repair response rather than blanking the field', async () => {
    mockRouter({
      critic: (callIndex) =>
        callIndex === 1
          ? criticJson({
              score: 70,
              issues: [
                {
                  code: 'usefulness_generic',
                  message: 'Generic practical example.',
                  blocker: true,
                  locale: 'en',
                  revisionItemId: 'item-1',
                  field: 'practical',
                },
              ],
            })
          : criticJson(),
      repair: () => JSON.stringify({ value: '   ' }),
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    expect(outcome.bundle.en.stories[0]!.practical).toContain('platform team');
  });
});

describe('never failing on quality', () => {
  // The entire point of the refactor: an imperfect edition is a review task,
  // not a thrown error that discards half an hour of paid generation.
  it('returns a complete, unconverged result instead of throwing when the gate cannot be satisfied', async () => {
    vi.stubEnv('WEEKLY_MASTER_MAX_CRITIC_ROUNDS', '1');
    mockRouter({ critic: () => criticJson({ score: 40 }) });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    expect(outcome.status).toBe('complete');
    if (outcome.status !== 'complete') throw new Error('unreachable');
    expect(outcome.converged).toBe(false);
    expect(outcome.quality.score).toBe(40);
    expect(outcome.bundle.en.stories).toHaveLength(6);
    expect(outcome.unresolved.some((entry) => entry.reason === 'rounds_exhausted')).toBe(true);
  });

  it('does not give up on a uniform rubber-stamp verdict, which used to skip repair entirely', async () => {
    mockRouter({
      critic: (callIndex) =>
        callIndex === 1
          ? JSON.stringify({
              score: 90,
              dimensions: [
                'engagement',
                'voice',
                'clarity',
                'trust',
                'usefulness',
                'naturalness',
                'parity',
              ].map((name) => ({ name, score: 90, note: 'ok' })),
              factualFlags: [],
              issues: [],
            })
          : criticJson(),
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    // Round one is rejected as a rubber stamp; the engine re-scores rather
    // than failing the job, and the second, differentiated verdict passes.
    expect(outcome.converged).toBe(true);
  });

  it('reports every unresolved item with the reason it stayed unresolved', async () => {
    vi.stubEnv('WEEKLY_MASTER_MAX_CRITIC_ROUNDS', '1');
    mockRouter({
      critic: () =>
        criticJson({
          score: 70,
          issues: [
            { code: 'bilingual_claim_parity', message: 'Claim ids differ.', blocker: true },
          ],
        }),
    });

    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    for (const entry of outcome.unresolved) {
      expect(entry.reason).toBeTruthy();
      expect(entry.message).toBeTruthy();
    }
  });
});

describe('provider wiring', () => {
  it('never touches the DB registry when no db option is supplied', async () => {
    mockRouter();
    await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });
    expect(loadProviderRegistry).not.toHaveBeenCalled();
  });

  it('routes writes through an owner-configured provider while the critic keeps its own default', async () => {
    vi.mocked(loadProviderRegistry).mockResolvedValue({
      chainForRole: (role: string) =>
        role === 'weekly.master_writer'
          ? [
              {
                entry: { kind: 'http', id: 'nim' },
                http: {
                  id: 'nim',
                  apiKey: 'nim-key',
                  baseUrl: 'https://integrate.api.nvidia.com/v1',
                  modelQueue: ['deepseek-ai/deepseek-v4-pro'],
                },
              },
            ]
          : [],
    } as never);
    const log = mockRouter();

    await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH, db: {} as never });

    const writeCallIndex = log.kinds.findIndex((kind) => kind === 'en-story');
    const options = vi.mocked(generateWithOpenRouterChain).mock.calls[writeCallIndex]![1] as {
      modelQueue: string[];
      apiKey: string;
    };
    expect(options.modelQueue).toEqual(['deepseek-ai/deepseek-v4-pro']);
    expect(options.apiKey).toBe('nim-key');
  });

  it('accumulates every segment and repair call into the per-step cost totals', async () => {
    mockRouter();
    const outcome = await runWeeklyMaster({ stories: STORIES, researchPacks: RESEARCH });
    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    // Seven English calls (six stories + frame) at $0.004 each.
    expect(outcome.generation.english.estimatedCostUsd).toBeCloseTo(0.028, 5);
    expect(outcome.generation.ukrainian.estimatedCostUsd).toBeCloseTo(0.028, 5);
    expect(outcome.generation.critic.estimatedCostUsd).toBeCloseTo(0.02, 5);
  });
});

describe('reusableMasterRunState', () => {
  it('accepts a state written for the same plan by this engine version', () => {
    const planHash = computeMasterPlanHash(RESEARCH, []);
    const state = {
      version: 'weekly-master-run-v2',
      planHash,
      segments: { 'en:frame': { value: {}, metadata: {} } },
      repairs: [],
      repairAttempts: {},
      criticRounds: 1,
      quality: null,
      unresolved: [],
      calls: { english: [], ukrainian: [], critic: [] },
    };
    expect(reusableMasterRunState(state, planHash)?.criticRounds).toBe(1);
  });

  it('rejects a state from a different plan or a different engine version', () => {
    const planHash = computeMasterPlanHash(RESEARCH, []);
    expect(reusableMasterRunState({ version: 'weekly-master-run-v2', planHash: 'other', segments: {} }, planHash)).toBeNull();
    expect(reusableMasterRunState({ version: 'old', planHash, segments: {} }, planHash)).toBeNull();
    expect(reusableMasterRunState(null, planHash)).toBeNull();
  });
});

describe('critic model rotation', () => {
  function catalogEntry(id: string, promptRate: string) {
    return {
      id,
      context_length: 128_000,
      architecture: { modality: 'text' as const },
      pricing: { prompt: promptRate, completion: '0.000001' },
      benchmarks: { artificial_analysis: { intelligence_index: 60 } },
    };
  }

  it('does not reuse a prior revision critic, and rotates again on the next round', async () => {
    vi.mocked(fetchOpenRouterModels).mockResolvedValue([
      catalogEntry('other-vendor/writer-model', '0.0000005'),
      catalogEntry('vendor-a/critic-1', '0.000001'),
      catalogEntry('vendor-b/critic-2', '0.000002'),
      catalogEntry('vendor-c/critic-3', '0.000003'),
    ]);
    const log = mockRouter({
      critic: (callIndex) =>
        callIndex === 1
          ? criticJson({
              score: 70,
              issues: [
                {
                  code: 'usefulness_generic',
                  message: 'The practical example could attach to any story.',
                  blocker: true,
                  locale: 'en',
                  revisionItemId: 'item-2',
                  field: 'practical',
                  suggestedFix: 'Name a concrete actor and observable result.',
                },
              ],
            })
          : criticJson(),
      repair: () => JSON.stringify({ value: 'A payments team routed one staging queue through it.' }),
    });

    const outcome = await runWeeklyMaster({
      stories: STORIES,
      researchPacks: RESEARCH,
      priorCritics: [{ provider: 'openrouter', model: 'vendor-a/critic-1' }],
    });

    if (outcome.status !== 'complete') throw new Error('expected a complete run');
    expect(log.criticQueues.length).toBeGreaterThanOrEqual(2);
    expect(log.criticQueues[0]).toEqual(['vendor-b/critic-2']);
    expect(log.criticQueues[1]).toEqual(['vendor-c/critic-3']);
    expect(outcome.generation.critic.model).toBe('vendor-c/critic-3');
  });
});
