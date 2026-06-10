import { describe, expect, it } from 'vitest';
import { formatCustomNewsError, parseCustomCommand } from './telegram-custom';

describe('formatCustomNewsError', () => {
  it('explains missing GEMINI_API_KEY for Vercel', () => {
    const text = formatCustomNewsError(new Error('[config] Missing required env vars: GEMINI_API_KEY'));
    expect(text).toContain('GEMINI_API_KEY');
    expect(text).toContain('Vercel');
  });
});

describe('parseCustomCommand', () => {
  it('parses topic-only command', () => {
    expect(parseCustomCommand('/custom NVIDIA Nemotron 3 Ultra')).toEqual({
      topic: 'NVIDIA Nemotron 3 Ultra',
    });
  });

  it('strips bot mention suffix', () => {
    expect(parseCustomCommand('/custom@AITodayBriefBot Some story')).toEqual({
      topic: 'Some story',
    });
  });

  it('parses url + topic', () => {
    expect(
      parseCustomCommand('/custom https://developer.nvidia.com/blog/x Nemotron release'),
    ).toEqual({
      topic: 'Nemotron release',
      url: 'https://developer.nvidia.com/blog/x',
    });
  });

  it('returns null for empty body', () => {
    expect(parseCustomCommand('/custom')).toBeNull();
    expect(parseCustomCommand('/custom   ')).toBeNull();
  });

  it('uses url alone as topic when no title follows', () => {
    expect(parseCustomCommand('/custom https://example.com/post')).toEqual({
      topic: 'https://example.com/post',
      url: 'https://example.com/post',
    });
  });
});
