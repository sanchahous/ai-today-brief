import { describe, expect, it } from 'vitest';
import { isValidYouTubeVideo, normalizeYouTubeVideo, parseYouTubeVideoId } from './video';

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
});
