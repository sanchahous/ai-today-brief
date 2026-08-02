import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
import {
  normalizeWeeklySocialAngles,
  masterRetryGuidancePrompt,
  openRouterModelVendor,
  premiumGeminiEditorialModels,
  premiumOpenRouterModels,
  generateWeeklyMaster,
  type WeeklyMasterEnglishResult,
  type WeeklyMasterUkrainianResult,
} from './editorial-llm';

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

describe('generateWeeklyMaster checkpoint reuse', () => {
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
        video: { title: 't', hook: 'h', narration: 'n', scenes: [], shorts: [] },
        socialAngles: [
          'telegram',
          'facebook',
          'threads',
          'x',
          'linkedin',
          'instagram',
        ].map(socialAngle),
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
    dimensions: ['hook', 'clarity', 'trust', 'usefulness', 'structure', 'naturalness', 'parity'].map(
      (name) => ({ name, score: 90, note: 'ok' }),
    ),
    factualFlags: [],
    issues: [],
  });

  afterEach(() => {
    vi.mocked(generateWithOpenRouterChain).mockReset();
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
          video: englishResult().value.video,
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
});
