import { describe, expect, it, vi } from 'vitest';
import {
  adviceForPostUploadQa,
  contentSimClearedFromPostUploadQa,
  formatPostUploadQaLine,
  ignorePostUploadQa,
  parsePostUploadQa,
  postUploadQaNeedsWarning,
  type PostUploadQa,
} from './post-upload-qa';
import { reviewUploadedImage } from './run-post-upload-qa';

const failedQa: PostUploadQa = {
  blockers: [
    { code: 'readable_text', message: 'Letters on a sign', region: 'left', blocker: true },
    { code: 'readable_text', message: 'Logo on a device', region: 'right', blocker: true },
  ],
  scores: { no_text: 20, overall: 40 },
  model: 'test-vision',
  cost_usd: 0.0005,
  checked_at: '2026-08-15T12:00:00.000Z',
};

describe('post-upload QA presentation', () => {
  it('formats baked text as the owner-facing warning line', () => {
    expect(formatPostUploadQaLine(failedQa)).toBe('QA: впечений текст (2 місця)');
    expect(postUploadQaNeedsWarning(failedQa)).toBe(true);
    expect(formatPostUploadQaLine(ignorePostUploadQa(failedQa))).toBe('QA: проігноровано');
    expect(postUploadQaNeedsWarning(ignorePostUploadQa(failedQa))).toBe(false);
    expect(formatPostUploadQaLine({ ...failedQa, blockers: [] })).toBe('QA чисто');
  });

  it('human dignity QA warns and advises switching concept', () => {
    const qa = {
      ...failedQa,
      blockers: [
        {
          code: 'human_dignity_risk',
          message: 'A machine grips a child by the head',
          blocker: true,
        },
      ],
    };
    expect(formatPostUploadQaLine(qa)).toBe('QA: ризик гідності');
    expect(postUploadQaNeedsWarning(qa)).toBe(true);
    expect(adviceForPostUploadQa(qa)).toEqual([
      expect.objectContaining({
        kind: 'false_thesis',
        do: 'Уточни primary direction і перегенеруй кадр.',
      }),
    ]);
  });

  it('baked text QA advises inpaint not a full regenerate', () => {
    const advice = adviceForPostUploadQa(failedQa);
    expect(advice).toEqual([
      expect.objectContaining({
        kind: 'baked_text',
        dont: 'Не перегенеровуй кадр.',
      }),
    ]);
    expect(advice[0]?.do.toLowerCase()).toMatch(/inpaint|crop/);
    expect(advice[0]?.do.toLowerCase()).not.toMatch(/перегенеру/);
  });

  it('broken geometry QA advises rebuilding with the same prompt', () => {
    const advice = adviceForPostUploadQa({
      ...failedQa,
      blockers: [
        {
          code: 'melted_motion',
          message: 'Arrow fused into the box',
          blocker: true,
        },
      ],
    });
    expect(advice).toEqual([
      expect.objectContaining({
        kind: 'broken_geometry',
        do: 'Перезбери композицію тим самим промптом.',
        dont: 'Не міняй концепт.',
      }),
    ]);
  });

  it('false thesis QA advises switching concept not patching labels', () => {
    const advice = adviceForPostUploadQa({
      ...failedQa,
      blockers: [
        {
          code: 'off_metaphor',
          message: 'Pixels argue a different claim',
          blocker: true,
        },
      ],
    });
    expect(advice).toEqual([
      expect.objectContaining({
        kind: 'false_thesis',
        do: 'Уточни primary direction і перегенеруй кадр.',
        dont: 'Не патч лейблами.',
      }),
    ]);
  });

  it('ignored or pending QA does not attach repair advice', () => {
    expect(adviceForPostUploadQa(ignorePostUploadQa(failedQa))).toEqual([]);
    expect(adviceForPostUploadQa({ ...failedQa, pending: true, checked_at: null })).toEqual([]);
  });

  it('parses pending and completed metadata', () => {
    expect(parsePostUploadQa({ source: 'manual_upload' })).toBeNull();
    expect(parsePostUploadQa({ post_upload_qa: { pending: true } })?.pending).toBe(true);
    expect(parsePostUploadQa({ post_upload_qa: failedQa })?.blockers).toHaveLength(2);
  });

  it('never maps a failed upload QA onto content-sim preflight', () => {
    expect(contentSimClearedFromPostUploadQa(failedQa)).toBeUndefined();
    expect(contentSimClearedFromPostUploadQa(null)).toBeUndefined();
  });
});

describe('reviewUploadedImage', () => {
  it('stores critic blockers without requiring a headline', async () => {
    const generateVision = vi.fn(async (role: string, input: { prompt: string }) => {
      expect(role).toBe('weekly.image_critic');
      expect(input.prompt).not.toMatch(/Headline:/);
      expect(input.prompt).not.toMatch(/SOURCE STORY/);
      expect(input.prompt).not.toMatch(/Scene brief:/);
      return {
        text: JSON.stringify({
          overall: 40,
          dimensions: { no_text: 20, craft: 70, brand_safe: 80, news_legibility: 50 },
          blockers: [{ code: 'readable_text', message: 'Caption on a screen', region: 'centre' }],
          notes: 'baked letters',
        }),
        provider: 'gemini',
        model: 'test-vision',
        usage: { costUsd: 0.0005, costSource: 'reported', promptTokens: 10, completionTokens: 10 },
      };
    });
    const qa = await reviewUploadedImage({
      bytes: Buffer.from('fake-jpeg'),
      generateVision: generateVision as never,
      now: '2026-08-15T12:00:00.000Z',
    });
    expect(qa.blockers).toEqual([
      expect.objectContaining({ code: 'readable_text', blocker: true }),
    ]);
    expect(qa.model).toBe('test-vision');
    expect(qa.cost_usd).toBe(0.0005);
    expect(qa).not.toHaveProperty('repair');
    expect(qa).not.toHaveProperty('prompt_patches');
  });

  it('runs a second, story-aware pass for a clean primary illustration', async () => {
    const generateVision = vi.fn(async (_role: string, input: { prompt: string }) => {
      if (input.prompt.includes('pixel defects only')) {
        return {
          text: JSON.stringify({
            overall: 92,
            dimensions: { no_text: 96, craft: 89, brand_safe: 92, news_legibility: 90 },
            blockers: [],
            notes: 'clean pixels',
          }),
          provider: 'gemini',
          model: 'pixel-vision',
          usage: {
            costUsd: 0.0005,
            costSource: 'reported',
            promptTokens: 10,
            completionTokens: 10,
          },
        };
      }
      expect(input.prompt).toContain('SOURCE STORY (authority):');
      expect(input.prompt).toContain('PrivAiTe removes credentials');
      expect(input.prompt).toContain('Mechanism that must be visible:');
      expect(input.prompt).toContain('The proxy does not catch every credential pattern.');
      return {
        text: JSON.stringify({
          overall: 90,
          dimensions: {
            no_text: 96,
            craft: 89,
            brand_safe: 92,
            news_legibility: 88,
            context_fidelity: 86,
            mechanism_legibility: 87,
            consequence_legibility: 86,
            instant_comprehension: 85,
          },
          blockers: [],
          pixel_evidence: {
            context: 'local gateway next to the developer machine',
            mechanism: 'private fields are held back by the gateway',
            consequence: 'one clean request exits the gateway',
            headline_pairing: 'the credential filter is visible before the outbound request',
          },
          notes: 'the causal chain is legible',
        }),
        provider: 'gemini',
        model: 'story-vision',
        usage: { costUsd: 0.0005, costSource: 'reported', promptTokens: 10, completionTokens: 10 },
      };
    });

    const qa = await reviewUploadedImage({
      bytes: Buffer.from('fake-jpeg'),
      generateVision: generateVision as never,
      now: '2026-08-15T12:00:00.000Z',
      storyContext: {
        headline: 'PrivAiTe removes credentials before model requests leave a developer machine',
        summary: 'A local proxy strips personal data and account details from API traffic.',
        mechanism: 'The gateway separates private fields from the outgoing request.',
        consequence: 'The provider receives one clean request without the private credentials.',
        limitation: 'The proxy does not catch every credential pattern.',
        visualThesis: 'A local filter visibly separates secrets from one clean request.',
        policyId: 'weekly-semantic-story-v6',
      },
    });

    expect(generateVision).toHaveBeenCalledTimes(2);
    expect(qa.story_checked).toBe(true);
    expect(qa.blockers).toEqual([]);
    expect(qa.cost_usd).toBe(0.001);
    expect(qa.model).toBe('pixel-vision → story-vision');
    expect(formatPostUploadQaLine(qa)).toBe('QA чисто · зміст зчитується');
  });

  it('turns a low semantic score without a model blocker into an owner warning', async () => {
    let call = 0;
    const generateVision = vi.fn(async () => {
      call += 1;
      const imageOnly = call === 1;
      return {
        text: JSON.stringify(
          imageOnly
            ? {
                overall: 92,
                dimensions: { no_text: 96, craft: 89, brand_safe: 92, news_legibility: 90 },
                blockers: [],
              }
            : {
                overall: 92,
                dimensions: {
                  no_text: 96,
                  craft: 89,
                  brand_safe: 92,
                  news_legibility: 90,
                  context_fidelity: 88,
                  mechanism_legibility: 48,
                  consequence_legibility: 86,
                  instant_comprehension: 70,
                },
                blockers: [],
                pixel_evidence: {
                  context: 'a machine',
                  mechanism: 'a vague glowing flow',
                  consequence: 'a finished request',
                  headline_pairing: 'not specific enough',
                },
              },
        ),
        provider: 'gemini',
        model: 'test-vision',
        usage: { costUsd: 0.0005, costSource: 'reported', promptTokens: 10, completionTokens: 10 },
      };
    });

    const qa = await reviewUploadedImage({
      bytes: Buffer.from('fake-jpeg'),
      generateVision: generateVision as never,
      storyContext: {
        headline: 'A source-specific AI story',
        summary: 'One exact mechanism changes the result.',
        policyId: 'weekly-semantic-story-v6',
      },
    });

    expect(qa.blockers).toEqual([
      expect.objectContaining({ code: 'ambiguous_visual_story', blocker: true }),
    ]);
    expect(adviceForPostUploadQa(qa)).toEqual([expect.objectContaining({ kind: 'false_thesis' })]);
  });

  it('records a story-aware critic outage as an error instead of a clean semantic pass', async () => {
    let call = 0;
    const generateVision = vi.fn(async () => {
      call += 1;
      if (call === 2) throw new Error('story critic unavailable');
      return {
        text: JSON.stringify({
          overall: 92,
          dimensions: { no_text: 96, craft: 89, brand_safe: 92, news_legibility: 90 },
          blockers: [],
        }),
        provider: 'gemini',
        model: 'pixel-vision',
        usage: { costUsd: 0.0005, costSource: 'reported', promptTokens: 10, completionTokens: 10 },
      };
    });

    const qa = await reviewUploadedImage({
      bytes: Buffer.from('fake-jpeg'),
      generateVision: generateVision as never,
      storyContext: {
        headline: 'A story that requires semantic QA',
        policyId: 'weekly-semantic-story-v6',
      },
    });

    expect(qa.story_checked).toBe(false);
    expect(qa.error).toMatch(/Story-aware QA unavailable/i);
    expect(formatPostUploadQaLine(qa)).toBe('QA: перевірку не вдалось завершити');
  });
});
