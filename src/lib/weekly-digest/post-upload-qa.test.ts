import { describe, expect, it, vi } from 'vitest';
import {
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
  });
});
