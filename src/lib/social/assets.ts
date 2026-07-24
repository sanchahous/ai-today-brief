import 'server-only';

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import sharp, { type Sharp } from 'sharp';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { storageBlob } from '@/lib/storage/binary';
import type { SocialAsset, SocialChannel } from './types';

const DEJAVU_DIRECTORY = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const TEXT_FONT = join(DEJAVU_DIRECTORY, 'DejaVuSans.ttf');
const TEXT_FONT_BOLD = join(DEJAVU_DIRECTORY, 'DejaVuSans-Bold.ttf');
const BUCKET = 'social-assets';
const BRAND_DARK = '#101418';
const BRAND_TEAL = '#47e4d3';
const BRAND_TEXT = '#f7fafc';
const STORAGE_BINARY_VERSION = 'binary-v2';

interface AssetSource {
  packageId: string;
  generationVersion: string;
  channel: SocialChannel;
  title: string;
  summary: string;
  why: string;
  facts: string[];
  sourceImageUrl?: string | null;
  sourceImageUrls?: Array<string | null | undefined>;
}

export interface SocialAssetRenderOptions {
  titleSize?: number;
  maxChars?: number;
  maxLines?: number;
  footer?: string;
}

function splitLines(value: string, maxChars: number, maxLines: number) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.join(' ').length;
  if (used < value.trim().length && lines.length > 0) {
    lines[lines.length - 1] = `${lines.at(-1)!.replace(/[.,;:!?]?$/, '')}…`;
  }
  return lines;
}

let textFontsRegistered = false;

function registerTextFonts() {
  if (textFontsRegistered) return;
  const regular = GlobalFonts.registerFromPath(TEXT_FONT, 'AI Today Brief Sans');
  const bold = GlobalFonts.registerFromPath(TEXT_FONT_BOLD, 'AI Today Brief Sans Bold');
  if (!regular || !bold) throw new Error('Editorial asset fonts could not be loaded.');
  textFontsRegistered = true;
}

function wrapCanvasText(context: SKRSContext2D, value: string, width: number) {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}

async function loadBackground(url?: string | null): Promise<Buffer | null> {
  if (!url?.startsWith('http')) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > 1024 ? bytes : null;
  } catch {
    return null;
  }
}

function overlaySvg(width: number, height: number) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${BRAND_DARK}" stop-opacity="0.15"/>
          <stop offset="0.48" stop-color="${BRAND_DARK}" stop-opacity="0.62"/>
          <stop offset="1" stop-color="${BRAND_DARK}" stop-opacity="0.98"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <rect x="${Math.round(width * 0.075)}" y="${Math.round(height * 0.09)}" width="${Math.round(width * 0.055)}" height="8" rx="4" fill="${BRAND_TEAL}"/>
    </svg>
  `);
}

async function textLayer(options: {
  text: string;
  width: number;
  size: number;
  color: string;
  bold?: boolean;
  spacing?: number;
}) {
  registerTextFonts();
  const width = Math.max(1, Math.round(options.width));
  const lineHeight = Math.max(
    options.size,
    Math.round(options.size * 1.2) + (options.spacing ?? 0),
  );
  // A one-line canvas is enough to measure wrapping before allocating the
  // final transparent layer. This avoids sharp/libvips' optional Pango text
  // operation, which is unavailable in the production Linux image.
  const measurement = createCanvas(width, lineHeight).getContext('2d');
  measurement.font = `${options.size}px "${
    options.bold ? 'AI Today Brief Sans Bold' : 'AI Today Brief Sans'
  }"`;
  const lines = wrapCanvasText(measurement, options.text, width);
  const canvas = createCanvas(width, Math.max(1, lines.length * lineHeight));
  const context = canvas.getContext('2d');
  context.font = measurement.font;
  context.fillStyle = options.color;
  context.textBaseline = 'top';
  lines.forEach((line, index) => context.fillText(line, 0, index * lineHeight));
  return canvas.toBuffer('image/png');
}

export async function renderSocialAssetImage(
  width: number,
  height: number,
  title: string,
  eyebrow: string,
  background: Buffer | Buffer[] | null,
  options?: SocialAssetRenderOptions,
) {
  const titleSize = options?.titleSize ?? Math.round(width * 0.052);
  const lineHeight = Math.round(titleSize * 1.12);
  const lines = splitLines(title, options?.maxChars ?? 31, options?.maxLines ?? 4);
  const contentLeft = Math.round(width * 0.075);
  const contentWidth = Math.round(width * 0.85);
  const [eyebrowLayer, titleLayer, footerLayer] = await Promise.all([
    textLayer({
      text: eyebrow.toUpperCase(),
      width: contentWidth,
      size: Math.round(width * 0.023),
      color: BRAND_TEAL,
      bold: true,
    }),
    textLayer({
      text: lines.join('\n'),
      width: contentWidth,
      size: titleSize,
      color: BRAND_TEXT,
      bold: true,
      spacing: Math.max(0, lineHeight - titleSize),
    }),
    options?.footer
      ? textLayer({
          text: options.footer,
          width: contentWidth,
          size: Math.round(width * 0.022),
          color: '#b9c4ca',
        })
      : null,
  ]);
  const titleMetadata = await sharp(titleLayer).metadata();
  const footerTop = height - 67;
  const titleTop = Math.max(
    Math.round(height * 0.23),
    footerTop - 26 - (titleMetadata.height ?? lineHeight * lines.length),
  );
  const backgrounds = Array.isArray(background)
    ? background.slice(0, 3)
    : background
      ? [background]
      : [];
  let base: Sharp;
  if (backgrounds.length <= 1) {
    base = backgrounds[0]
      ? sharp(backgrounds[0]).resize(width, height, { fit: 'cover', position: 'attention' })
      : sharp({
          create: {
            width,
            height,
            channels: 3,
            background: BRAND_DARK,
          },
        });
  } else {
    const portrait = height > width;
    const regions = portrait
      ? [
          { left: 0, top: 0, width, height: Math.round(height * 0.62) },
          {
            left: 0,
            top: Math.round(height * 0.62),
            width: Math.floor(width / 2),
            height: height - Math.round(height * 0.62),
          },
          {
            left: Math.floor(width / 2),
            top: Math.round(height * 0.62),
            width: width - Math.floor(width / 2),
            height: height - Math.round(height * 0.62),
          },
        ]
      : [
          { left: 0, top: 0, width: Math.round(width * 0.64), height },
          {
            left: Math.round(width * 0.64),
            top: 0,
            width: width - Math.round(width * 0.64),
            height: Math.floor(height / 2),
          },
          {
            left: Math.round(width * 0.64),
            top: Math.floor(height / 2),
            width: width - Math.round(width * 0.64),
            height: height - Math.floor(height / 2),
          },
        ];
    const panels = await Promise.all(
      backgrounds.map((image, index) =>
        sharp(image)
          .resize(regions[index].width, regions[index].height, {
            fit: 'cover',
            position: 'attention',
          })
          .toBuffer(),
      ),
    );
    base = sharp({
      create: { width, height, channels: 3, background: BRAND_DARK },
    }).composite(
      panels.map((input, index) => ({
        input,
        left: regions[index].left,
        top: regions[index].top,
      })),
    );
  }

  return base
    .composite([
      { input: overlaySvg(width, height), top: 0, left: 0 },
      {
        input: eyebrowLayer,
        top: Math.round(height * 0.125),
        left: contentLeft,
      },
      { input: titleLayer, top: Math.max(0, titleTop), left: contentLeft },
      ...(footerLayer ? [{ input: footerLayer, top: footerTop, left: contentLeft }] : []),
    ])
    .jpeg({ quality: 88, progressive: true })
    .toBuffer();
}

async function uploadImmutable(path: string, jpeg: Buffer, width: number, height: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, storageBlob(jpeg, 'image/jpeg'), {
      contentType: 'image/jpeg',
      cacheControl: '31536000, immutable',
      upsert: false,
    });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`[social-assets] ${error.message}`);
  }
  const { data: stored, error: verifyError } = await supabase.storage.from(BUCKET).download(path);
  if (verifyError || !stored) {
    throw new Error(`[social-assets] upload verification: ${verifyError?.message ?? 'empty file'}`);
  }
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  if (storedBytes.length !== jpeg.length || !storedBytes.equals(jpeg)) {
    throw new Error('[social-assets] upload verification: stored bytes do not match source.');
  }
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return {
    url,
    width,
    height,
    mimeType: 'image/jpeg' as const,
    bytes: jpeg.length,
  } satisfies SocialAsset;
}

function versionKey(source: AssetSource) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: source.generationVersion,
        storage: STORAGE_BINARY_VERSION,
        channel: source.channel,
        title: source.title,
        summary: source.summary,
        why: source.why,
        facts: source.facts,
        images: source.sourceImageUrls ?? [source.sourceImageUrl ?? null],
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

export async function renderSocialAssets(source: AssetSource): Promise<SocialAsset[]> {
  const imageUrls =
    source.sourceImageUrls?.filter((value): value is string =>
      Boolean(value?.startsWith('http')),
    ) ?? (source.sourceImageUrl ? [source.sourceImageUrl] : []);
  const loadedBackgrounds = await Promise.all(imageUrls.slice(0, 3).map(loadBackground));
  const background = loadedBackgrounds.filter((image) => image !== null);
  const version = versionKey(source);
  const prefix = `${source.packageId}/${source.channel}/${version}`;

  if (source.channel !== 'instagram') {
    const width = 1200;
    const height = source.channel === 'telegram' ? 675 : 630;
    const jpeg = await renderSocialAssetImage(
      width,
      height,
      source.title,
      'AI Today Brief',
      background,
      {
        footer: 'aitodaybrief.com',
      },
    );
    return [await uploadImmutable(`${prefix}/cover-${width}x${height}.jpg`, jpeg, width, height)];
  }

  const width = 1080;
  const height = 1350;
  const slides = [
    { eyebrow: 'AI Today Brief', text: source.title },
    { eyebrow: 'What happened', text: source.summary },
    { eyebrow: 'Why it matters', text: source.why },
    { eyebrow: 'Key facts', text: source.facts.slice(0, 3).join(' • ') || source.summary },
    {
      eyebrow: 'Stay informed',
      text: 'Get the full daily AI engineering brief at aitodaybrief.com',
    },
  ];

  const assets: SocialAsset[] = [];
  for (const [index, slide] of slides.entries()) {
    const jpeg = await renderSocialAssetImage(
      width,
      height,
      slide.text,
      slide.eyebrow,
      index === 0 ? background : null,
      {
        titleSize: index === 0 ? 62 : 54,
        maxChars: index === 0 ? 28 : 34,
        maxLines: index === 0 ? 5 : 7,
        footer: `${index + 1} / ${slides.length}  ·  aitodaybrief.com`,
      },
    );
    assets.push(
      await uploadImmutable(
        `${prefix}/slide-${String(index + 1).padStart(2, '0')}.jpg`,
        jpeg,
        width,
        height,
      ),
    );
  }
  return assets;
}
