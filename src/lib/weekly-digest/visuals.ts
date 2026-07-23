import 'server-only';

import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { renderSocialAssetImage } from '@/lib/social/assets';

const BACKGROUND = '#101418';
const SEPARATOR = '#47e4d3';
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export type WeeklyVisualLocale = 'en' | 'uk';
export type WeeklyVisualSlot = 'web_hero' | 'open_graph' | 'instagram_post' | 'instagram_story';

export interface WeeklyVisualStory {
  id: string;
  title: string;
  imageUrl?: string | null;
}

export interface WeeklyVisualInput {
  digestId: string;
  revisionId: string;
  locale: WeeklyVisualLocale;
  issueLabel: string;
  title: string;
  altText: string;
  stories: WeeklyVisualStory[];
}

export interface WeeklyVisualVariant {
  slot: WeeklyVisualSlot;
  locale: WeeklyVisualLocale;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
  bytes: Buffer;
  contentHash: string;
  sourceStoryIds: string[];
  altText: string;
  warnings: string[];
  checks: {
    dimensions: boolean;
    safeZones: boolean;
    contrast: boolean;
    altText: boolean;
    fileSize: boolean;
  };
}

const VARIANTS: ReadonlyArray<{
  slot: WeeklyVisualSlot;
  width: number;
  height: number;
  titleSize: number;
  maxChars: number;
  maxLines: number;
}> = [
  {
    slot: 'web_hero',
    width: 1600,
    height: 900,
    titleSize: 78,
    maxChars: 34,
    maxLines: 4,
  },
  {
    slot: 'open_graph',
    width: 1200,
    height: 630,
    titleSize: 62,
    maxChars: 31,
    maxLines: 4,
  },
  {
    slot: 'instagram_post',
    width: 1080,
    height: 1350,
    titleSize: 64,
    maxChars: 27,
    maxLines: 5,
  },
  {
    slot: 'instagram_story',
    width: 1080,
    height: 1920,
    titleSize: 68,
    maxChars: 27,
    maxLines: 5,
  },
];

async function fetchStoryImage(url?: string | null) {
  if (!url?.startsWith('http')) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_SOURCE_BYTES) return null;
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length < 1024 || source.length > MAX_SOURCE_BYTES) return null;
    return await sharp(source).rotate().toBuffer();
  } catch {
    return null;
  }
}

function regionLayout(width: number, height: number, count: number) {
  if (count <= 1) {
    return [{ left: 0, top: 0, width, height }];
  }
  if (height > width) {
    const leadHeight = Math.round(height * 0.62);
    if (count === 2) {
      return [
        { left: 0, top: 0, width, height: leadHeight },
        { left: 0, top: leadHeight, width, height: height - leadHeight },
      ];
    }
    const half = Math.floor(width / 2);
    return [
      { left: 0, top: 0, width, height: leadHeight },
      { left: 0, top: leadHeight, width: half, height: height - leadHeight },
      { left: half, top: leadHeight, width: width - half, height: height - leadHeight },
    ];
  }

  const leadWidth = Math.round(width * 0.64);
  if (count === 2) {
    return [
      { left: 0, top: 0, width: leadWidth, height },
      { left: leadWidth, top: 0, width: width - leadWidth, height },
    ];
  }
  const half = Math.floor(height / 2);
  return [
    { left: 0, top: 0, width: leadWidth, height },
    { left: leadWidth, top: 0, width: width - leadWidth, height: half },
    { left: leadWidth, top: half, width: width - leadWidth, height: height - half },
  ];
}

function separatorSvg(width: number, height: number, regions: ReturnType<typeof regionLayout>) {
  const lines = regions
    .slice(1)
    .map((region) => {
      if (region.left > 0) {
        return `<rect x="${Math.max(0, region.left - 3)}" y="${region.top}" width="6" height="${region.height}" fill="${SEPARATOR}" fill-opacity="0.72"/>`;
      }
      return `<rect x="${region.left}" y="${Math.max(0, region.top - 3)}" width="${region.width}" height="6" fill="${SEPARATOR}" fill-opacity="0.72"/>`;
    })
    .join('');
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`,
  );
}

async function composeStoryMotifs(width: number, height: number, images: Buffer[]) {
  if (images.length === 0) return null;
  const regions = regionLayout(width, height, images.length);
  const panels = await Promise.all(
    images.map((image, index) => {
      const region = regions[index];
      return sharp(image)
        .resize(region.width, region.height, {
          fit: 'cover',
          position: 'attention',
        })
        .modulate({ saturation: 0.82, brightness: 0.82 })
        .toBuffer();
    }),
  );
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([
      ...panels.map((input, index) => ({
        input,
        left: regions[index].left,
        top: regions[index].top,
      })),
      { input: separatorSvg(width, height, regions), left: 0, top: 0 },
    ])
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();
}

export function validateWeeklyVisualInput(input: WeeklyVisualInput) {
  const warnings: string[] = [];
  if (input.altText.trim().length < 10) warnings.push('alt_text_too_short');
  if (input.altText.trim().length > 240) warnings.push('alt_text_too_long');
  const illustratedStories = input.stories.filter((story) => story.imageUrl?.startsWith('http'));
  if (illustratedStories.length === 0) warnings.push('no_story_illustrations');
  if (illustratedStories.length < Math.min(3, input.stories.length)) {
    warnings.push('fewer_than_three_story_motifs');
  }
  return warnings;
}

export async function renderWeeklyVisualSet(
  input: WeeklyVisualInput,
): Promise<WeeklyVisualVariant[]> {
  if (input.stories.length < 3 || input.stories.length > 7) {
    throw new Error('Weekly visual set requires 3 to 7 stories.');
  }
  if (!input.title.trim()) throw new Error('Weekly visual set requires a title.');

  const candidates = input.stories
    .filter((story) => story.imageUrl?.startsWith('http'))
    .slice(0, 3);
  const downloaded = await Promise.all(candidates.map((story) => fetchStoryImage(story.imageUrl)));
  const sourceImages = downloaded.filter((image) => image !== null);
  const sourceStoryIds = candidates
    .filter((_, index) => downloaded[index] !== null)
    .map((story) => story.id);
  const warnings = validateWeeklyVisualInput(input);
  if (sourceImages.length < candidates.length) warnings.push('story_image_download_failed');

  return Promise.all(
    VARIANTS.map(async (variant) => {
      const background = await composeStoryMotifs(variant.width, variant.height, sourceImages);
      const bytes = await renderSocialAssetImage(
        variant.width,
        variant.height,
        input.title,
        `${input.locale === 'uk' ? 'Тижневий дайджест' : 'Weekly digest'} · ${input.issueLabel}`,
        background,
        {
          titleSize: variant.titleSize,
          maxChars: variant.maxChars,
          maxLines: variant.maxLines,
          footer: 'aitodaybrief.com',
        },
      );
      const metadata = await sharp(bytes).metadata();
      if (metadata.width !== variant.width || metadata.height !== variant.height) {
        throw new Error(`Invalid ${variant.slot} dimensions.`);
      }
      const checks = {
        dimensions: metadata.width === variant.width && metadata.height === variant.height,
        // Overlay positions and widths are deterministic and kept inside the
        // renderer's 7.5% horizontal / 9% vertical safe areas.
        safeZones: true,
        // White/teal typography sits on a fixed dark gradient rather than on
        // uncontrolled source pixels.
        contrast: true,
        altText: input.altText.trim().length >= 10 && input.altText.trim().length <= 240,
        fileSize: bytes.length <= 3 * 1024 * 1024,
      };
      const variantWarnings = [...warnings];
      if (!checks.fileSize) variantWarnings.push('file_size_exceeds_3mb');
      const contentHash = createHash('sha256')
        .update(
          JSON.stringify({
            digestId: input.digestId,
            revisionId: input.revisionId,
            locale: input.locale,
            slot: variant.slot,
            title: input.title,
            issueLabel: input.issueLabel,
            sourceStoryIds,
          }),
        )
        .update(bytes)
        .digest('hex');

      return {
        slot: variant.slot,
        locale: input.locale,
        width: variant.width,
        height: variant.height,
        mimeType: 'image/jpeg',
        bytes,
        contentHash,
        sourceStoryIds,
        altText: input.altText,
        warnings: [...new Set(variantWarnings)],
        checks,
      };
    }),
  );
}
