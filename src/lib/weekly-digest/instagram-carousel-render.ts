import 'server-only';

import { join } from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import sharp from 'sharp';
import type { QualityIssue } from '@/lib/social/types';
import {
  layoutInstagramSlideText,
  INSTAGRAM_LAYOUT,
  INSTAGRAM_SLIDE_HEIGHT,
  INSTAGRAM_SLIDE_WIDTH,
  type InstagramSlideLayout,
  type InstagramTextMeasurer,
} from '@/lib/social/instagram-layout';
import type { InstagramCarouselSpec, InstagramCarouselSlide } from '@/lib/social/instagram-carousel';

const DEJAVU_DIRECTORY = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const BRAND_DARK = '#101418';
const BRAND_TEAL = '#47e4d3';
const BRAND_TEXT = '#f7fafc';

let textFontsRegistered = false;

function registerTextFonts() {
  if (textFontsRegistered) return;
  const regular = GlobalFonts.registerFromPath(
    join(DEJAVU_DIRECTORY, 'DejaVuSans.ttf'),
    'AI Today Brief Sans',
  );
  const bold = GlobalFonts.registerFromPath(
    join(DEJAVU_DIRECTORY, 'DejaVuSans-Bold.ttf'),
    'AI Today Brief Sans Bold',
  );
  if (!regular || !bold) throw new Error('Instagram carousel fonts could not be loaded.');
  textFontsRegistered = true;
}

export function instagramCanvasMeasurer(): InstagramTextMeasurer {
  registerTextFonts();
  const context = createCanvas(INSTAGRAM_SLIDE_WIDTH, 64).getContext('2d');
  return {
    measure(text, fontSize, weight) {
      context.font = `${fontSize}px "${
        weight === 'bold' ? 'AI Today Brief Sans Bold' : 'AI Today Brief Sans'
      }"`;
      return context.measureText(text).width;
    },
  };
}

function overlaySvg() {
  return Buffer.from(`
    <svg width="${INSTAGRAM_SLIDE_WIDTH}" height="${INSTAGRAM_SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${BRAND_DARK}" stop-opacity="0.18"/>
          <stop offset="0.52" stop-color="${BRAND_DARK}" stop-opacity="0.55"/>
          <stop offset="1" stop-color="${BRAND_DARK}" stop-opacity="0.96"/>
        </linearGradient>
      </defs>
      <rect width="${INSTAGRAM_SLIDE_WIDTH}" height="${INSTAGRAM_SLIDE_HEIGHT}" fill="url(#shade)"/>
      <rect x="${INSTAGRAM_LAYOUT.safeLeft}" y="92" width="96" height="8" rx="4" fill="${BRAND_TEAL}"/>
    </svg>
  `);
}

async function photoBackground(source: Buffer) {
  return sharp(source)
    .resize(INSTAGRAM_SLIDE_WIDTH, INSTAGRAM_SLIDE_HEIGHT, { fit: 'cover', position: 'attention' })
    .composite([{ input: overlaySvg(), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function cardBackground() {
  return sharp({
    create: {
      width: INSTAGRAM_SLIDE_WIDTH,
      height: INSTAGRAM_SLIDE_HEIGHT,
      channels: 3,
      background: BRAND_DARK,
    },
  })
    .composite([{ input: overlaySvg(), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

function chromeLayer(index: number, total: number) {
  registerTextFonts();
  const canvas = createCanvas(INSTAGRAM_SLIDE_WIDTH, INSTAGRAM_SLIDE_HEIGHT);
  const context = canvas.getContext('2d');
  context.textBaseline = 'top';
  context.font = '28px "AI Today Brief Sans Bold"';
  context.fillStyle = BRAND_TEXT;
  context.fillText('AI Today', INSTAGRAM_LAYOUT.safeLeft, 112);
  context.fillStyle = BRAND_TEAL;
  context.fillText('Brief', INSTAGRAM_LAYOUT.safeLeft + context.measureText('AI Today ').width, 112);
  context.fillStyle = BRAND_TEAL;
  context.font = '22px "AI Today Brief Sans Bold"';
  const counter = `${index} / ${total}`;
  context.fillText(
    counter,
    INSTAGRAM_SLIDE_WIDTH - INSTAGRAM_LAYOUT.safeRight - context.measureText(counter).width,
    116,
  );
  context.fillStyle = '#9ba5aa';
  context.font = '22px "AI Today Brief Sans"';
  context.fillText('Weekly Digest · aitodaybrief.com', INSTAGRAM_LAYOUT.safeLeft, 1268);
  return canvas.toBuffer('image/png');
}

function textLayer(layout: InstagramSlideLayout) {
  registerTextFonts();
  const canvas = createCanvas(INSTAGRAM_SLIDE_WIDTH, INSTAGRAM_SLIDE_HEIGHT);
  const context = canvas.getContext('2d');
  context.textBaseline = 'top';
  context.fillStyle = BRAND_TEXT;
  for (const line of layout.lines) {
    context.font = `${line.fontSize}px "${
      line.weight === 'bold' ? 'AI Today Brief Sans Bold' : 'AI Today Brief Sans'
    }"`;
    context.fillText(line.text, line.x, line.y);
  }
  return canvas.toBuffer('image/png');
}

export type RenderedInstagramSlide = {
  index: number;
  kind: InstagramCarouselSlide['kind'];
  jpeg: Buffer;
};

export type InstagramCarouselRenderResult =
  | { ok: true; slides: RenderedInstagramSlide[] }
  | { ok: false; blockers: QualityIssue[] };

function slideBody(slide: InstagramCarouselSlide) {
  return slide.kind === 'cover' ? undefined : slide.body;
}

export async function renderWeeklyInstagramCarousel(input: {
  spec: InstagramCarouselSpec;
  cover: Buffer;
  stories: Array<{ revisionItemId: string; image: Buffer }>;
  measurer?: InstagramTextMeasurer;
}): Promise<InstagramCarouselRenderResult> {
  const measurer = input.measurer ?? instagramCanvasMeasurer();
  const slides: RenderedInstagramSlide[] = [];
  const blockers: QualityIssue[] = [];
  const storyById = new Map(input.stories.map((story) => [story.revisionItemId, story.image]));

  for (const [index, slide] of input.spec.slides.entries()) {
    const laidOut = layoutInstagramSlideText({
      kind: slide.kind,
      headline: slide.headline,
      body: slideBody(slide),
      measurer,
    });
    if (!laidOut.ok) {
      blockers.push({
        code: 'instagram_overflow',
        message: `Slide ${index + 1} ${laidOut.message}`,
        field: 'content_parts',
      });
      continue;
    }
    let background: Buffer;
    if (slide.kind === 'cover') {
      background = await photoBackground(input.cover);
    } else if (slide.kind === 'story') {
      const image = storyById.get(slide.revisionItemId);
      if (!image) {
        blockers.push({
          code: 'instagram_story_images',
          message: `Slide ${index + 1} is missing its approved story image.`,
          field: 'asset_urls',
        });
        continue;
      }
      background = await photoBackground(image);
    } else {
      background = await cardBackground();
    }
    const jpeg = await sharp(background)
      .composite([
        { input: chromeLayer(index + 1, input.spec.slides.length), top: 0, left: 0 },
        { input: textLayer(laidOut.layout), top: 0, left: 0 },
      ])
      .jpeg({ quality: 91, progressive: true })
      .toBuffer();
    slides.push({ index: index + 1, kind: slide.kind, jpeg });
  }

  if (blockers.length > 0) return { ok: false, blockers };
  return { ok: true, slides };
}
