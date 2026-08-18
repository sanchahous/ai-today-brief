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
});
