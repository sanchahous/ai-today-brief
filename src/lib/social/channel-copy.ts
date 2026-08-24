import type { SocialChannel } from './types';
import {
  dailyVisualInstagramAuditText,
  type DailyVisualInstagramCarouselSpec,
} from './daily-visual-carousel';
import { instagramSpecAuditText, type InstagramCarouselSpec } from './instagram-carousel';

type InstagramSocialSpec = InstagramCarouselSpec | DailyVisualInstagramCarouselSpec;

function isDailyVisualInstagramSpec(
  value: InstagramSocialSpec,
): value is DailyVisualInstagramCarouselSpec {
  return 'kind' in value && value.kind === 'daily_visual';
}

export function channelNativeCopy(input: {
  channel: SocialChannel;
  text: string;
  contentParts?: string[];
  firstComment?: string | null;
  instagramCarousel?: InstagramSocialSpec | null;
}) {
  if (input.channel === 'instagram') {
    if (input.instagramCarousel) {
      return isDailyVisualInstagramSpec(input.instagramCarousel)
        ? dailyVisualInstagramAuditText(input.instagramCarousel)
        : instagramSpecAuditText(input.instagramCarousel);
    }
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
