import 'server-only';

import { createHash } from 'node:crypto';
import {
  loadSocialBackground,
  renderSocialAssetImage,
  uploadImmutableSocialAsset,
  type SocialAssetRenderOptions,
} from './assets';
import type { DailyVisualInstagramCarouselSpec } from './daily-visual-carousel';
import type { SocialAsset, SocialChannel, SocialLocale } from './types';

export const DAILY_VISUAL_LANDSCAPE = {
  width: 1200,
  height: 630,
} as const;

export const DAILY_VISUAL_TELEGRAM = {
  width: 1200,
  height: 675,
} as const;

export const DAILY_VISUAL_INSTAGRAM = {
  width: 1080,
  height: 1350,
  slideCount: 5,
} as const;

export type DailyVisualAssetPlan = {
  filename: string;
  width: number;
  height: number;
  fit: 'contain';
  masterSourceCount: 1;
};

type RenderImage = (
  width: number,
  height: number,
  title: string,
  eyebrow: string,
  background: Buffer | Buffer[] | null,
  options?: SocialAssetRenderOptions,
) => Promise<Buffer>;

type UploadImage = (
  path: string,
  jpeg: Buffer,
  width: number,
  height: number,
) => Promise<SocialAsset>;

export interface DailyVisualAssetDependencies {
  loadMaster?: (url: string) => Promise<Buffer | null>;
  renderImage?: RenderImage;
  uploadImage?: UploadImage;
}

export interface RenderDailyVisualAssetsInput {
  packageId: string;
  visualSetId: string;
  masterImageUrl: string;
  channel: SocialChannel;
  locale: SocialLocale;
  displayTitle: string;
  visualThesis: string;
  instagramCarousel?: DailyVisualInstagramCarouselSpec | null;
}

function token(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function label(locale: SocialLocale) {
  return locale === 'uk' ? 'Щоденний бриф' : 'Daily Brief';
}

function slidePlan(): DailyVisualAssetPlan[] {
  return Array.from({ length: DAILY_VISUAL_INSTAGRAM.slideCount }, (_, index) => ({
    filename: `slide-${String(index + 1).padStart(2, '0')}.jpg`,
    width: DAILY_VISUAL_INSTAGRAM.width,
    height: DAILY_VISUAL_INSTAGRAM.height,
    fit: 'contain' as const,
    masterSourceCount: 1 as const,
  }));
}

/**
 * A derivative always renders a single selected master with `contain`; no
 * panel/collage path is available to the daily visual workflow.
 */
export function dailyVisualAssetPlan(channel: SocialChannel): DailyVisualAssetPlan[] {
  if (channel === 'instagram') return slidePlan();
  const size = channel === 'telegram' ? DAILY_VISUAL_TELEGRAM : DAILY_VISUAL_LANDSCAPE;
  return [
    {
      filename: `cover-${size.width}x${size.height}.jpg`,
      width: size.width,
      height: size.height,
      fit: 'contain',
      masterSourceCount: 1,
    },
  ];
}

function socialAssetPrefix(input: RenderDailyVisualAssetsInput) {
  const contentVersion = token(
    JSON.stringify({
      visualSetId: input.visualSetId,
      masterImageUrl: input.masterImageUrl,
      channel: input.channel,
      locale: input.locale,
      displayTitle: input.displayTitle,
      visualThesis: input.visualThesis,
      instagramCarousel: input.instagramCarousel ?? null,
    }),
  );
  return `${input.packageId}/daily-visual/${token(input.visualSetId)}/${input.channel}/${contentVersion}`;
}

function instagramSlideText(spec: DailyVisualInstagramCarouselSpec, index: number) {
  const slide = spec.slides[index];
  if (!slide) throw new Error(`Daily Instagram slide ${index + 1} is missing.`);
  return {
    title: slide.headline,
    body: slide.body ?? '',
    eyebrow:
      slide.kind === 'cover'
        ? 'AI Today Brief'
        : slide.kind === 'cta'
          ? 'Stay informed'
          : slide.kind === 'story'
            ? 'What changed'
            : 'Why it matters',
    footer: `${index + 1} / ${DAILY_VISUAL_INSTAGRAM.slideCount} · aitodaybrief.com`,
  };
}

function assertAssetCount(channel: SocialChannel, assets: SocialAsset[]) {
  const expected = channel === 'instagram' ? DAILY_VISUAL_INSTAGRAM.slideCount : 1;
  if (assets.length !== expected) {
    throw new Error(
      `Daily social ${channel} generated ${assets.length}/${expected} required assets.`,
    );
  }
}

function assetOptions(
  footer: string,
  body: string,
  format: 'landscape' | 'instagram',
): SocialAssetRenderOptions {
  return {
    titleSize: format === 'instagram' ? 56 : 48,
    maxChars: 34,
    maxLines: format === 'instagram' ? 5 : 4,
    body,
    bodySize: format === 'instagram' ? 31 : 28,
    bodyMaxChars: format === 'instagram' ? 44 : 52,
    bodyMaxLines: format === 'instagram' ? 5 : 3,
    footer,
    backgroundFit: 'contain',
  };
}

export async function renderDailyVisualSocialAssets(
  input: RenderDailyVisualAssetsInput,
  dependencies: DailyVisualAssetDependencies = {},
): Promise<SocialAsset[]> {
  const loadMaster = dependencies.loadMaster ?? loadSocialBackground;
  const renderImage = dependencies.renderImage ?? renderSocialAssetImage;
  const uploadImage = dependencies.uploadImage ?? uploadImmutableSocialAsset;
  const master = await loadMaster(input.masterImageUrl);
  if (!master) throw new Error('Daily visual master image could not be loaded.');

  const prefix = socialAssetPrefix(input);
  const plan = dailyVisualAssetPlan(input.channel);
  const assets: SocialAsset[] = [];
  for (const [index, derivative] of plan.entries()) {
    const text =
      input.channel === 'instagram'
        ? instagramSlideText(input.instagramCarousel ?? missingInstagramSpec(), index)
        : {
            title: input.displayTitle,
            // The image model never draws copy. Keep the derivative equally
            // quiet: social post text carries the explanation, while the
            // visual asset gives a reader one deterministic title and the
            // complete, uncropped master scene.
            body: '',
            eyebrow: `AI Today Brief · ${label(input.locale)}`,
            footer: 'aitodaybrief.com',
          };
    const jpeg = await renderImage(
      derivative.width,
      derivative.height,
      text.title,
      text.eyebrow,
      master,
      assetOptions(
        text.footer,
        text.body ?? '',
        input.channel === 'instagram' ? 'instagram' : 'landscape',
      ),
    );
    assets.push(
      await uploadImage(
        `${prefix}/${derivative.filename}`,
        jpeg,
        derivative.width,
        derivative.height,
      ),
    );
  }
  assertAssetCount(input.channel, assets);
  return assets;
}

function missingInstagramSpec(): never {
  throw new Error('Daily Instagram assets require a five-slide carousel specification.');
}
