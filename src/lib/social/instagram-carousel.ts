import { containsServiceMarkers } from './service-markers';

export const INSTAGRAM_CAROUSEL_SLIDE_KINDS = [
  'cover',
  'story',
  'story',
  'story',
  'comparison',
  'caveat',
  'takeaway',
] as const;

export type InstagramCarouselSlideKind = (typeof INSTAGRAM_CAROUSEL_SLIDE_KINDS)[number];

type CoverSlide = { kind: 'cover'; headline: string };
type StorySlide = {
  kind: 'story';
  revisionItemId: string;
  headline: string;
  body: string;
};
type InfoSlide = {
  kind: 'comparison' | 'caveat' | 'takeaway';
  headline: string;
  body: string;
};

export type InstagramCarouselSlide = CoverSlide | StorySlide | InfoSlide;

export type InstagramCarouselSpec = {
  version: 1;
  angle: string;
  hookCandidates: [string, string, string];
  caption: string;
  slides: [
    CoverSlide,
    StorySlide,
    StorySlide,
    StorySlide,
    InfoSlide & { kind: 'comparison' },
    InfoSlide & { kind: 'caveat' },
    InfoSlide & { kind: 'takeaway' },
  ];
};

export type InstagramCarouselIssue = {
  code: string;
  message: string;
};

const URL_RE = /https?:\/\/[^\s)\]}]+/i;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;

function trimText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function hashtagCount(value: string) {
  return value.match(HASHTAG_RE)?.length ?? 0;
}

export function instagramCarouselIssues(
  spec: InstagramCarouselSpec,
  currentRevisionItemIds: Iterable<string>,
): InstagramCarouselIssue[] {
  const issues: InstagramCarouselIssue[] = [];
  if (spec.version !== 1) {
    issues.push({ code: 'instagram_spec_version', message: 'Instagram carousel spec must be version 1.' });
  }
  if (spec.slides.length !== 7) {
    issues.push({
      code: 'instagram_slides',
      message: 'Instagram requires exactly seven slides in the hybrid carousel.',
    });
  }
  for (let index = 0; index < Math.min(spec.slides.length, 7); index += 1) {
    const expected = INSTAGRAM_CAROUSEL_SLIDE_KINDS[index];
    if (spec.slides[index]?.kind !== expected) {
      issues.push({
        code: 'instagram_slide_order',
        message: `Slide ${index + 1} must be ${expected}.`,
      });
    }
  }
  const cover = spec.slides[0];
  if (cover?.kind === 'cover' && cover.headline.trim().length > 72) {
    issues.push({
      code: 'instagram_cover_headline',
      message: 'The cover headline must be at most 72 characters.',
    });
  }
  const storyIds: string[] = [];
  for (let index = 1; index < spec.slides.length; index += 1) {
    const slide = spec.slides[index];
    if (!slide) continue;
    if (slide.headline.trim().length > 54) {
      issues.push({
        code: 'instagram_headline',
        message: `Slide ${index + 1} headline must be at most 54 characters.`,
      });
    }
    if ('body' in slide && slide.body.trim().length > 120) {
      issues.push({
        code: 'instagram_body',
        message: `Slide ${index + 1} body must be at most 120 characters.`,
      });
    }
    if (slide.kind === 'story') {
      storyIds.push(slide.revisionItemId);
    }
  }
  const uniqueStoryIds = new Set(storyIds);
  if (storyIds.length !== 3 || uniqueStoryIds.size !== 3) {
    issues.push({
      code: 'instagram_story_ids',
      message: 'The three story slides must point at three different revision items.',
    });
  }
  const current = new Set(currentRevisionItemIds);
  for (const id of uniqueStoryIds) {
    if (!current.has(id)) {
      issues.push({
        code: 'instagram_story_revision',
        message: 'A story slide points at a revision item that is not on the current digest.',
      });
    }
  }
  const caption = spec.caption.trim();
  if (caption.length < 180 || caption.length > 800) {
    issues.push({
      code: 'instagram_caption_length',
      message: `Instagram caption must contain 180–800 characters; found ${caption.length}.`,
    });
  }
  if (URL_RE.test(caption)) {
    issues.push({
      code: 'instagram_caption_url',
      message: 'Instagram caption must be link-free.',
    });
  }
  if (hashtagCount(caption) > 5) {
    issues.push({
      code: 'instagram_caption_hashtags',
      message: 'Use at most five hashtags in the Instagram caption.',
    });
  }
  if (containsServiceMarkers(caption) || spec.slides.some((slide) => containsServiceMarkers(slide.headline) || ('body' in slide && containsServiceMarkers(slide.body)))) {
    issues.push({
      code: 'instagram_service_markers',
      message: 'Instagram copy cannot contain <PART>, <SLIDE>, or <CAPTION> markers.',
    });
  }
  return issues;
}

export function readableInstagramParts(spec: InstagramCarouselSpec): string[] {
  return spec.slides.map((slide) =>
    slide.kind === 'cover' ? trimText(slide.headline) : trimText(`${slide.headline}\n${slide.body}`),
  );
}

export function parseInstagramCarouselSpec(value: unknown): InstagramCarouselSpec | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || typeof row.angle !== 'string' || typeof row.caption !== 'string') {
    return null;
  }
  if (
    !Array.isArray(row.hookCandidates) ||
    row.hookCandidates.length !== 3 ||
    row.hookCandidates.some((candidate) => typeof candidate !== 'string')
  ) {
    return null;
  }
  if (!Array.isArray(row.slides) || row.slides.length !== 7) return null;
  const slides = row.slides.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const slide = entry as Record<string, unknown>;
    const kind = INSTAGRAM_CAROUSEL_SLIDE_KINDS[index];
    if (slide.kind !== kind || typeof slide.headline !== 'string') return null;
    if (kind === 'cover') return { kind, headline: slide.headline.trim() };
    if (typeof slide.body !== 'string') return null;
    if (kind === 'story') {
      if (typeof slide.revisionItemId !== 'string' || !slide.revisionItemId.trim()) return null;
      return {
        kind,
        revisionItemId: slide.revisionItemId.trim(),
        headline: slide.headline.trim(),
        body: slide.body.trim(),
      };
    }
    return { kind, headline: slide.headline.trim(), body: slide.body.trim() };
  });
  if (slides.some((slide) => slide === null)) return null;
  return {
    version: 1,
    angle: row.angle.trim(),
    hookCandidates: row.hookCandidates.map((candidate) => candidate.trim()) as [
      string,
      string,
      string,
    ],
    caption: row.caption.trim(),
    slides: slides as InstagramCarouselSpec['slides'],
  };
}

type ParsedWriterSlides = {
  coverHeadline: string;
  stories: [{ headline: string; body: string }, { headline: string; body: string }, { headline: string; body: string }];
  comparison: { headline: string; body: string };
  caveat: { headline: string; body: string };
  takeaway: { headline: string; body: string };
  caption: string;
};

function splitHeadlineBody(value: string) {
  const [headline = '', ...rest] = value.split(/\s*\|\|\s*/);
  return { headline: trimText(headline), body: trimText(rest.join(' ')) };
}

export function parseInstagramWriterCandidate(candidate: string): ParsedWriterSlides | null {
  const captionSplit = candidate.split(/\s*<CAPTION>\s*/i);
  if (captionSplit.length !== 2) return null;
  const caption = trimText(captionSplit[1] ?? '');
  const body = captionSplit[0] ?? '';
  const cover = body.split(/\s*<COVER>\s*/i)[1];
  if (cover === undefined) return null;
  const afterCover = cover.split(/\s*<STORY>\s*/i);
  if (afterCover.length !== 4) return null;
  const coverHeadline = trimText(afterCover[0] ?? '');
  const storyOne = splitHeadlineBody(afterCover[1] ?? '');
  const storyTwo = splitHeadlineBody(afterCover[2] ?? '');
  const rest = (afterCover[3] ?? '').split(/\s*<COMPARISON>\s*/i);
  if (rest.length !== 2) return null;
  const storyThree = splitHeadlineBody(rest[0] ?? '');
  const afterComparison = rest[1]?.split(/\s*<CAVEAT>\s*/i) ?? [];
  if (afterComparison.length !== 2) return null;
  const comparison = splitHeadlineBody(afterComparison[0] ?? '');
  const afterCaveat = afterComparison[1]?.split(/\s*<TAKEAWAY>\s*/i) ?? [];
  if (afterCaveat.length !== 2) return null;
  const caveat = splitHeadlineBody(afterCaveat[0] ?? '');
  const takeaway = splitHeadlineBody(afterCaveat[1] ?? '');
  if (!coverHeadline || !caption) return null;
  if (![storyOne, storyTwo, storyThree, comparison, caveat, takeaway].every((part) => part.headline && part.body)) {
    return null;
  }
  return {
    coverHeadline,
    stories: [storyOne, storyTwo, storyThree],
    comparison,
    caveat,
    takeaway,
    caption,
  };
}

export function assembleInstagramCarouselSpec(input: {
  angle: string;
  hookCandidates: [string, string, string];
  parsed: ParsedWriterSlides;
  storyRevisionItemIds: [string, string, string];
}): InstagramCarouselSpec {
  return {
    version: 1,
    angle: input.angle.trim(),
    hookCandidates: input.hookCandidates,
    caption: input.parsed.caption,
    slides: [
      { kind: 'cover', headline: input.parsed.coverHeadline },
      {
        kind: 'story',
        revisionItemId: input.storyRevisionItemIds[0],
        headline: input.parsed.stories[0].headline,
        body: input.parsed.stories[0].body,
      },
      {
        kind: 'story',
        revisionItemId: input.storyRevisionItemIds[1],
        headline: input.parsed.stories[1].headline,
        body: input.parsed.stories[1].body,
      },
      {
        kind: 'story',
        revisionItemId: input.storyRevisionItemIds[2],
        headline: input.parsed.stories[2].headline,
        body: input.parsed.stories[2].body,
      },
      { kind: 'comparison', headline: input.parsed.comparison.headline, body: input.parsed.comparison.body },
      { kind: 'caveat', headline: input.parsed.caveat.headline, body: input.parsed.caveat.body },
      { kind: 'takeaway', headline: input.parsed.takeaway.headline, body: input.parsed.takeaway.body },
    ],
  };
}

export function instagramSpecAuditText(spec: InstagramCarouselSpec) {
  return [
    `CAPTION\n${spec.caption}`,
    `ANGLE\n${spec.angle}`,
    ...spec.slides.map((slide, index) => {
      if (slide.kind === 'cover') return `SLIDE ${index + 1} COVER\n${slide.headline}`;
      if (slide.kind === 'story') {
        return `SLIDE ${index + 1} STORY ${slide.revisionItemId}\n${slide.headline}\n${slide.body}`;
      }
      return `SLIDE ${index + 1} ${slide.kind.toUpperCase()}\n${slide.headline}\n${slide.body}`;
    }),
  ].join('\n\n');
}
