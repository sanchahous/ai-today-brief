import { describe, expect, it } from 'vitest';
import type { OpenRouterModelRecord } from '../openrouter-models';
import { PROVIDER_ROLES } from './registry';
import {
  QUALITY_DROP_BLOCK,
  RANK_APPLY_ROLE,
  latestAuditsByRole,
  planOpenRouterRerank,
  qualityDropBlocked,
  rerankApplyEnabled,
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
    pricing: perMillion(0.3, 1),
    ...partial,
  };
}

function editorialCatalog(): OpenRouterModelRecord[] {
  return [
    model({
      id: 'vendor-a/editorial-writer',
      pricing: perMillion(0.3, 1),
      benchmarks: {
        artificial_analysis: { intelligence_index: 55, agentic_index: 50 },
      },
    }),
    model({
      id: 'vendor-b/second-writer',
      pricing: perMillion(0.4, 1.2),
      benchmarks: { artificial_analysis: { intelligence_index: 48 } },
    }),
    model({
      id: 'vendor-c/third-writer',
      pricing: perMillion(0.5, 1.4),
      benchmarks: { artificial_analysis: { intelligence_index: 44 } },
    }),
    model({
      id: 'vendor-d/cheap-weak',
      pricing: perMillion(0.01, 0.03),
      benchmarks: { artificial_analysis: { intelligence_index: 14.2 } },
    }),
  ];
}

describe('planOpenRouterRerank', () => {
  it('does not apply a winner when quality drops below the current pick', () => {
    const onlyLower = model({
      id: 'vendor-e/lower-ok',
      pricing: perMillion(0.05, 0.15),
      benchmarks: { artificial_analysis: { intelligence_index: 42 } },
    });
    const plan = planOpenRouterRerank({
      catalog: [onlyLower],
      currentApply: { modelId: 'vendor-a/editorial-writer', qualityIndex: 55 },
    });

    const writer = plan.audits.find((row) => row.role === RANK_APPLY_ROLE);
    expect(QUALITY_DROP_BLOCK).toBe(5);
    expect(writer?.modelId).toBe('vendor-e/lower-ok');
    expect(writer?.qualityIndex).toBe(42);
    expect(writer?.applied).toBe(false);
    expect(writer?.skipReason).toBe('quality_drop');
    expect(writer?.previousModelId).toBe('vendor-a/editorial-writer');
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
    expect(writer?.modelId).toBe('vendor-a/editorial-writer');
    expect(writer?.score).toBeGreaterThan(0);
    expect(writer?.pricePerM).toBeGreaterThan(0);
    expect(writer?.qualityIndex).toBe(55);
    expect(writer?.applied).toBe(true);
    expect(plan.apply).toBe(true);
    expect(plan.openRouterModelIds).toEqual([
      'vendor-a/editorial-writer',
      'vendor-b/second-writer',
      'vendor-c/third-writer',
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
      id: 'vendor-e/near-current',
      pricing: perMillion(0.4, 1.6),
      benchmarks: { artificial_analysis: { intelligence_index: 51 } },
    });
    const plan = planOpenRouterRerank({
      catalog: [near],
      currentApply: { modelId: 'vendor-a/editorial-writer', qualityIndex: 55 },
    });
    expect(qualityDropBlocked(55, 51)).toBe(false);
    expect(plan.apply).toBe(true);
    expect(plan.openRouterModelIds[0]).toBe('vendor-e/near-current');
  });

  it('does not pad the queue with unbenchmarked family-tail ids', () => {
    const extras = Array.from({ length: 6 }, (_, i) =>
      model({ id: `extra-${i}/model`, pricing: perMillion(2, 6) }),
    );
    const plan = planOpenRouterRerank({
      catalog: [...editorialCatalog(), ...extras],
      currentApply: null,
      queueCap: 20,
    });
    expect(plan.apply).toBe(true);
    expect(plan.openRouterModelIds).toEqual([
      'vendor-a/editorial-writer',
      'vendor-b/second-writer',
      'vendor-c/third-writer',
    ]);
    for (const extra of extras) {
      expect(plan.openRouterModelIds).not.toContain(extra.id);
    }
    expect(plan.openRouterModelIds).not.toContain('vendor-d/cheap-weak');
  });

  it('truncates the applied queue to the attempt cap', () => {
    const extras = Array.from({ length: 8 }, (_, i) =>
      model({
        id: `extra-${i}/writer`,
        pricing: perMillion(0.3, 1),
        benchmarks: { artificial_analysis: { intelligence_index: 41 + i } },
      }),
    );
    const plan = planOpenRouterRerank({
      catalog: [...editorialCatalog(), ...extras],
      currentApply: null,
      queueCap: 6,
    });
    expect(plan.openRouterModelIds).toHaveLength(6);
    expect(plan.openRouterModelIds[0]).toBe('vendor-a/editorial-writer');
  });

  it('records the winner without claiming it was applied when the kill-switch is off', () => {
    const plan = planOpenRouterRerank({
      catalog: editorialCatalog(),
      currentApply: null,
      applyEnabled: false,
    });
    const writer = plan.audits.find((row) => row.role === 'weekly.master_writer');
    expect(writer?.modelId).toBe('vendor-a/editorial-writer');
    expect(writer?.applied).toBe(false);
    expect(writer?.skipReason).toBe('apply_disabled');
    expect(plan.apply).toBe(false);
    expect(plan.openRouterModelIds).toEqual([]);
  });

  it("never lets a disabled run become the next run's quality baseline", () => {
    const disabled = planOpenRouterRerank({
      catalog: editorialCatalog(),
      currentApply: null,
      applyEnabled: false,
    });
    expect(disabled.audits.some((row) => row.applied)).toBe(false);
  });
});

describe('rerankApplyEnabled', () => {
  it('is enabled by default and only "off" (case/whitespace-insensitive) disables it', () => {
    expect(rerankApplyEnabled(undefined)).toBe(true);
    expect(rerankApplyEnabled('')).toBe(true);
    expect(rerankApplyEnabled('on')).toBe(true);
    expect(rerankApplyEnabled('off')).toBe(false);
    expect(rerankApplyEnabled('OFF')).toBe(false);
    expect(rerankApplyEnabled('  off  ')).toBe(false);
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
