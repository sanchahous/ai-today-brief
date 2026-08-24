import { describe, expect, it } from 'vitest';
import { channelNativeCopy } from './channel-copy';

describe('channelNativeCopy', () => {
  it('sends Threads parts and the X reply to the critic', () => {
    expect(
      channelNativeCopy({
        channel: 'threads',
        text: 'ignored',
        contentParts: ['One', 'Two', 'Three?'],
      }),
    ).toBe('One\n\nTwo\n\nThree?');
    expect(
      channelNativeCopy({
        channel: 'x',
        text: 'Root',
        firstComment: 'Read: https://aitodaybrief.com/r/s/token',
      }),
    ).toContain('SELF REPLY');
  });

  it('keeps the five deterministic daily carousel slides visible to the critic', () => {
    const value = channelNativeCopy({
      channel: 'instagram',
      text: 'caption',
      instagramCarousel: {
        kind: 'daily_visual',
        version: 1,
        caption:
          'A grounded daily AI briefing with enough approved context to explain the practical shift before the next technical decision. Save it for later. #AI',
        slides: [
          { kind: 'cover', headline: 'Daily title', body: 'Daily thesis' },
          { kind: 'story', storyId: 'story-1', headline: 'Story', body: 'Approved change' },
          { kind: 'thesis', headline: 'Why', body: 'Approved consequence' },
          { kind: 'thesis', headline: 'Context', body: 'Approved context' },
          { kind: 'cta', headline: 'Read more', body: 'Follow AI Today Brief' },
        ],
      },
    });
    expect(value).toContain('SLIDE 1 COVER');
    expect(value).toContain('SLIDE 5 CTA');
  });
});
