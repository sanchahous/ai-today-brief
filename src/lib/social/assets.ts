import 'server-only';

import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { SocialAsset, SocialChannel } from './types';

const BUCKET = 'social-assets';
const BRAND_DARK = '#101418';
const BRAND_TEAL = '#47e4d3';
const BRAND_TEXT = '#f7fafc';

interface AssetSource {
  packageId: string;
  generationVersion: string;
  channel: SocialChannel;
  title: string;
  summary: string;
  why: string;
  facts: string[];
  sourceImageUrl?: string | null;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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

function overlaySvg(
  width: number,
  height: number,
  title: string,
  eyebrow: string,
  options: { titleSize?: number; maxChars?: number; maxLines?: number; footer?: string } = {},
) {
  const titleSize = options.titleSize ?? Math.round(width * 0.052);
  const lineHeight = Math.round(titleSize * 1.12);
  const lines = splitLines(title, options.maxChars ?? 31, options.maxLines ?? 4);
  const startY = height - 118 - lineHeight * lines.length;
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${Math.round(width * 0.075)}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  const footer = options.footer
    ? `<text x="${Math.round(width * 0.075)}" y="${height - 45}" fill="#b9c4ca" font-size="${Math.round(width * 0.022)}" font-family="Arial, sans-serif">${escapeXml(options.footer)}</text>`
    : '';

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
      <text x="${Math.round(width * 0.075)}" y="${Math.round(height * 0.16)}" fill="${BRAND_TEAL}" font-size="${Math.round(width * 0.023)}" font-weight="700" font-family="Arial, sans-serif" letter-spacing="2">${escapeXml(eyebrow.toUpperCase())}</text>
      <text x="${Math.round(width * 0.075)}" y="${startY}" fill="${BRAND_TEXT}" font-size="${titleSize}" font-weight="700" font-family="Arial, sans-serif">${tspans}</text>
      ${footer}
    </svg>
  `);
}

async function renderJpeg(
  width: number,
  height: number,
  title: string,
  eyebrow: string,
  background: Buffer | null,
  options?: Parameters<typeof overlaySvg>[4],
) {
  const base = background
    ? sharp(background).resize(width, height, { fit: 'cover', position: 'attention' })
    : sharp({
        create: {
          width,
          height,
          channels: 3,
          background: BRAND_DARK,
        },
      });

  return base
    .composite([{ input: overlaySvg(width, height, title, eyebrow, options), top: 0, left: 0 }])
    .jpeg({ quality: 88, progressive: true })
    .toBuffer();
}

async function uploadImmutable(path: string, jpeg: Buffer, width: number, height: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    cacheControl: '31536000, immutable',
    upsert: false,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`[social-assets] ${error.message}`);
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
        channel: source.channel,
        title: source.title,
        summary: source.summary,
        why: source.why,
        facts: source.facts,
        image: source.sourceImageUrl ?? null,
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

export async function renderSocialAssets(source: AssetSource): Promise<SocialAsset[]> {
  const background = await loadBackground(source.sourceImageUrl);
  const version = versionKey(source);
  const prefix = `${source.packageId}/${source.channel}/${version}`;

  if (source.channel !== 'instagram') {
    const width = 1200;
    const height = source.channel === 'telegram' ? 675 : 630;
    const jpeg = await renderJpeg(width, height, source.title, 'AI Today Brief', background, {
      footer: 'aitodaybrief.com',
    });
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
    const jpeg = await renderJpeg(
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
