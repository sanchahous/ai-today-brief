import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeWeeklySocialAngles,
  masterRetryGuidancePrompt,
  openRouterModelVendor,
  premiumGeminiEditorialModels,
  premiumOpenRouterModels,
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
