import { describe, expect, it } from 'vitest';
import { contentSimMaxImageRepairAttempts, CONTENT_SIM_DEFAULTS } from './config';
import { deterministicImageCritique } from './deterministic-image';
import { buildEscalationPackage, contentSimGateCleared, toContentSimArtifactMeta } from './escalation';
import { runRepairLoop } from './loop';
import { buildImageCriticPrompt, clampOverallByNewsLegibility, extractJsonObject, newsLegibilityThreshold, parseImageCriticResponse } from './vision-critic';
import type { ContentSimCritique } from './types';

describe('content-sim config', () => {
  it('defaults max image repair attempts to 5', () => {
    expect(CONTENT_SIM_DEFAULTS.maxImageRepairAttempts).toBe(5);
    expect(contentSimMaxImageRepairAttempts()).toBeGreaterThanOrEqual(1);
  });
});

describe('deterministicImageCritique', () => {
  it('returns null for a healthy 16:9 frame', () => {
    expect(
      deterministicImageCritique({ width: 1600, height: 900, byteSize: 120_000 }),
    ).toBeNull();
  });

  it('flags tiny frames without calling vision', () => {
    const critique = deterministicImageCritique({ width: 100, height: 100, byteSize: 50 });
    expect(critique?.passed).toBe(false);
    expect(critique?.blockers.some((b) => b.code === 'image_dimensions')).toBe(true);
  });
});

describe('news legibility helpers', () => {
  it('floors news threshold at 75', () => {
    expect(newsLegibilityThreshold(60)).toBe(75);
    expect(newsLegibilityThreshold(90)).toBe(90);
  });

  it('clamps overall to news_legibility + 5', () => {
    expect(clampOverallByNewsLegibility(100, 60)).toBe(65);
    expect(clampOverallByNewsLegibility(70, 80)).toBe(70);
  });
});

describe('extractJsonObject', () => {
  it('parses fenced JSON and recovers from trailing noise', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('note\n{"a":2}\ntrailing')).toEqual({ a: 2 });
  });

  it('returns null when no object is present', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
  });
});

describe('parseImageCriticResponse', () => {
  it('passes when overall meets threshold and no blockers', () => {
    const critique = parseImageCriticResponse(
      JSON.stringify({
        overall: 88,
        dimensions: {
          metaphor_fit: 90,
          no_text: 95,
          craft: 85,
          brand_safe: 90,
          news_legibility: 88,
        },
        blockers: [],
        notes: 'ok',
      }),
      80,
    );
    expect(critique.passed).toBe(true);
    expect(critique.scores.overall).toBe(88);
    expect(critique.scores.news_legibility).toBe(88);
  });

  it('clamps overall by news_legibility and fails low news', () => {
    const critique = parseImageCriticResponse(
      JSON.stringify({
        overall: 100,
        dimensions: {
          metaphor_fit: 100,
          no_text: 100,
          craft: 100,
          brand_safe: 100,
          news_legibility: 60,
        },
        blockers: [],
        notes: 'pretty but off',
      }),
      80,
    );
    expect(critique.scores.overall).toBe(65);
    expect(critique.passed).toBe(false);
  });

  it('parses off_news and melted_motion blockers', () => {
    const critique = parseImageCriticResponse(
      JSON.stringify({
        overall: 92,
        dimensions: {
          metaphor_fit: 90,
          no_text: 95,
          craft: 95,
          brand_safe: 90,
          news_legibility: 40,
        },
        blockers: [
          { code: 'off_news', message: 'Could be any tech story', region: 'full' },
          { code: 'melted_motion', message: 'Smeared shuttles', region: 'center' },
        ],
      }),
      80,
    );
    expect(critique.passed).toBe(false);
    expect(critique.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining(['off_news', 'melted_motion']),
    );
  });

  it('soft-fails when the critic returns prose instead of JSON', () => {
    const critique = parseImageCriticResponse(
      'I looked at the image and it seems fine, overall ninety.',
      80,
    );
    expect(critique.passed).toBe(false);
    expect(critique.blockers.some((b) => b.code === 'critic_parse_error')).toBe(true);
    expect(critique.repairDirective?.changeSeed).toBe(true);
  });

  it('fails on readable_text even with high score', () => {
    const critique = parseImageCriticResponse(
      `\`\`\`json
      {"overall":95,"dimensions":{},"blockers":[{"code":"readable_text","message":"UI menu","region":"left"}],"repair":{"change_seed":true,"prompt_patches":["no text"],"suggested_actions":["Remove UI"]}}
      \`\`\``,
      80,
    );
    expect(critique.passed).toBe(false);
    expect(critique.repairDirective?.promptPatches?.[0]).toContain('no text');
  });

  it('parses physics and decorative-beat blocker codes', () => {
    const critique = parseImageCriticResponse(
      JSON.stringify({
        overall: 70,
        dimensions: {},
        blockers: [
          {
            code: 'impossible_orientation',
            message: 'Journal is upside-down relative to the reader',
            region: 'center',
          },
          {
            code: 'decorative_second_beat',
            message: 'Ballerinas do not argue the essence',
            region: 'right',
          },
          {
            code: 'prop_use_mismatch',
            message: 'Grip on the ledger is impossible',
            region: 'hands',
          },
          {
            code: 'sibling_echo',
            message: 'Same golem motif as sibling story',
            region: 'full',
          },
        ],
      }),
      80,
    );
    expect(critique.passed).toBe(false);
    expect(critique.blockers.map((b) => b.code)).toEqual([
      'impossible_orientation',
      'decorative_second_beat',
      'prop_use_mismatch',
      'sibling_echo',
    ]);
  });
});

describe('runRepairLoop', () => {
  it('converges when the second attempt passes', async () => {
    let n = 0;
    const { report, artifact } = await runRepairLoop<{ id: number }>({
      adapter: 'weekly-image',
      maxAttempts: 5,
      maxSpendUsd: 10,
      generate: async ({ attempt }) => ({
        artifact: { id: attempt },
        promptSummary: `prompt-${attempt}`,
        costUsd: 0.05,
      }),
      critique: async () => {
        n += 1;
        if (n === 1) {
          return {
            passed: false,
            scores: { overall: 40 },
            blockers: [{ code: 'off_metaphor', message: 'wrong subject', blocker: true }],
            repairDirective: { changeSeed: true, suggestedActions: ['Retarget metaphor'] },
          } satisfies ContentSimCritique;
        }
        return {
          passed: true,
          scores: { overall: 90 },
          blockers: [],
        } satisfies ContentSimCritique;
      },
    });
    expect(report.passed).toBe(true);
    expect(report.attempts).toBe(2);
    expect(artifact?.id).toBe(2);
    expect(report.outcome).toBe('passed');
  });

  it('escalates after max attempts', async () => {
    const { report } = await runRepairLoop<{ id: number }>({
      adapter: 'weekly-image',
      maxAttempts: 3,
      maxSpendUsd: 10,
      generate: async ({ attempt }) => ({ artifact: { id: attempt }, costUsd: 0.01 }),
      critique: async () => ({
        passed: false,
        scores: { overall: 10 },
        blockers: [{ code: 'low_quality', message: 'blurry', blocker: true }],
        repairDirective: { changeSeed: true, suggestedActions: ['Retry seed'] },
      }),
    });
    expect(report.passed).toBe(false);
    expect(report.outcome).toBe('needs_human_review');
    expect(report.attempts).toBe(3);
    expect(report.escalation?.suggestedActions.length).toBeGreaterThan(0);
  });

  it('uses deterministic fail without calling critique', async () => {
    let critiqueCalls = 0;
    const { report } = await runRepairLoop<{ id: number }>({
      adapter: 'weekly-image',
      maxAttempts: 1,
      maxSpendUsd: 10,
      generate: async () => ({ artifact: { id: 1 } }),
      deterministicCritique: () => ({
        passed: false,
        scores: { overall: 20 },
        blockers: [{ code: 'image_dimensions', message: 'too small', blocker: true }],
      }),
      critique: async () => {
        critiqueCalls += 1;
        return { passed: true, scores: { overall: 99 }, blockers: [] };
      },
    });
    expect(critiqueCalls).toBe(0);
    expect(report.outcome).toBe('needs_human_review');
  });

  it('stops early on budget', async () => {
    const { report } = await runRepairLoop<{ id: number }>({
      adapter: 'weekly-image',
      maxAttempts: 5,
      maxSpendUsd: 0.03,
      generate: async ({ attempt }) => ({ artifact: { id: attempt }, costUsd: 0.04 }),
      critique: async () => ({
        passed: false,
        scores: { overall: 10 },
        blockers: [{ code: 'low_quality', message: 'nope', blocker: true }],
      }),
    });
    expect(report.outcome).toBe('budget_exhausted');
    expect(report.attempts).toBe(1);
  });
});

describe('escalation helpers', () => {
  it('clears the gate on human override', () => {
    const escalation = buildEscalationPackage({
      reason: 'attempts_exhausted',
      iterations: [
        {
          attempt: 1,
          critique: {
            passed: false,
            scores: { overall: 10 },
            blockers: [{ code: 'x', message: 'y', blocker: true }],
            repairDirective: { suggestedActions: ['Fix metaphor'] },
          },
        },
      ],
    });
    const meta = toContentSimArtifactMeta({
      adapter: 'weekly-image',
      outcome: 'needs_human_review',
      passed: false,
      attempts: 5,
      maxAttempts: 5,
      blockers: escalation.blockers,
      escalation,
      totalCostUsd: 0.2,
    });
    expect(contentSimGateCleared(meta)).toBe(false);
    const overridden = toContentSimArtifactMeta(
      {
        adapter: 'weekly-image',
        outcome: 'needs_human_review',
        passed: false,
        attempts: 5,
        maxAttempts: 5,
        blockers: escalation.blockers,
        escalation,
        totalCostUsd: 0.2,
      },
      { note: 'Looks fine editorially' },
    );
    expect(contentSimGateCleared(overridden)).toBe(true);
    expect(overridden.human_override).toBe(true);
  });
});

describe('buildImageCriticPrompt', () => {
  it('includes headline and threshold', () => {
    const prompt = buildImageCriticPrompt({ headline: 'OpenAI ships X', scoreThreshold: 80 });
    expect(prompt).toContain('OpenAI ships X');
    expect(prompt).toContain('80');
  });

  it('includes physics codes, mechanism, and sibling scenes', () => {
    const prompt = buildImageCriticPrompt({
      headline: 'Agents burn energy',
      essence: 'Invisible wattage from agentic loops',
      mechanism: 'agentic coding loops that burn energy',
      readerTest: 'grasp: agentic work costs far more wattage than chat',
      whyItFits: 'tiny orb vs furnace',
      siblingScenes: ['clay golem guarding a sealed journal'],
      scoreThreshold: 80,
    });
    expect(prompt).toContain('impossible_orientation');
    expect(prompt).toContain('decorative_second_beat');
    expect(prompt).toContain('off_news');
    expect(prompt).toContain('melted_motion');
    expect(prompt).toContain('news_legibility');
    expect(prompt).toContain('clay golem');
    expect(prompt).toContain('Invisible wattage');
    expect(prompt).toContain('agentic coding loops');
  });
});
