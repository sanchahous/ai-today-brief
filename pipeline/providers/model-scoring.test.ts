import { describe, expect, it } from 'vitest';
import type { OpenRouterModelRecord } from '../openrouter-models';
import {
  effectivePricePerM,
  QUALITY_AXIS,
  QUALITY_FLOOR,
  rankModelsForRole,
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
    pricing: perMillion(1, 3),
    ...partial,
  };
}

describe('scoreModelForRole', () => {
  it('a model with intelligence_index 14.2 at $0.01 is not chosen for weekly.master_writer', () => {
    const cheapWeak = model({
      id: 'inclusionai/ling-flash',
      pricing: perMillion(0.01, 0.03),
      benchmarks: { artificial_analysis: { intelligence_index: 14.2 } },
    });
    const editorial = model({
      id: 'vendor/editorial-writer',
      pricing: perMillion(0.5, 2),
      benchmarks: { artificial_analysis: { intelligence_index: 55 } },
    });
    const alsoGood = model({
      id: 'vendor/second-writer',
      pricing: perMillion(0.8, 3),
      benchmarks: { artificial_analysis: { intelligence_index: 48 } },
    });
    const third = model({
      id: 'vendor/third-writer',
      pricing: perMillion(1, 4),
      benchmarks: { artificial_analysis: { intelligence_index: 44 } },
    });

    expect(QUALITY_FLOOR['weekly.master_writer']).toBe(40);
    expect(scoreModelForRole(cheapWeak, 'weekly.master_writer')).toBeNull();
    expect(scoreModelForRole(editorial, 'weekly.master_writer')?.quality).toBe(55);

    const chain = rankModelsForRole(
      [cheapWeak, editorial, alsoGood, third],
      'weekly.master_writer',
      () => ['inclusionai/ling-flash', 'vendor/editorial-writer'],
    );
    expect(chain.slice(0, 3)).toEqual([
      'vendor/editorial-writer',
      'vendor/second-writer',
      'vendor/third-writer',
    ]);
    expect(chain).not.toContain('inclusionai/ling-flash');
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

  it('returns a chain of top-3 scored models, not a single winner', () => {
    const catalog = [50, 60, 45, 80].map((quality, index) =>
      model({
        id: `vendor/writer-${index}`,
        pricing: perMillion(1, 3),
        benchmarks: { artificial_analysis: { intelligence_index: quality } },
      }),
    );
    const scored = scoredModelsForRole(catalog, 'weekly.master_writer');
    expect(scored).toHaveLength(4);
    expect(rankModelsForRole(catalog, 'weekly.master_writer', () => []).slice(0, 3)).toEqual([
      'vendor/writer-3',
      'vendor/writer-1',
      'vendor/writer-0',
    ]);
  });

  it('keeps unbenchmarked models on the family-fallback tail, not first', () => {
    const scoredLead = model({
      id: 'vendor/rated-writer',
      benchmarks: { artificial_analysis: { intelligence_index: 50 } },
    });
    const unrated = model({ id: 'deepseek/deepseek-family' });
    const chain = rankModelsForRole([unrated, scoredLead], 'weekly.master_writer', (catalog) =>
      catalog.map((row) => row.id),
    );
    expect(chain[0]).toBe('vendor/rated-writer');
    expect(chain.slice(1)).toContain('deepseek/deepseek-family');
  });

  it('uses the image-critic token mix when pricing completion vs prompt', () => {
    const vision = model({
      id: 'vendor/vision-critic',
      pricing: perMillion(1, 10),
      benchmarks: { artificial_analysis: { intelligence_index: 50 } },
    });
    const writerPrice = effectivePricePerM(vision, 'weekly.master_writer');
    const criticPrice = effectivePricePerM(vision, 'weekly.image_critic');
    expect(writerPrice).toBeCloseTo(1 * 0.2 + 10 * 0.8);
    expect(criticPrice).toBeCloseTo(1 * 0.8 + 10 * 0.2);
    expect(criticPrice ?? 0).toBeLessThan(writerPrice ?? 0);
  });
});
