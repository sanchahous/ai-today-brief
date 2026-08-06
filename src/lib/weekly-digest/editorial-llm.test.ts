import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../pipeline/openrouter-models', () => ({
  fetchOpenRouterModels: vi.fn().mockResolvedValue([
    {
      id: 'vendor/critic-model',
      context_length: 128_000,
      architecture: { modality: 'text' },
      pricing: { prompt: '0.000001', completion: '0.000006' },
      benchmarks: { artificial_analysis: { intelligence_index: 60 } },
    },
    {
      // A distinct vendor so the independent critic's OpenRouter fallback
      // (which excludes the writer's vendor) still has a model to pick.
      id: 'other-vendor/writer-model',
      context_length: 128_000,
      architecture: { modality: 'text' },
      pricing: { prompt: '0.000001', completion: '0.000006' },
      benchmarks: { artificial_analysis: { intelligence_index: 60 } },
    },
  ]),
}));

vi.mock('../../../pipeline/openrouter-summarize', () => ({
  generateWithOpenRouterChain: vi.fn(),
}));

vi.mock('../../../pipeline/claude-cli', () => ({
  generateWithClaudeCli: vi.fn(),
}));

import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
import { generateWithClaudeCli } from '../../../pipeline/claude-cli';
import { fetchOpenRouterModels } from '../../../pipeline/openrouter-models';
import {
  normalizeWeeklySocialAngles,
  masterRetryGuidancePrompt,
  approvedStoryPromptMaterial,
  criticApprovedEvidence,
  criticPrompt,
  openRouterModelVendor,
  premiumGeminiEditorialModels,
  premiumOpenRouterModels,
  generateWeeklyMaster,
  splitMasterRetryGuidance,
  type WeeklyMasterEnglishResult,
  type WeeklyMasterInputStory,
  type WeeklyMasterRetryGuidance,
  type WeeklyMasterUkrainianResult,
} from './editorial-llm';
import type { WeeklyMasterBundle } from './content-studio';

function socialAngle(channel: string) {
  return { channel, hookAngle: `Hook for ${channel}`, thesis: 'Thesis', factIds: ['claim-1'] };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('premiumOpenRouterModels', () => {
  it('keeps one in-request model attempt within the function budget', () => {
    vi.stubEnv('WEEKLY_MASTER_OPENROUTER_MODELS', 'provider/new,provider/older');
    expect(
      premiumOpenRouterModels([
        {
          id: 'provider/new',
          created: 2,
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000001', completion: '0.000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
        {
          id: 'provider/older',
          created: 1,
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000002', completion: '0.00001' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
      ]),
    ).toEqual(['provider/new']);
  });

  it('selects an independent premium vendor for the critic', () => {
    expect(
      premiumOpenRouterModels(
        [
          {
            id: 'anthropic/claude-opus-current',
            created: 3,
            context_length: 128_000,
            architecture: { modality: 'text' },
            pricing: { prompt: '0.000001', completion: '0.000006' },
            benchmarks: { artificial_analysis: { intelligence_index: 80 } },
          },
          {
            id: 'openai/gpt-current',
            created: 2,
            context_length: 128_000,
            architecture: { modality: 'text' },
            pricing: { prompt: '0.000002', completion: '0.00001' },
            benchmarks: { artificial_analysis: { intelligence_index: 55 } },
          },
        ],
        { configuredModels: [], excludeVendors: ['anthropic'] },
      ),
    ).toEqual(['openai/gpt-current']);
    expect(openRouterModelVendor('openai/gpt-current')).toBe('openai');
  });

  it('prefers the cheaper of two models that both clear the quality floor', () => {
    expect(
      premiumOpenRouterModels([
        {
          id: 'vendor/cheap-adequate',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000001', completion: '0.000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
        {
          id: 'vendor/expensive-flagship',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000015', completion: '0.000075' },
          benchmarks: { artificial_analysis: { intelligence_index: 85 } },
        },
      ]),
    ).toEqual(['vendor/cheap-adequate']);
  });

  it('excludes models below the quality floor even when cheapest', () => {
    expect(
      premiumOpenRouterModels([
        {
          id: 'vendor/too-weak',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.0000001', completion: '0.0000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 10 } },
        },
        {
          id: 'vendor/adequate',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000001', completion: '0.000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
      ]),
    ).toEqual(['vendor/adequate']);
  });
});

describe('masterRetryGuidancePrompt', () => {
  it('labels prior critic feedback as constraints rather than factual evidence', () => {
    const prompt = masterRetryGuidancePrompt([
      {
        code: 'STRENGTHENED-CLAIM',
        message: 'The earlier draft implied unsupported causality.',
        suggestedFix: 'State only that the reversal occurred.',
        locale: 'en',
      },
    ]);
    expect(prompt).toContain('not approved factual claims');
    expect(prompt).toContain('State only that the reversal occurred.');
  });
});

describe('splitMasterRetryGuidance', () => {
  it('routes plain locale:uk guidance (e.g. article naturalness) to Ukrainian', () => {
    const guidance: WeeklyMasterRetryGuidance[] = [
      { code: 'STYLE_CALQUE', message: 'calqued phrasing', locale: 'uk', field: 'stories.body' },
    ];
    const { english, ukrainian } = splitMasterRetryGuidance(guidance);
    expect(english).toHaveLength(0);
    expect(ukrainian).toHaveLength(1);
  });

  it('leaves untagged guidance (structural/English issues) in English', () => {
    const guidance: WeeklyMasterRetryGuidance[] = [
      { code: 'top3_radar_structure', message: 'must contain exactly three features' },
    ];
    const { english, ukrainian } = splitMasterRetryGuidance(guidance);
    expect(english).toHaveLength(1);
    expect(ukrainian).toHaveLength(0);
  });
});

function storyWithPrimaryExcerpt(): WeeklyMasterInputStory {
  return {
    revisionItemId: 'item-w2',
    rank: 2,
    placement: 'feature',
    titleEn: 'CryptanalysisBench',
    titleUk: 'CryptanalysisBench',
    summaryEn: 'Anthropic released CryptanalysisBench.',
    summaryUk: 'Anthropic випустив CryptanalysisBench.',
    whyEn: null,
    whyUk: null,
    sources: [{ name: 'Anthropic', url: 'https://www.anthropic.com/research/example' }],
    claims: [
      {
        id: 'W2-C5',
        text: 'Benchmark Name: CryptanalysisBench',
        evidenceUrls: ['https://www.anthropic.com/research/example'],
      },
    ],
    research: {
      schemaVersion: 'weekly-research-v3',
      digestId: 'digest',
      revisionId: 'revision',
      revisionItemId: 'item-w2',
      placement: 'feature',
      primarySource: {
        url: 'https://www.anthropic.com/research/example',
        sourceName: 'Anthropic',
        domain: 'anthropic.com',
        primary: true,
        extractedText:
          'For this experiment, we used a Claude Code-like harness that supports multiple worker agents with access to computational tools like Python and Sage.',
        ogImage: null,
      },
      corroboratingSources: [],
      claims: [
        {
          id: 'W2-C5',
          text: 'Benchmark Name: CryptanalysisBench',
          kind: 'fact',
          evidenceUrls: ['https://www.anthropic.com/research/example'],
        },
      ],
      context: [],
      contradictions: [],
      limitations: [],
      risks: [],
      researchedAt: '2026-08-04T00:00:00.000Z',
    },
  };
}

describe('approvedStoryPromptMaterial', () => {
  it('surfaces primary source excerpts beside structured claims for the writer', () => {
    const [material] = approvedStoryPromptMaterial([storyWithPrimaryExcerpt()]);
    expect(material.claims.map((claim) => claim.id)).toEqual(['W2-C5']);
    expect(material.primarySourceExcerpt?.excerpt).toContain('Python and Sage');
    expect(material).not.toHaveProperty('research');
  });

  it('passes through the owner-set editorial angle when present (PR4)', () => {
    const withAngle = { ...storyWithPrimaryExcerpt(), angle: 'Frame this as a cautionary tale.' };
    const [material] = approvedStoryPromptMaterial([withAngle]);
    expect(material.angle).toBe('Frame this as a cautionary tale.');
  });

  it('omits angle entirely when the story has none, rather than sending an empty string', () => {
    const [material] = approvedStoryPromptMaterial([storyWithPrimaryExcerpt()]);
    expect(material).not.toHaveProperty('angle');
  });
});

describe('criticApprovedEvidence', () => {
  it('gives the critic claims plus primary excerpts so excerpt-only details stay grounded', () => {
    const [evidence] = criticApprovedEvidence([storyWithPrimaryExcerpt()]);
    expect(evidence.claims).toHaveLength(1);
    expect(evidence.primarySourceExcerpt?.excerpt).toContain('Python and Sage');
  });
});

describe('criticPrompt', () => {
  it('instructs the critic to accept excerpt-supported details missing from numbered claims', () => {
    const bundle = {
      en: { locale: 'en', stories: [] },
      uk: { locale: 'uk', stories: [] },
      socialAngles: [],
    } as unknown as WeeklyMasterBundle;
    const prompt = criticPrompt(bundle, [storyWithPrimaryExcerpt()]);
    expect(prompt).toContain('claims AND the attached primary/corroborating source excerpts');
    expect(prompt).toContain('do NOT flag it as UNSUPPORTED_');
    expect(prompt).toContain('Python and Sage');
    expect(prompt).toContain('APPROVED EVIDENCE');
  });
});

describe('premiumGeminiEditorialModels', () => {
  it('finds Pro after faster models in the live-ranked queue', () => {
    expect(
      premiumGeminiEditorialModels([
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.5-pro',
      ]),
    ).toEqual(['gemini-3.5-pro']);
  });

  it('rejects non-premium model families', () => {
    expect(
      premiumGeminiEditorialModels([
        'gemini-3.6-flash',
        'gemini-3-mini',
        'gemini-3-nano',
      ]),
    ).toEqual([]);
  });
});

describe('normalizeWeeklySocialAngles', () => {
  it('canonicalizes common channel variants and removes harmless duplicates', () => {
    expect(
      normalizeWeeklySocialAngles(
        [
          'Telegram',
          'facebook',
          'threads',
          'Twitter / X',
          'Linked-In',
          'instagram',
          'Instagram',
        ].map(socialAngle),
      ).map((angle) => angle.channel),
    ).toEqual(['telegram', 'facebook', 'threads', 'x', 'linkedin', 'instagram']);
  });

  it('still rejects a package that omits a required channel', () => {
    expect(() =>
      normalizeWeeklySocialAngles(
        ['telegram', 'facebook', 'threads', 'x', 'linkedin'].map(socialAngle),
      ),
    ).toThrow('exactly one social angle for each channel');
  });
});

const story = (revisionItemId: string, placement: 'feature' | 'radar') => ({
  revisionItemId,
  rank: placement === 'feature' ? 1 : 4,
  placement,
  titleEn: 'Title',
  titleUk: 'Заголовок',
  summaryEn: 'Summary',
  summaryUk: 'Підсумок',
  whyEn: null,
  whyUk: null,
  sources: [{ name: 'Example', url: 'https://example.com' }],
  claims: [{ id: 'claim-1', text: 'A supported claim.', evidenceUrls: ['https://example.com'] }],
});

const articleStory = (revisionItemId: string, placement: 'feature' | 'radar') => ({
  revisionItemId,
  placement,
  headline: 'Headline',
  summary: 'Summary',
  hook: 'Hook',
  body: 'Body',
  why: 'Why',
  practical: 'Practical',
  limitation: 'Limitation',
  takeaway: 'Takeaway',
  editorsView: placement === 'feature' ? 'Editorial reasoning about where this leads.' : '',
  discussionQuestion: placement === 'feature' ? 'What would you watch for next?' : '',
  claimIds: ['claim-1'],
});

function englishResult(): WeeklyMasterEnglishResult {
  return {
    value: {
      article: {
        locale: 'en',
        title: 't',
        seoTitle: 't',
        metaDescription: 'd',
        ogTitle: 't',
        ogDescription: 'd',
        standfirst: 's',
        theme: 'th',
        intro: 'i',
        editorNote: 'e',
        keyTakeaways: ['k'],
        topics: ['t'],
        entities: ['e'],
        internalLinks: [],
        conclusion: 'c',
        stories: [articleStory('item-1', 'feature')],
      },
      socialAngles: ['telegram', 'facebook', 'threads', 'x', 'linkedin', 'instagram'].map(
        socialAngle,
      ),
    },
    metadata: {
      provider: 'openrouter',
      model: 'checkpointed/english-model',
      promptTokens: 100,
      outputTokens: 200,
      estimatedCostUsd: 0.05,
      costSource: 'reported',
      promptVersion: 'weekly-master-v3',
    },
  } as unknown as WeeklyMasterEnglishResult;
}

function ukrainianResult(): WeeklyMasterUkrainianResult {
  return {
    value: {
      locale: 'uk',
      title: 't',
      seoTitle: 't',
      metaDescription: 'd',
      ogTitle: 't',
      ogDescription: 'd',
      standfirst: 's',
      theme: 'th',
      intro: 'i',
      editorNote: 'e',
      keyTakeaways: ['k'],
      topics: ['t'],
      entities: ['e'],
      internalLinks: [],
      conclusion: 'c',
      stories: [articleStory('item-1', 'feature')],
    },
    metadata: {
      provider: 'openrouter',
      model: 'checkpointed/ukrainian-model',
      promptTokens: 100,
      outputTokens: 200,
      estimatedCostUsd: 0.04,
      costSource: 'reported',
      promptVersion: 'weekly-master-v3',
    },
  } as unknown as WeeklyMasterUkrainianResult;
}

const CRITIC_JSON = JSON.stringify({
  score: 90,
  dimensions: ['engagement', 'voice', 'clarity', 'trust', 'usefulness', 'naturalness', 'parity'].map(
    (name) => ({ name, score: 90, note: 'ok' }),
  ),
  factualFlags: [],
  issues: [],
});

describe('generateWeeklyMaster checkpoint reuse', () => {
  afterEach(() => {
    vi.mocked(generateWithOpenRouterChain).mockReset();
    vi.mocked(generateWithClaudeCli).mockReset();
    vi.unstubAllEnvs();
  });

  it('skips EN/UK generation and reuses the checkpoint when both steps are cached', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: CRITIC_JSON,
      provider: 'openrouter',
      model: 'vendor/critic-model',
      usage: null,
    });
    const onStepComplete = vi.fn();

    const result = await generateWeeklyMaster([story('item-1', 'feature')], [], [], {
      checkpoint: { english: englishResult(), ukrainian: ukrainianResult() },
      onStepComplete,
    });

    // Only the critic call should have hit a provider — EN/UK came from the checkpoint.
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(1);
    expect(onStepComplete).not.toHaveBeenCalled();
    expect(result.generation.english.model).toBe('checkpointed/english-model');
    expect(result.generation.ukrainian.model).toBe('checkpointed/ukrainian-model');
  });

  it('generates EN/UK and reports both steps when no checkpoint is provided', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    vi.mocked(generateWithOpenRouterChain).mockImplementation(async (prompt: string) => {
      if (prompt.includes('independent factual and editorial critic')) {
        return { text: CRITIC_JSON, provider: 'openrouter', model: 'vendor/critic-model', usage: null };
      }
      if (prompt.includes('Ukrainian senior news editor')) {
        return {
          text: JSON.stringify(englishResult().value.article),
          provider: 'openrouter',
          model: 'other-vendor/writer-model',
          usage: null,
        };
      }
      return {
        text: JSON.stringify({
          article: englishResult().value.article,
          socialAngles: englishResult().value.socialAngles,
        }),
        provider: 'openrouter',
        model: 'other-vendor/writer-model',
        usage: null,
      };
    });
    const onStepComplete = vi.fn();

    await generateWeeklyMaster([story('item-1', 'feature')], [], [], { onStepComplete });

    expect(onStepComplete).toHaveBeenCalledWith('english', expect.anything());
    expect(onStepComplete).toHaveBeenCalledWith('ukrainian', expect.anything());
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(3); // english + ukrainian + critic
  });

  it('surfaces the owner-set angle in the English prompt as binding direction (PR4)', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    vi.mocked(generateWithOpenRouterChain).mockImplementation(async (prompt: string) => {
      if (prompt.includes('independent factual and editorial critic')) {
        return { text: CRITIC_JSON, provider: 'openrouter', model: 'vendor/critic-model', usage: null };
      }
      if (prompt.includes('Ukrainian senior news editor')) {
        return {
          text: JSON.stringify(englishResult().value.article),
          provider: 'openrouter',
          model: 'other-vendor/writer-model',
          usage: null,
        };
      }
      return {
        text: JSON.stringify({
          article: englishResult().value.article,
          socialAngles: englishResult().value.socialAngles,
        }),
        provider: 'openrouter',
        model: 'other-vendor/writer-model',
        usage: null,
      };
    });

    await generateWeeklyMaster(
      [{ ...story('item-1', 'feature'), angle: 'Frame this as a cautionary infra-trust story.' }],
      [],
      [],
    );

    const englishPromptSent = vi
      .mocked(generateWithOpenRouterChain)
      .mock.calls.map((call) => call[0])
      .find(
        (prompt) =>
          !prompt.includes('independent factual and editorial critic') &&
          !prompt.includes('Ukrainian senior news editor'),
      );
    expect(englishPromptSent).toContain('Frame this as a cautionary infra-trust story.');
    expect(englishPromptSent).toContain('binding editorial direction');
  });
});

describe('generateWeeklyMaster claude-cli provider', () => {
  afterEach(() => {
    vi.mocked(generateWithOpenRouterChain).mockReset();
    vi.mocked(generateWithClaudeCli).mockReset();
    vi.mocked(fetchOpenRouterModels).mockReset();
    vi.unstubAllEnvs();
  });

  it('writes EN/UK through claude-cli when the subscription token is configured, and only the critic reaches OpenRouter', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    vi.mocked(fetchOpenRouterModels).mockResolvedValue([
      {
        id: 'vendor/critic-model',
        context_length: 128_000,
        architecture: { modality: 'text' },
        pricing: { prompt: '0.000001', completion: '0.000006' },
        benchmarks: { artificial_analysis: { intelligence_index: 60 } },
      },
    ]);
    vi.mocked(generateWithClaudeCli).mockImplementation(async (prompt: string) => {
      if (prompt.includes('Ukrainian senior news editor')) {
        return {
          text: JSON.stringify(englishResult().value.article),
          model: 'claude-sonnet-5',
          totalCostUsd: 0.25,
        };
      }
      return {
        text: JSON.stringify({
          article: englishResult().value.article,
          socialAngles: englishResult().value.socialAngles,
        }),
        model: 'claude-sonnet-5',
        totalCostUsd: 0.25,
      };
    });
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: CRITIC_JSON,
      provider: 'openrouter',
      model: 'vendor/critic-model',
      usage: null,
    });

    const result = await generateWeeklyMaster([story('item-1', 'feature')], [], []);

    expect(generateWithClaudeCli).toHaveBeenCalledTimes(2); // english + ukrainian
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(1); // critic only
    expect(result.generation.english.provider).toBe('claude-cli');
    expect(result.generation.english.costSource).toBe('subscription');
    expect(result.generation.english.estimatedCostUsd).toBe(0);
    expect(result.generation.ukrainian.provider).toBe('claude-cli');
  });

  it('excludes the anthropic vendor from the critic OpenRouter fallback when claude-cli wrote the article', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    vi.mocked(fetchOpenRouterModels).mockResolvedValue([
      {
        id: 'anthropic/claude-should-be-excluded',
        context_length: 128_000,
        architecture: { modality: 'text' },
        pricing: { prompt: '0.000001', completion: '0.000006' },
        benchmarks: { artificial_analysis: { intelligence_index: 90 } },
      },
      {
        id: 'other-vendor/critic-fallback',
        context_length: 128_000,
        architecture: { modality: 'text' },
        pricing: { prompt: '0.000001', completion: '0.000006' },
        benchmarks: { artificial_analysis: { intelligence_index: 60 } },
      },
    ]);
    vi.mocked(generateWithClaudeCli).mockImplementation(async (prompt: string) => {
      if (prompt.includes('Ukrainian senior news editor')) {
        return {
          text: JSON.stringify(englishResult().value.article),
          model: 'claude-sonnet-5',
          totalCostUsd: 0.25,
        };
      }
      return {
        text: JSON.stringify({
          article: englishResult().value.article,
          socialAngles: englishResult().value.socialAngles,
        }),
        model: 'claude-sonnet-5',
        totalCostUsd: 0.25,
      };
    });
    // The critic's primary "independent provider" attempt (plain OpenRouter,
    // no vendor exclusion — providerOrder's first non-claude-cli entry) has
    // to fail before the code falls back to the vendor-exclusion branch that
    // is actually under test here.
    vi.mocked(generateWithOpenRouterChain)
      .mockRejectedValueOnce(new Error('independent provider attempt failed'))
      .mockResolvedValue({
        text: CRITIC_JSON,
        provider: 'openrouter',
        model: 'other-vendor/critic-fallback',
        usage: null,
      });

    await generateWeeklyMaster([story('item-1', 'feature')], [], []);

    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(2);
    const fallbackCall = vi.mocked(generateWithOpenRouterChain).mock.calls.at(-1);
    expect(fallbackCall?.[1]?.modelQueue).toEqual(['other-vendor/critic-fallback']);
  });
});

// A fully valid bundle (3 features + 3 radar, matching claims, complete
// social payload) so validateMasterBundle's deterministic checks emit zero
// issues -- isolating the revise-loop tests below to purely critic-driven
// pass/fail, not incidental fixture gaps.
const REVISE_ITEM_IDS = ['w-1', 'w-2', 'w-3', 'w-4', 'w-5', 'w-6'];

function reviseStories(): WeeklyMasterInputStory[] {
  return REVISE_ITEM_IDS.map((id, index) => ({
    revisionItemId: id,
    rank: index + 1,
    placement: index < 3 ? 'feature' : 'radar',
    titleEn: `Title ${index + 1}`,
    titleUk: `Заголовок ${index + 1}`,
    summaryEn: `Summary ${index + 1}`,
    summaryUk: `Підсумок ${index + 1}`,
    whyEn: null,
    whyUk: null,
    sources: [{ name: 'Example', url: 'https://example.com' }],
    claims: [{ id: `claim-${index + 1}`, text: `Claim ${index + 1}.`, evidenceUrls: ['https://example.com'] }],
  }));
}

function reviseArticleStories() {
  return REVISE_ITEM_IDS.map((id, index) => {
    const placement = index < 3 ? 'feature' : 'radar';
    return {
      revisionItemId: id,
      placement,
      headline: `Headline ${index + 1}`,
      summary: `Summary of story ${index + 1}.`,
      hook: `Hook ${index + 1}`,
      body: `A concrete narrative body for story ${index + 1} with real specificity. `.repeat(20),
      why: `This changes the reliability decision for story ${index + 1}.`,
      practical: `A named actor runs a specific workflow for story ${index + 1} and measures a real outcome.`,
      limitation: `The source for story ${index + 1} covers one reported case only.`,
      takeaway: `Require verification before acting on story ${index + 1}.`,
      editorsView: placement === 'feature' ? `Editorial reasoning about where story ${index + 1} leads next.` : '',
      discussionQuestion: placement === 'feature' ? `What would change your mind about story ${index + 1}?` : '',
      claimIds: [`claim-${index + 1}`],
    };
  });
}

function reviseSocialAngles() {
  return ['telegram', 'facebook', 'threads', 'x', 'linkedin', 'instagram'].map((channel) => ({
    channel,
    hookAngle: `Hook for ${channel}`,
    thesis: 'Thesis',
    factIds: ['claim-1'],
  }));
}

function reviseEnglishResult(): WeeklyMasterEnglishResult {
  return {
    value: {
      article: {
        locale: 'en',
        title: 't',
        seoTitle: 't',
        metaDescription: 'd',
        ogTitle: 't',
        ogDescription: 'd',
        standfirst: 's',
        theme: 'th',
        intro: 'i',
        editorNote: 'e',
        keyTakeaways: ['k'],
        topics: ['t'],
        entities: ['e'],
        internalLinks: [],
        conclusion: 'c',
        stories: reviseArticleStories(),
      },
      socialAngles: reviseSocialAngles(),
    },
    metadata: {
      provider: 'openrouter',
      model: 'writer-model',
      promptTokens: 100,
      outputTokens: 200,
      estimatedCostUsd: 0.05,
      costSource: 'reported',
      promptVersion: 'weekly-master-v6',
    },
  } as unknown as WeeklyMasterEnglishResult;
}

function reviseUkrainianResult(): WeeklyMasterUkrainianResult {
  return {
    value: { ...reviseEnglishResult().value.article, locale: 'uk' },
    metadata: {
      provider: 'openrouter',
      model: 'writer-model',
      promptTokens: 90,
      outputTokens: 180,
      estimatedCostUsd: 0.04,
      costSource: 'reported',
      promptVersion: 'weekly-master-v6',
    },
  } as unknown as WeeklyMasterUkrainianResult;
}

function criticJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    score: 90,
    dimensions: ['engagement', 'voice', 'clarity', 'trust', 'usefulness', 'naturalness', 'parity'].map(
      (name) => ({ name, score: 90, note: 'ok' }),
    ),
    factualFlags: [],
    issues: [],
    ...overrides,
  });
}

// Fixed usage payloads so accumulated cost is exact arithmetic in the tests
// below, not dependent on estimateTokens(prompt.length) heuristics.
const WRITE_USAGE = { promptTokens: 1000, completionTokens: 2000, totalTokens: 3000, costUsd: 0.05 };
const READAPT_USAGE = { promptTokens: 900, completionTokens: 1800, totalTokens: 2700, costUsd: 0.04 };
const CRITIC_USAGE = { promptTokens: 500, completionTokens: 300, totalTokens: 800, costUsd: 0.02 };

function mockRouterResponses(handlers: {
  critic: (callIndex: number) => string;
  englishWrite?: () => string;
}) {
  let criticCalls = 0;
  vi.mocked(generateWithOpenRouterChain).mockImplementation(async (prompt: string) => {
    if (prompt.includes('independent factual and editorial critic')) {
      criticCalls += 1;
      return {
        text: handlers.critic(criticCalls),
        provider: 'openrouter',
        model: 'vendor/critic-model',
        usage: CRITIC_USAGE,
      };
    }
    if (prompt.includes('line-editing an already-drafted')) {
      return {
        text: JSON.stringify(reviseEnglishResult().value.article),
        provider: 'openrouter',
        model: 'writer-model',
        usage: WRITE_USAGE,
      };
    }
    if (prompt.includes('Ukrainian senior news editor')) {
      return {
        text: JSON.stringify(reviseUkrainianResult().value),
        provider: 'openrouter',
        model: 'writer-model',
        usage: READAPT_USAGE,
      };
    }
    return {
      text:
        handlers.englishWrite?.() ??
        JSON.stringify({
          article: reviseEnglishResult().value.article,
          socialAngles: reviseEnglishResult().value.socialAngles,
        }),
      provider: 'openrouter',
      model: 'writer-model',
      usage: WRITE_USAGE,
    };
  });
}

describe('generateWeeklyMaster revise loop', () => {
  beforeEach(() => {
    // A sibling describe block's afterEach resets this mock without
    // restoring the module-level default -- re-seed it here so this block
    // isn't affected by file execution order.
    vi.mocked(fetchOpenRouterModels).mockResolvedValue([
      {
        id: 'vendor/critic-model',
        context_length: 128_000,
        architecture: { modality: 'text' },
        pricing: { prompt: '0.000001', completion: '0.000006' },
        benchmarks: { artificial_analysis: { intelligence_index: 60 } },
      },
      {
        id: 'other-vendor/writer-model',
        context_length: 128_000,
        architecture: { modality: 'text' },
        pricing: { prompt: '0.000001', completion: '0.000006' },
        benchmarks: { artificial_analysis: { intelligence_index: 60 } },
      },
    ]);
  });

  afterEach(() => {
    vi.mocked(generateWithOpenRouterChain).mockReset();
    vi.unstubAllEnvs();
  });

  it('revises only the flagged field on a low-engagement failure, then passes on the re-critique', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    mockRouterResponses({
      critic: (callIndex) =>
        callIndex === 1
          ? criticJson({
              dimensions: ['engagement', 'voice', 'clarity', 'trust', 'usefulness', 'naturalness', 'parity'].map(
                (name) => ({ name, score: name === 'engagement' ? 60 : 90, note: 'flat opening' }),
              ),
            })
          : criticJson(),
    });

    const result = await generateWeeklyMaster(reviseStories(), [], []);

    // english write + ukrainian write + critic(fail) + revise(en) + readapt(uk) + critic(pass) = 6
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(6);
    const revisePrompts = vi
      .mocked(generateWithOpenRouterChain)
      .mock.calls.map((call) => call[0])
      .filter((prompt) => prompt.includes('line-editing an already-drafted'));
    expect(revisePrompts).toHaveLength(1);
    expect(revisePrompts[0]).toContain('dimension_low_score:engagement');
    expect(result.quality.score).toBe(90);
    expect(result.quality.dimensions.find((d) => d.name === 'engagement')?.score).toBe(90);

    // english: initial write + 1 revise; ukrainian: initial write + 1 readapt; critic: 2 calls.
    expect(result.generation.english.estimatedCostUsd).toBeCloseTo(WRITE_USAGE.costUsd * 2, 6);
    expect(result.generation.ukrainian.estimatedCostUsd).toBeCloseTo(READAPT_USAGE.costUsd * 2, 6);
    expect(result.generation.critic.estimatedCostUsd).toBeCloseTo(CRITIC_USAGE.costUsd * 2, 6);
    expect(result.generation.english.promptTokens).toBe(WRITE_USAGE.promptTokens * 2);
  });

  it('never attempts a revise pass when a structural/grounding blocker is present', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    mockRouterResponses({
      critic: () =>
        criticJson({
          issues: [{ code: 'UNSUPPORTED_NUMBER', message: 'invented figure', blocker: true }],
        }),
    });

    const result = await generateWeeklyMaster(reviseStories(), [], []);

    // english write + ukrainian write + critic = 3, no revise/re-critique calls
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(3);
    expect(
      vi
        .mocked(generateWithOpenRouterChain)
        .mock.calls.some((call) => call[0].includes('line-editing an already-drafted')),
    ).toBe(false);
    expect(result.quality.issues).toContainEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_NUMBER' }),
    );
    expect(result.generation.english.estimatedCostUsd).toBeCloseTo(WRITE_USAGE.costUsd, 6);
  });

  it('caps at MAX_REVISE_ATTEMPTS (2) and returns the still-failing report rather than looping forever', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    mockRouterResponses({
      critic: () =>
        criticJson({
          dimensions: ['engagement', 'voice', 'clarity', 'trust', 'usefulness', 'naturalness', 'parity'].map(
            (name) => ({ name, score: name === 'voice' ? 60 : 90, note: 'still off' }),
          ),
        }),
    });

    const result = await generateWeeklyMaster(reviseStories(), [], []);

    // initial write (2) + critic + [revise(en) + readapt(uk) + critic] x2 = 2 + 1 + 6 = 9
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(9);
    expect(result.quality.dimensions.find((d) => d.name === 'voice')?.score).toBe(60);
    // Cost accumulates across every attempt (initial + 2 revise rounds), not just the last one.
    expect(result.generation.english.estimatedCostUsd).toBeCloseTo(WRITE_USAGE.costUsd * 3, 6);
    expect(result.generation.ukrainian.estimatedCostUsd).toBeCloseTo(READAPT_USAGE.costUsd * 3, 6);
    expect(result.generation.critic.estimatedCostUsd).toBeCloseTo(CRITIC_USAGE.costUsd * 3, 6);
  });
});
