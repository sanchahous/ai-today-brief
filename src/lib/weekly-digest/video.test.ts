import { describe, expect, it } from 'vitest';
import {
  isValidYouTubeVideo,
  normalizeYouTubeVideo,
  parseYouTubeVideoId,
  validateWeeklyVideoResultManifest,
} from './video';

const VIDEO_ID = 'dQw4w9WgXcQ';

describe('Weekly Digest YouTube validation', () => {
  it.each([
    VIDEO_ID,
    `https://youtu.be/${VIDEO_ID}?si=abc`,
    `https://www.youtube.com/watch?v=${VIDEO_ID}&feature=share`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
  ])('extracts a canonical ID from %s', (value) => {
    expect(parseYouTubeVideoId(value)).toBe(VIDEO_ID);
  });

  it.each([
    '',
    'short',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=too-short',
  ])('rejects invalid or spoofed input %s', (value) => {
    expect(isValidYouTubeVideo(value)).toBe(false);
  });

  it('normalizes watch, privacy-enhanced embed, and thumbnail URLs', () => {
    expect(normalizeYouTubeVideo(`https://youtu.be/${VIDEO_ID}`)).toEqual({
      videoId: VIDEO_ID,
      watchUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
    });
  });

  it('accepts a result only for the approved digest, revision and input hash', () => {
    const expected = {
      digestId: '11111111-1111-4111-8111-111111111111',
      revisionId: '22222222-2222-4222-8222-222222222222',
      inputHash: 'a'.repeat(64),
    };
    const manifest = {
      schemaVersion: 'weekly-video-result-v2',
      ...expected,
      youtube: {
        id: VIDEO_ID,
        url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
        durationSeconds: 420,
        publishedAt: '2026-08-01T20:00:00.000Z',
      },
      captions: [
        { locale: 'en', url: 'https://cdn.example/captions-en.vtt' },
        { locale: 'uk', vtt: 'WEBVTT\n\n00:00.000 --> 00:01.000\nТекст' },
      ],
    };
    expect(validateWeeklyVideoResultManifest(manifest, expected).inputHash).toBe(
      expected.inputHash,
    );
    expect(() =>
      validateWeeklyVideoResultManifest(
        { ...manifest, revisionId: '99999999-9999-4999-8999-999999999999' },
        expected,
      ),
    ).toThrow(/does not match/i);
  });
});
