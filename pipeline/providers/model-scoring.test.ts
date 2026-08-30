import { describe, expect, it } from 'vitest';
import type { OpenRouterModelRecord } from '../openrouter-models';
import {
  DEFAULT_CACHE_HIT_RATE,
  DEFAULT_FREE_QUALITY_FLOOR_DELTA,
  DEFAULT_MAX_PRICE_PER_MILLION,
  effectivePricePerM,
  QUALITY_AXIS,
  QUALITY_FLOOR,
  rankModelsForRole,
  ROLE_CATALOG_CATEGORY,
  catalogSortForRole,
  resolveMaxPricePerMillion,
  scoreModelForRole,
  scoredModelsForRole,
} from './model-scoring';

function perMillion(promptUsd: number, completionUsd: number): OpenRouterModelRecord['pricing'] {
  return {
    prompt: String(promptUsd / 1_000_000),
    completion: String(completionUsd / 1_000_000),
  };
}

function model(partial: Partial<OpenRouterModelRecord> & { id: string }): OpenRouterModelRecord {
  return {
    context_length: 128_000,
    architecture: { modality: 'text' },
    pricing: perMillion(0.3, 1),
    supported_parameters: ['structured_outputs'],
    ...partial,
  };
}

describe('catalog query mapping', () => {
  it('maps social to marketing and weekly to technology, sort matching QUALITY_AXIS', () => {
    expect(ROLE_CATALOG_CATEGORY['social.writer']).toBe('marketing');
    expect(ROLE_CATALOG_CATEGORY['weekly.master_writer']).toBe('technology');
    expect(catalogSortForRole('social.critic')).toBe('intelligence-high-to-low');
    expect(catalogSortForRole('custom_research')).toBe('agentic-high-to-low');
  });
});

describe('scoreModelForRole eligibility', () => {
  it('never scores a :batch variant, however good its quality-per-dollar is', () => {
    const batch = model({
      id: 'openai/gpt-5.6-luna:batch',
      pricing: perMillion(0.1, 0.1),
      benchmarks: { artificial_analysis: { intelligence_index: 60 } },
    });
    expect(scoreModelForRole(batch, 'weekly.master_writer')).toBeNull();
  });

  it('never scores a moving ~alias', () => {
    const alias = model({
      id: '~anthropic/claude-fable-latest',
      pricing: perMillion(10, 50),
      benchmarks: { artificial_analysis: { intelligence_index: 70 } },
    });
    expect(scoreModelForRole(alias, 'social.writer')).toBeNull();
  });

  it('scores a :free model without dividing by zero', () => {
    const free = model({
      id: 'z-ai/glm-5.2:free',
      pricing: perMillion(0, 0),
      benchmarks: { artificial_analysis: { intelligence_index: 52.6 } },
    });
    const row = scoreModelForRole(free, 'social.critic');
    expect(row).not.toBeNull();
    expect(row?.free).toBe(true);
    expect(row?.pricePerM).toBe(0);
    expect(Number.isFinite(row?.score)).toBe(true);
    expect(row?.score).toBe(52.6);
  });

  it('drops a free model that cannot emit JSON', () => {
    const free = model({
      id: 'nvidia/nemotron-3-ultra:free',
      pricing: perMillion(0, 0),
      supported_parameters: ['temperature'],
      benchmarks: { artificial_analysis: { intelligence_index: 38 } },
    });
    expect(scoreModelForRole(free, 'social.writer')).toBeNull();
  });

  it('applies a slightly lower quality floor to free models', () => {
    expect(DEFAULT_FREE_QUALITY_FLOOR_DELTA).toBe(5);
    const borderline = model({
      id: 'vendor/ok:free',
      pricing: perMillion(0, 0),
      benchmarks: { artificial_analysis: { intelligence_index: 26 } },
    });
    // social.critic paid floor is 30; free floor is 25.
    expect(scoreModelForRole(borderline, 'social.critic')).not.toBeNull();
    expect(
      scoreModelForRole(borderline, 'social.critic', { freeQualityFloorDelta: 0 }),
    ).toBeNull();
  });

  it('keeps :batch out of the ranked chain', () => {
    const batch = model({
      id: 'openai/gpt-5.6-luna:batch',
      pricing: perMillion(0.1, 0.1),
      benchmarks: { artificial_analysis: { intelligence_index: 60 } },
    });
    const clean = model({
      id: 'z-ai/glm-5.3-flash',
      pricing: perMillion(0.05, 0.15),
      benchmarks: { artificial_analysis: { intelligence_index: 57.5 } },
    });
    const chain = rankModelsForRole([batch, clean], 'weekly.master_writer');
    expect(chain).not.toContain('openai/gpt-5.6-luna:batch');
    expect(chain[0]).toBe('z-ai/glm-5.3-flash');
  });
});

describe('scoreModelForRole', () => {
  it('a model with intelligence_index 14.2 at $0.01 is not chosen for weekly.master_writer', () => {
    const cheapWeak = model({
      id: 'inclusionai/ling-flash',
      pricing: perMillion(0.01, 0.03),
      benchmarks: { artificial_analysis: { intelligence_index: 14.2 } },
    });
    const editorial = model({
      id: 'vendor/editorial-writer',
      pricing: perMillion(0.3, 1),
      benchmarks: { artificial_analysis: { intelligence_index: 55 } },
    });
    expect(QUALITY_FLOOR['weekly.master_writer']).toBe(40);
    expect(scoreModelForRole(cheapWeak, 'weekly.master_writer')).toBeNull();
    expect(scoreModelForRole(editorial, 'weekly.master_writer')?.quality).toBe(55);
  });

  it('ranks by quality under the ceiling, not by name, so z-ai can lead', () => {
    const terra = model({
      id: 'openai/gpt-audit',
      pricing: perMillion(1, 3),
      benchmarks: { artificial_analysis: { intelligence_index: 56.6 } },
    });
    const glm = model({
      id: 'z-ai/glm-5.3-flash',
      pricing: perMillion(0.05, 0.15),
      benchmarks: { artificial_analysis: { intelligence_index: 57.5 } },
    });
    expect(rankModelsForRole([terra, glm], 'social.critic')[0]).toBe('z-ai/glm-5.3-flash');
  });

  it('drops a social model above the blended ceiling', () => {
    const fable = model({
      id: 'anthropic/claude-fable',
      pricing: perMillion(10, 50),
      benchmarks: { artificial_analysis: { intelligence_index: 70 } },
    });
    expect(scoreModelForRole(fable, 'social.writer', { maxPricePerMillion: 1.5 })).toBeNull();
  });

  it('applies the same 1.5 blended ceiling to weekly and daily by default', () => {
    expect(DEFAULT_MAX_PRICE_PER_MILLION).toBe(1.5);
    expect(resolveMaxPricePerMillion('weekly.master_writer', {})).toBe(1.5);
    expect(resolveMaxPricePerMillion('daily.summarize', {})).toBe(1.5);
    expect(resolveMaxPricePerMillion('custom_research', {})).toBe(1.5);
    const pricey = model({
      id: 'vendor/flagship',
      pricing: perMillion(3, 15),
      benchmarks: { artificial_analysis: { intelligence_index: 80 } },
    });
    expect(scoreModelForRole(pricey, 'weekly.master_writer')).toBeNull();
    expect(scoreModelForRole(pricey, 'daily.summarize')).toBeNull();
  });

  it('honours OPENROUTER_MAX_PRICE_PER_MILLION for non-social roles', () => {
    expect(
      resolveMaxPricePerMillion('weekly.master_writer', { OPENROUTER_MAX_PRICE_PER_MILLION: '2.5' }),
    ).toBe(2.5);
    expect(
      resolveMaxPricePerMillion('social.writer', { SOCIAL_LLM_MAX_PRICE_PER_MILLION: '1.25' }),
    ).toBe(1.25);
  });

  it('keeps one model per family', () => {
    const flash = model({
      id: 'z-ai/glm-5.3-flash',
      pricing: perMillion(0.05, 0.15),
      benchmarks: { artificial_analysis: { intelligence_index: 57.5 } },
    });
    const freeTwin = model({
      id: 'z-ai/glm-5.2:free',
      pricing: perMillion(0, 0),
      benchmarks: { artificial_analysis: { intelligence_index: 52.6 } },
    });
    const other = model({
      id: 'google/gemini-flash',
      pricing: perMillion(0.3, 1),
      benchmarks: { artificial_analysis: { intelligence_index: 56 } },
    });
    expect(rankModelsForRole([flash, freeTwin, other], 'social.writer')).toEqual([
      'z-ai/glm-5.3-flash',
      'google/gemini-flash',
    ]);
  });

  it('reads coding_index independently when intelligence_index is missing', () => {
    const codingOnly = model({
      id: 'vendor/ring-coder',
      benchmarks: { artificial_analysis: { coding_index: 72 } },
    });
    expect(scoreModelForRole(codingOnly, 'weekly.master_writer')).toBeNull();
    expect(QUALITY_AXIS.custom_research).toBe('agentic');
  });

  it('every provider role has an explicit floor -- a 14.2 index model is not chosen for any of them (R1.4 / F4)', () => {
    const cheapWeak = model({
      id: 'inclusionai/ling-flash',
      pricing: perMillion(0.01, 0.03),
      benchmarks: {
        artificial_analysis: { intelligence_index: 14.2, coding_index: 14.2, agentic_index: 14.2 },
      },
    });
    for (const role of Object.keys(QUALITY_FLOOR) as (keyof typeof QUALITY_FLOOR)[]) {
      expect(QUALITY_FLOOR[role]).toBeGreaterThan(14.2);
      expect(scoreModelForRole(cheapWeak, role)).toBeNull();
    }
  });

  it('unbenchmarked models never lead and never fill a family tail', () => {
    const scoredLead = model({
      id: 'vendor/rated-writer',
      benchmarks: { artificial_analysis: { intelligence_index: 50 } },
    });
    const unrated = model({ id: 'deepseek/deepseek-family' });
    const chain = rankModelsForRole([unrated, scoredLead], 'weekly.master_writer');
    expect(chain).toEqual(['vendor/rated-writer']);
  });

  it('uses the image-critic token mix when pricing completion vs prompt', () => {
    const vision = model({
      id: 'vendor/vision-critic',
      pricing: perMillion(1, 10),
      benchmarks: { artificial_analysis: { intelligence_index: 50 } },
    });
    const writerPrice = effectivePricePerM(vision, 'weekly.master_writer', 0);
    const criticPrice = effectivePricePerM(vision, 'weekly.image_critic', 0);
    expect(writerPrice).toBeCloseTo(1 * 0.2 + 10 * 0.8);
    expect(criticPrice).toBeCloseTo(1 * 0.8 + 10 * 0.2);
    expect(criticPrice ?? 0).toBeLessThan(writerPrice ?? 0);
  });

  it('folds the measured cache-hit rate into the prompt side of the blend', () => {
    const cached = model({
      id: 'vendor/cached',
      pricing: {
        prompt: String(1 / 1_000_000),
        completion: String(3 / 1_000_000),
        input_cache_read: String(0.1 / 1_000_000),
      },
      benchmarks: { artificial_analysis: { intelligence_index: 50 } },
    });
    const sticker = effectivePricePerM(cached, 'social.writer', 0);
    const honest = effectivePricePerM(cached, 'social.writer', DEFAULT_CACHE_HIT_RATE);
    expect(sticker).toBeCloseTo(1 * 0.9 + 3 * 0.1);
    expect(honest ?? 0).toBeLessThan(sticker ?? 0);
    expect(honest).toBeCloseTo(
      (1 * (1 - DEFAULT_CACHE_HIT_RATE) + 0.1 * DEFAULT_CACHE_HIT_RATE) * 0.9 + 3 * 0.1,
    );
  });

  it('honours excludeIds and excludeFamilies', () => {
    const a = model({
      id: 'z-ai/glm-5.3-flash',
      pricing: perMillion(0.05, 0.15),
      benchmarks: { artificial_analysis: { intelligence_index: 57.5 } },
    });
    const b = model({
      id: 'google/gemini-flash',
      pricing: perMillion(0.3, 1),
      benchmarks: { artificial_analysis: { intelligence_index: 56 } },
    });
    expect(
      rankModelsForRole([a, b], 'social.writer', { excludeFamilies: ['z-ai'] }),
    ).toEqual(['google/gemini-flash']);
    expect(rankModelsForRole([a, b], 'social.writer', { excludeIds: [a.id] })).toEqual([
      'google/gemini-flash',
    ]);
  });

  it('scoredModelsForRole lists higher quality first at equal family', () => {
    const catalog = [50, 60, 45, 80].map((quality, index) =>
      model({
        id: `other-${index}/writer`,
        pricing: perMillion(0.3, 1),
        benchmarks: { artificial_analysis: { intelligence_index: quality } },
      }),
    );
    const scored = scoredModelsForRole(catalog, 'weekly.master_writer');
    expect(scored.map((row) => row.id)).toEqual([
      'other-3/writer',
      'other-1/writer',
      'other-0/writer',
      'other-2/writer',
    ]);
  });
});
