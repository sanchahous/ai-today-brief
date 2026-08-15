import { describe, expect, it } from 'vitest';
import type { OpenRouterModelRecord } from '../openrouter-models';
import { PROVIDER_ROLES } from './registry';
import {
  QUALITY_DROP_BLOCK,
  RANK_APPLY_ROLE,
  latestAuditsByRole,
  planOpenRouterRerank,
  qualityDropBlocked,
} from './model-rerank';

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

function editorialCatalog(): OpenRouterModelRecord[] {
  return [
    model({
      id: 'vendor/editorial-writer',
      pricing: perMillion(0.5, 2),
      benchmarks: {
        artificial_analysis: { intelligence_index: 55, agentic_index: 50 },
      },
    }),
    model({
      id: 'vendor/second-writer',
      pricing: perMillion(0.8, 3),
      benchmarks: { artificial_analysis: { intelligence_index: 48 } },
    }),
    model({
      id: 'vendor/third-writer',
      pricing: perMillion(1, 4),
      benchmarks: { artificial_analysis: { intelligence_index: 44 } },
    }),
    model({
      id: 'vendor/cheap-weak',
      pricing: perMillion(0.01, 0.03),
      benchmarks: { artificial_analysis: { intelligence_index: 14.2 } },
    }),
  ];
}

describe('planOpenRouterRerank', () => {
  it('does not apply a cheaper winner when quality drops below the current pick', () => {
    const cheaper = model({
      id: 'vendor/cheaper-ok',
      pricing: perMillion(0.05, 0.15),
      benchmarks: { artificial_analysis: { intelligence_index: 42 } },
    });
    const plan = planOpenRouterRerank({
      catalog: [...editorialCatalog(), cheaper],
      currentApply: { modelId: 'vendor/editorial-writer', qualityIndex: 55 },
    });

    const writer = plan.audits.find((row) => row.role === RANK_APPLY_ROLE);
    expect(QUALITY_DROP_BLOCK).toBe(5);
    expect(writer?.modelId).toBe('vendor/cheaper-ok');
    expect(writer?.qualityIndex).toBe(42);
    expect(writer?.applied).toBe(false);
    expect(writer?.skipReason).toBe('quality_drop');
    expect(writer?.previousModelId).toBe('vendor/editorial-writer');
    expect(writer?.previousQualityIndex).toBe(55);
    expect(plan.apply).toBe(false);
    expect(plan.openRouterModelIds).toEqual([]);
  });

  it('writes an audit row per role with score price and quality', () => {
    const plan = planOpenRouterRerank({
      catalog: editorialCatalog(),
      currentApply: null,
    });

    expect(plan.audits.map((row) => row.role)).toEqual([...PROVIDER_ROLES]);
    const writer = plan.audits.find((row) => row.role === RANK_APPLY_ROLE);
    expect(writer?.modelId).toBe('vendor/editorial-writer');
    expect(writer?.score).toBeGreaterThan(0);
    expect(writer?.pricePerM).toBeGreaterThan(0);
    expect(writer?.qualityIndex).toBe(55);
    expect(writer?.applied).toBe(true);
    expect(plan.apply).toBe(true);
    expect(plan.openRouterModelIds).toEqual([
      'vendor/editorial-writer',
      'vendor/second-writer',
      'vendor/third-writer',
    ]);

    const withNumbers = plan.audits.filter((row) => row.axis === 'intelligence');
    for (const row of withNumbers) {
      expect(row.score).toBeGreaterThan(0);
      expect(row.pricePerM).toBeGreaterThan(0);
      expect(row.qualityIndex).toBeGreaterThan(0);
    }
  });

  it('applies when the quality drop is within the block threshold', () => {
    const near = model({
      id: 'vendor/near-current',
      pricing: perMillion(0.4, 1.6),
      benchmarks: { artificial_analysis: { intelligence_index: 51 } },
    });
    const plan = planOpenRouterRerank({
      catalog: [near, ...editorialCatalog()],
      currentApply: { modelId: 'vendor/editorial-writer', qualityIndex: 55 },
    });
    expect(qualityDropBlocked(55, 51)).toBe(false);
    expect(plan.apply).toBe(true);
    expect(plan.openRouterModelIds[0]).toBe('vendor/near-current');
  });
});

describe('latestAuditsByRole', () => {
  it('keeps the first row per role (newest-first input)', () => {
    const latest = latestAuditsByRole([
      { role: 'weekly.master_writer', modelId: 'new' },
      { role: 'daily.summarize', modelId: 'sum' },
      { role: 'weekly.master_writer', modelId: 'old' },
    ]);
    expect(latest.get('weekly.master_writer')?.modelId).toBe('new');
    expect(latest.get('daily.summarize')?.modelId).toBe('sum');
  });
});
