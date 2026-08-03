import { describe, it, expect } from 'vitest';
import {
  estimateOpenRouterCallCost,
  qualityIndexOf,
  minimalReasoningEffort,
  rankOpenRouterModelsByValue,
} from './openrouter-value';
import type { OpenRouterModelRecord } from './openrouter-models';

function model(overrides: Partial<OpenRouterModelRecord> & { id: string }): OpenRouterModelRecord {
  return {
    context_length: 128_000,
    architecture: { modality: 'text' },
    pricing: { prompt: '0.000001', completion: '0.000006' },
    ...overrides,
  };
}

describe('estimateOpenRouterCallCost', () => {
  it('computes cost from prompt and completion rates', () => {
    const m = model({ id: 'vendor/model', pricing: { prompt: '0.000001', completion: '0.000006' } });
    expect(estimateOpenRouterCallCost(m, 10_000, 20_000)).toBeCloseTo(0.01 + 0.12, 6);
  });

  it('returns null when pricing is missing or unparseable', () => {
    expect(estimateOpenRouterCallCost(model({ id: 'a', pricing: {} }), 1000, 1000)).toBeNull();
    expect(
      estimateOpenRouterCallCost(model({ id: 'a', pricing: { prompt: 'n/a', completion: '0.1' } }), 1000, 1000),
    ).toBeNull();
  });
});

describe('qualityIndexOf', () => {
  it('reads the Artificial Analysis intelligence index', () => {
    const m = model({ id: 'a', benchmarks: { artificial_analysis: { intelligence_index: 62 } } });
    expect(qualityIndexOf(m)).toBe(62);
  });

  it('returns null when unrated', () => {
    expect(qualityIndexOf(model({ id: 'a' }))).toBeNull();
  });
});

describe('minimalReasoningEffort', () => {
  it('picks "none" when supported', () => {
    const m = model({
      id: 'a',
      reasoning: { default_enabled: true, supported_efforts: ['high', 'low', 'none'] },
    });
    expect(minimalReasoningEffort(m)).toBe('none');
  });

  it('falls back to "low" when "none" is unsupported', () => {
    const m = model({ id: 'a', reasoning: { default_enabled: true, supported_efforts: ['high', 'low'] } });
    expect(minimalReasoningEffort(m)).toBe('low');
  });

  it('returns null when reasoning is not enabled by default', () => {
    const m = model({ id: 'a', reasoning: { default_enabled: false, supported_efforts: ['low'] } });
    expect(minimalReasoningEffort(m)).toBeNull();
  });

  it('returns null when no reasoning config is present', () => {
    expect(minimalReasoningEffort(model({ id: 'a' }))).toBeNull();
  });
});

describe('rankOpenRouterModelsByValue', () => {
  const cheapGood = model({
    id: 'openai/gpt-cheap',
    pricing: { prompt: '0.000001', completion: '0.000006' },
    benchmarks: { artificial_analysis: { intelligence_index: 60 } },
  });
  const expensiveGreat = model({
    id: 'anthropic/claude-expensive',
    pricing: { prompt: '0.000015', completion: '0.000075' },
    benchmarks: { artificial_analysis: { intelligence_index: 80 } },
  });
  const cheapButWeak = model({
    id: 'someone/weak-model',
    pricing: { prompt: '0.0000001', completion: '0.0000006' },
    benchmarks: { artificial_analysis: { intelligence_index: 20 } },
  });
  const unratedUntrusted = model({
    id: 'unknown-vendor/mystery',
    pricing: { prompt: '0.0000001', completion: '0.0000006' },
  });
  const unratedFromTrustedVendor = model({
    id: 'openai/gpt-new-release',
    pricing: { prompt: '0.0000005', completion: '0.000003' },
  });

  const catalog = [cheapGood, expensiveGreat, cheapButWeak, unratedUntrusted, unratedFromTrustedVendor];

  it('ranks cheapest-first among rated models that clear the quality floor', () => {
    const ranked = rankOpenRouterModelsByValue(catalog, {
      promptTokens: 10_000,
      completionTokens: 20_000,
      minQualityIndex: 50,
    });
    const ids = ranked.map((r) => r.id);
    expect(ids).toContain('openai/gpt-cheap');
    expect(ids).toContain('anthropic/claude-expensive');
    expect(ids).not.toContain('someone/weak-model'); // below quality floor
    expect(ids).not.toContain('unknown-vendor/mystery'); // unrated
    // an unrated model is excluded even from an otherwise reputable vendor
    expect(ids).not.toContain('openai/gpt-new-release');
    // cheapest among the rated models clearing the floor should rank first
    expect(ids[0]).toBe('openai/gpt-cheap');
  });

  it('excludes free-tier, image/audio/embedding, and vendor-excluded models', () => {
    const ranked = rankOpenRouterModelsByValue(
      [
        model({ id: 'vendor/x:free', benchmarks: { artificial_analysis: { intelligence_index: 90 } } }),
        model({ id: 'vendor/image-gen', benchmarks: { artificial_analysis: { intelligence_index: 90 } } }),
        model({
          id: 'blocked/model',
          benchmarks: { artificial_analysis: { intelligence_index: 90 } },
        }),
      ],
      { promptTokens: 1000, completionTokens: 1000, minQualityIndex: 0, excludeVendors: ['blocked'] },
    );
    expect(ranked).toHaveLength(0);
  });

  it('respects an explicit configuredModels allowlist', () => {
    const ranked = rankOpenRouterModelsByValue(catalog, {
      promptTokens: 10_000,
      completionTokens: 20_000,
      minQualityIndex: 0,
      configuredModels: ['anthropic/claude-expensive'],
    });
    expect(ranked.map((r) => r.id)).toEqual(['anthropic/claude-expensive']);
  });

  it('carries the minimal reasoning effort onto each candidate', () => {
    const reasoningModel = model({
      id: 'openai/gpt-reasoner',
      pricing: { prompt: '0.000001', completion: '0.000006' },
      benchmarks: { artificial_analysis: { intelligence_index: 70 } },
      reasoning: { default_enabled: true, supported_efforts: ['high', 'none'] },
    });
    const ranked = rankOpenRouterModelsByValue([reasoningModel], {
      promptTokens: 1000,
      completionTokens: 1000,
      minQualityIndex: 0,
    });
    expect(ranked[0]?.reasoningEffort).toBe('none');
  });
});
