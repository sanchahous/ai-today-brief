import { containsServiceMarkers } from './service-markers';

export const DAILY_VISUAL_INSTAGRAM_SLIDE_KINDS = ['cover', 'story', 'thesis', 'cta'] as const;

export type DailyVisualInstagramSlideKind = (typeof DAILY_VISUAL_INSTAGRAM_SLIDE_KINDS)[number];

export type DailyVisualInstagramCoverSlide = {
  kind: 'cover';
  headline: string;
  /**
   * Intentionally optional. Slide 1 is the deterministic display-title slide:
   * it may carry one verified source stat, but never a generated explanation
   * that competes with the image before a reader has oriented themselves.
   */
  body?: string | null;
};

export type DailyVisualInstagramStorySlide = {
  kind: 'story';
  storyId: string;
  headline: string;
  body: string;
};

export type DailyVisualInstagramThesisSlide = {
  kind: 'thesis';
  headline: string;
  body: string;
};

export type DailyVisualInstagramCtaSlide = {
  kind: 'cta';
  headline: string;
  body: string;
};

export type DailyVisualInstagramInsightSlide =
  DailyVisualInstagramStorySlide | DailyVisualInstagramThesisSlide;

/**
 * A compact daily carousel deliberately has five slides. It is separate from
 * the seven-slide weekly contract: daily is a single visual thesis, not a
 * mini-weekly roundup.
 */
export type DailyVisualInstagramCarouselSpec = {
  kind: 'daily_visual';
  version: 1;
  caption: string;
  slides: [
    DailyVisualInstagramCoverSlide,
    DailyVisualInstagramInsightSlide,
    DailyVisualInstagramInsightSlide,
    DailyVisualInstagramInsightSlide,
    DailyVisualInstagramCtaSlide,
  ];
};

export type DailyVisualInstagramCarouselIssue = {
  code: string;
  message: string;
};

const URL_RE = /https?:\/\/[^\s)\]}]+/i;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function slideHasServiceMarkers(
  slide:
    | DailyVisualInstagramCoverSlide
    | DailyVisualInstagramInsightSlide
    | DailyVisualInstagramCtaSlide,
) {
  return containsServiceMarkers(slide.headline) || containsServiceMarkers(slide.body ?? '');
}

function validInsightSlide(slide: DailyVisualInstagramInsightSlide) {
  return slide.kind === 'story'
    ? Boolean(clean(slide.storyId) && clean(slide.headline) && clean(slide.body))
    : Boolean(clean(slide.headline) && clean(slide.body));
}

export function dailyVisualInstagramCarouselIssues(
  spec: DailyVisualInstagramCarouselSpec,
): DailyVisualInstagramCarouselIssue[] {
  const issues: DailyVisualInstagramCarouselIssue[] = [];
  if (spec.kind !== 'daily_visual' || spec.version !== 1) {
    issues.push({
      code: 'daily_instagram_spec_version',
      message: 'Daily Instagram carousel spec must be daily_visual version 1.',
    });
  }
  if (spec.slides.length !== 5) {
    issues.push({
      code: 'daily_instagram_slides',
      message: 'Daily Instagram carousel requires exactly five slides.',
    });
    return issues;
  }
  const [cover, first, second, third, cta] = spec.slides;
  if (cover.kind !== 'cover' || !clean(cover.headline)) {
    issues.push({
      code: 'daily_instagram_cover',
      message: 'Slide 1 must contain the readable deterministic daily display title.',
    });
  }
  if (![first, second, third].every(validInsightSlide)) {
    issues.push({
      code: 'daily_instagram_insights',
      message: 'Slides 2–4 must contain approved story or thesis context.',
    });
  }
  if (cta.kind !== 'cta' || !clean(cta.headline) || !clean(cta.body)) {
    issues.push({
      code: 'daily_instagram_cta',
      message: 'Slide 5 must contain a clear daily-brief CTA.',
    });
  }

  const caption = clean(spec.caption);
  if (caption.length < 180 || caption.length > 2200) {
    issues.push({
      code: 'daily_instagram_caption_length',
      message: `Daily Instagram caption must contain 180–2200 characters; found ${caption.length}.`,
    });
  }
  if (URL_RE.test(caption)) {
    issues.push({
      code: 'daily_instagram_caption_url',
      message: 'Daily Instagram caption must be link-free.',
    });
  }
  if ((caption.match(HASHTAG_RE) ?? []).length > 5) {
    issues.push({
      code: 'daily_instagram_caption_hashtags',
      message: 'Use at most five hashtags in the daily Instagram caption.',
    });
  }
  if (containsServiceMarkers(caption) || spec.slides.some(slideHasServiceMarkers)) {
    issues.push({
      code: 'daily_instagram_service_markers',
      message: 'Daily Instagram copy cannot contain internal service markers.',
    });
  }
  return issues;
}

export function readableDailyVisualInstagramParts(
  spec: DailyVisualInstagramCarouselSpec,
): string[] {
  return spec.slides.map((slide) => clean(`${slide.headline}\n${slide.body ?? ''}`));
}

export function dailyVisualInstagramAuditText(spec: DailyVisualInstagramCarouselSpec) {
  return [
    `CAPTION\n${spec.caption}`,
    ...spec.slides.map((slide, index) => {
      const story = slide.kind === 'story' ? ` ${slide.storyId}` : '';
      return `SLIDE ${index + 1} ${slide.kind.toUpperCase()}${story}\n${slide.headline}\n${slide.body ?? ''}`;
    }),
  ].join('\n\n');
}
