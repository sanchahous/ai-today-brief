import type { SocialChannel } from './types';
import {
  instagramSpecAuditText,
  type InstagramCarouselSpec,
} from './instagram-carousel';

export function channelNativeCopy(input: {
  channel: SocialChannel;
  text: string;
  contentParts?: string[];
  firstComment?: string | null;
  instagramCarousel?: InstagramCarouselSpec | null;
}) {
  if (input.channel === 'instagram') {
    if (input.instagramCarousel) return instagramSpecAuditText(input.instagramCarousel);
    return [
      ...(input.contentParts ?? []).map((part) => `SLIDE\n${part}`),
      `CAPTION\n${input.text}`,
    ].join('\n\n');
  }
  if (input.channel === 'threads') {
    return (input.contentParts ?? []).join('\n\n');
  }
  if (input.channel === 'x') {
    return `ROOT POST\n${input.text}\n\nSELF REPLY\n${input.firstComment ?? ''}`;
  }
  return input.text;
}
