import { describe, expect, it } from 'vitest';
import { renderSpecializedVisualSvgV72 } from './visual-specialized-svg-v7-2';
import type { VisualTreatmentDecisionV72 } from './visual-treatment-v7-2';

function treatment(
  value: VisualTreatmentDecisionV72['treatment'],
  labels: string[],
): VisualTreatmentDecisionV72 {
  return {
    treatment: value,
    reason: 'test',
    selectedSource: 'compiler',
    expectedImageCalls: 0,
    approvedLabels: labels,
    safetyMode: value.startsWith('reported_')
      ? 'reported_signal'
      : 'factual_visual',
  };
}

describe('Visual Compiler v7.2 specialized SVGs', () => {
  it('renders repeated-run variability without asserting definitive failure', () => {
    const svg = renderSpecializedVisualSvgV72({
      treatment: treatment('reported_consistency_signal', [
        'COMMUNITY REPORTS',
        'INCONSISTENT RESULTS',
        'CROSS-PROVIDER TEST',
      ]),
      includeOverlays: true,
    }).toString('utf8');
    expect(svg).toContain('reported-consistency-signal');
    expect(svg).toContain('COMMUNITY REPORTS');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).not.toContain('CONFIRMED FAILURE');
  });

  it('renders a dashed uncertain usage boundary with no numeric threshold', () => {
    const svg = renderSpecializedVisualSvgV72({
      treatment: treatment('reported_usage_signal', [
        'HIGH TOKEN BURN',
        'REPORTED SIGNALS',
        'MONITOR SPEND',
      ]),
      includeOverlays: true,
    }).toString('utf8');
    expect(svg).toContain('reported-usage-signal');
    expect(svg).toContain('REPORTED SIGNALS');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).not.toMatch(/\b\d+%\b/);
  });

  it('renders a biology-specific reasoning flow instead of generic tool icons', () => {
    const svg = renderSpecializedVisualSvgV72({
      treatment: treatment('science_reasoning_flow', [
        'GPT-5',
        'BIOLOGICAL DATA',
        'T-CELL HYPOTHESIS',
      ]),
      includeOverlays: true,
    }).toString('utf8');
    expect(svg).toContain('science-reasoning-flow');
    expect(svg).toContain('BIOLOGICAL DATA');
    expect(svg).toContain('T-CELL HYPOTHESIS');
    expect(svg).toContain('M495 240C555 270');
  });

  it('can omit labels for a pixel-only semantic gate', () => {
    const svg = renderSpecializedVisualSvgV72({
      treatment: treatment('science_reasoning_flow', [
        'GPT-5',
        'BIOLOGICAL DATA',
        'T-CELL HYPOTHESIS',
      ]),
      includeOverlays: false,
    }).toString('utf8');
    expect(svg).not.toContain('T-CELL HYPOTHESIS');
    expect(svg).toContain('science-reasoning-flow');
  });
});
