import { describe, expect, it } from 'vitest';
import { socialContentHash } from './content-hash';

const content = {
  channel: 'x' as const,
  locale: 'en' as const,
  format: 'link_free_hook',
  text: 'An approved AI update for builders.',
  firstComment: 'Read: https://aitodaybrief.com/r/s/token',
  assets: [],
  scheduledFor: '2027-01-01T10:00:00.000Z',
  contentVersion: 1,
};

describe('social content hash', () => {
  it('is stable for exact content', () => {
    expect(socialContentHash(content)).toBe(socialContentHash({ ...content }));
  });

  it('changes for copy, schedule, or version edits', () => {
    const original = socialContentHash(content);
    expect(socialContentHash({ ...content, text: `${content.text} Updated.` })).not.toBe(original);
    expect(socialContentHash({ ...content, scheduledFor: '2027-01-01T11:00:00.000Z' })).not.toBe(
      original,
    );
    expect(socialContentHash({ ...content, contentVersion: 2 })).not.toBe(original);
  });
});
