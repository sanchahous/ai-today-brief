import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import {
  buildDeepWorkPromptsV10,
  deterministicGeometryV10,
  ownerReworkTreatmentV10,
  renderOwnerReworkSvgV10,
  validateDeterministicGeometryV10,
  type OwnerReworkKindV10,
} from './visual-owner-rework-v10';

const deterministicKinds: Array<
  Exclude<OwnerReworkKindV10, 'deep_work_bounded_hint'>
> = [
  'gemini_consistency',
  'claude_threshold_controls',
  'token_caching',
  'fuzz_repair_loop',
  'optical_context_compression',
];

describe('owner-directed visual rework v10', () => {
  it.each(deterministicKinds)(
    '%s has connected deterministic arrows and valid semantic nodes',
    (kind) => {
      const geometry = deterministicGeometryV10(kind);
      expect(geometry.nodes.length).toBeGreaterThanOrEqual(3);
      expect(geometry.arrows.length).toBeGreaterThanOrEqual(2);
      expect(validateDeterministicGeometryV10(kind)).toEqual([]);
    },
  );

  it.each(deterministicKinds)(
    '%s renders pixel-only and final SVGs without generated typography',
    (kind) => {
      const pixels = renderOwnerReworkSvgV10({
        kind,
        includeLabels: false,
      }).toString('utf8');
      const final = renderOwnerReworkSvgV10({
        kind,
        includeLabels: true,
      }).toString('utf8');
      const treatment = ownerReworkTreatmentV10(kind);

      expect(pixels).toContain('<svg');
      expect(pixels).not.toContain(treatment.labels[0]!);
      expect(final).toContain(treatment.labels[0]!);
      expect(treatment.labels.length).toBeLessThanOrEqual(3);
      expect(treatment.imageCalls).toBe(0);
    },
  );

  it('uses one shared model chamber for the Gemini consistency treatment', () => {
    const svg = renderOwnerReworkSvgV10({
      kind: 'gemini_consistency',
      includeLabels: false,
    }).toString('utf8');
    const treatment = ownerReworkTreatmentV10('gemini_consistency');

    expect(treatment.forbiddenImplications).toContain('two different models');
    expect(svg.match(/v10-metal/g)?.length).toBeGreaterThanOrEqual(2);
    expect(deterministicGeometryV10('gemini_consistency').nodes.map((node) => node.id)).toEqual([
      'task',
      'model',
      'run-a',
      'run-b',
    ]);
  });

  it('keeps the token-caching repair at the geometry level', () => {
    const treatment = ownerReworkTreatmentV10('token_caching');
    const geometry = deterministicGeometryV10('token_caching');

    expect(treatment.coreClaim).toMatch(/caching avoids repeatedly processing/i);
    expect(geometry.arrows.map((value) => value.id)).toEqual([
      'repeated-cache',
      'cache-reuse',
    ]);
    expect(validateDeterministicGeometryV10('token_caching')).toEqual([]);
  });

  it('connects the optical lens to the compressed artifact and shows preserved data', () => {
    const svg = renderOwnerReworkSvgV10({
      kind: 'optical_context_compression',
      includeLabels: false,
    }).toString('utf8');

    expect(svg).toContain('v10-lens-clip');
    expect(svg).toContain('line x1=');
    expect(svg.match(/<rect/g)?.length).toBeGreaterThan(50);
    expect(
      ownerReworkTreatmentV10('optical_context_compression').expectedEvidence.join(' '),
    ).toMatch(/magnifier visibly reveals dense preserved information/i);
  });

  it('forces the Deep Work prompts to close anatomy and beam causality', () => {
    const story: HoldoutStoryInput = {
      week_start: '2026-06-22',
      week_end: '2026-06-28',
      rank: 4,
      revision_item_id: 'deep-work',
      title: 'Managing AI-Driven Distraction and Rediscovering Deep Work',
      summary:
        'Use AI as a bounded sparring partner while the person stays actively engaged in difficult reasoning.',
      why: null,
      practical: null,
      takeaway: null,
    };
    const prompts = buildDeepWorkPromptsV10(story);

    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      expect(prompt).toContain('Exactly two human hands');
      expect(prompt).toContain('fully visible on the left side');
      expect(prompt).toContain('begins at the visible projector lens');
      expect(prompt).toContain('ends on exactly one small component');
      expect(prompt).toContain('No text, letters, numbers');
      expect(prompt).toContain('disembodied hand');
    }
  });
});
