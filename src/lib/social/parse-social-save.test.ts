import { describe, expect, it } from 'vitest';
import { parseChannelSocialSave } from './parse-social-save';

describe('parseChannelSocialSave', () => {
  it('keeps X root and self-reply aligned with content_parts', () => {
    const parsed = parseChannelSocialSave({
      channel: 'x',
      postText: 'Root thesis for builders.',
      firstComment: 'Read: https://aitodaybrief.com/r/s/token',
      threadParts: [],
      existingCarousel: null,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.fields.contentParts).toEqual([
      'Root thesis for builders.',
      'Read: https://aitodaybrief.com/r/s/token',
    ]);
    expect(parsed.fields.firstComment).toContain('aitodaybrief.com');
  });

  it('derives Threads post_text from the first of 3–5 parts', () => {
    const parsed = parseChannelSocialSave({
      channel: 'threads',
      postText: '',
      firstComment: '',
      threadParts: ['One grounded part about evals.', 'Two', 'Three with a question?'],
      existingCarousel: null,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.fields.postText).toBe('One grounded part about evals.');
    expect(parsed.fields.contentParts).toHaveLength(3);
  });
});
