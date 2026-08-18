import { parseThreadsParts } from './hook-candidate';
import {
  parseInstagramCarouselSpec,
  type InstagramCarouselSpec,
} from './instagram-carousel';
import { containsServiceMarkers, serviceMarkerIssueMessage } from './service-markers';
import type { SocialChannel } from './types';

export type SocialSaveFields = {
  postText: string;
  firstComment: string | null;
  contentParts: string[];
  instagramCarousel: InstagramCarouselSpec | null;
};

export type SocialSaveParseResult =
  | { ok: true; fields: SocialSaveFields }
  | { ok: false; message: string };

function visibleTexts(fields: SocialSaveFields) {
  return [fields.postText, fields.firstComment ?? '', ...fields.contentParts];
}

export function parseChannelSocialSave(input: {
  channel: SocialChannel;
  postText: string;
  firstComment: string;
  threadParts: string[];
  existingCarousel: unknown;
  existingParts?: string[];
}): SocialSaveParseResult {
  if (input.channel === 'threads') {
    const parts = input.threadParts.map((part) => part.trim()).filter(Boolean);
    if (parts.length < 3 || parts.length > 5) {
      return { ok: false, message: 'Threads requires 3–5 non-empty parts.' };
    }
    if (parts.some((part) => part.length > 500)) {
      return { ok: false, message: 'Every Threads part must be at most 500 characters.' };
    }
    const fields: SocialSaveFields = {
      postText: parts[0],
      firstComment: null,
      contentParts: parts,
      instagramCarousel: null,
    };
    if (visibleTexts(fields).some((value) => containsServiceMarkers(value))) {
      return { ok: false, message: serviceMarkerIssueMessage() };
    }
    return { ok: true, fields };
  }

  if (input.channel === 'x') {
    const root = input.postText.trim();
    const reply = input.firstComment.trim();
    const fields: SocialSaveFields = {
      postText: root,
      firstComment: reply || null,
      contentParts: [root, reply].filter(Boolean),
      instagramCarousel: null,
    };
    if (visibleTexts(fields).some((value) => containsServiceMarkers(value))) {
      return { ok: false, message: serviceMarkerIssueMessage() };
    }
    return { ok: true, fields };
  }

  if (input.channel === 'instagram') {
    const caption = input.postText.trim();
    const spec = parseInstagramCarouselSpec(input.existingCarousel);
    const nextSpec = spec ? { ...spec, caption } : null;
    const fields: SocialSaveFields = {
      postText: caption,
      firstComment: null,
      contentParts: nextSpec
        ? nextSpec.slides.map((slide) =>
            slide.kind === 'cover' ? slide.headline : `${slide.headline}\n${slide.body}`,
          )
        : (input.existingParts ?? []).map((part) => part.trim()).filter(Boolean),
      instagramCarousel: nextSpec,
    };
    if (containsServiceMarkers(caption)) {
      return { ok: false, message: serviceMarkerIssueMessage() };
    }
    return { ok: true, fields };
  }

  const fields: SocialSaveFields = {
    postText: input.postText.trim(),
    firstComment: null,
    contentParts: [],
    instagramCarousel: null,
  };
  if (containsServiceMarkers(fields.postText)) {
    return { ok: false, message: serviceMarkerIssueMessage() };
  }
  return { ok: true, fields };
}

export { parseThreadsParts };
