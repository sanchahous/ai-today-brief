import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type {
  OverlayGroup,
  RenderUnit,
  VisualPlan,
  VisualRegion,
} from '../src/lib/weekly-digest/visual-compiler';

const ROOT =
  process.env.VISUAL_COMPILER_OUT_DIR?.trim() || 'artifacts/visual-compiler-shadow';
const IMAGE_DIR = join(ROOT, 'images');
const ASSET_DIR = join(ROOT, 'assets');
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL =
  process.env.VISUAL_COMPILER_IMAGE_MODEL?.trim() ||
  '@cf/black-forest-labs/flux-2-klein-9b';
const WIDTH = 1280;
const HEIGHT = 720;
const ASSET_SIZE = 768;

interface PlanRecord {
  rank: number;
  headline: string;
  plan: VisualPlan;
}

interface RenderedRecord {
  rank: number;
  headline: string;
  storyId: string;
  format: VisualPlan['format'];
  pixelOnlyPath: string;
  finalPath: string;
  assetPaths: string[];
  imageCalls: number;
  estimatedCostUsd: number;
}

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1_000_000;
}

function bounds(region: VisualRegion): PixelBounds {
  return {
    left: Math.round(region.bounds.x * WIDTH),
    top: Math.round(region.bounds.y * HEIGHT),
    width: Math.max(1, Math.round(region.bounds.width * WIDTH)),
    height: Math.max(1, Math.round(region.bounds.height * HEIGHT)),
  };
}

function center(region: VisualRegion): { x: number; y: number } {
  return {
    x: Math.round((region.bounds.x + region.bounds.width / 2) * WIDTH),
    y: Math.round((region.bounds.y + region.bounds.height / 2) * HEIGHT),
  };
}

async function referenceBlob(bytes: Buffer): Promise<Blob> {
  const resized = await sharp(bytes)
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  return new Blob([new Uint8Array(resized)], { type: 'image/png' });
}

async function readCloudflareImage(response: Response): Promise<Buffer> {
  if (!response.ok) {
    const body = (await response.text()).slice(0, 800);
    throw new Error(`Cloudflare image generation failed (${response.status}): ${body}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as {
      result?: { image?: string };
      image?: string;
    };
    const base64 = data.result?.image ?? data.image;
    if (!base64) throw new Error('Cloudflare JSON response contained no image.');
    return Buffer.from(base64, 'base64');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1_024) throw new Error('Cloudflare returned an empty image payload.');
  return buffer;
}

async function generateAsset(input: {
  unit: RenderUnit;
  storyId: string;
  reference?: Buffer;
}): Promise<Buffer> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
  }
  const form = new FormData();
  const continuityInstruction = input.reference
    ? 'Use image 0 only as a continuity reference. Preserve its subject identity, materials, environment, camera height, lighting direction and visual language, but depict the newly requested action or state exactly. Never copy any accidental text or marks from the reference.'
    : 'Center the complete focal subject with safe margins so it can be cropped into an editorial layout.';
  form.append('prompt', `${input.unit.prompt} ${continuityInstruction}`);
  form.append('width', String(ASSET_SIZE));
  form.append('height', String(ASSET_SIZE));
  form.append('seed', String(seedFromString(`${input.storyId}:${input.unit.id}`)));
  if (input.reference) {
    form.append('input_image_0', await referenceBlob(input.reference), 'continuity.png');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      body: form,
      signal: AbortSignal.timeout(90_000),
    },
  );
  return readCloudflareImage(response);
}

async function roundedRegionImage(bytes: Buffer, region: VisualRegion): Promise<Buffer> {
  const target = bounds(region);
  const radius = Math.min(30, Math.round(Math.min(target.width, target.height) * 0.07));
  const mask = Buffer.from(
    `<svg width="${target.width}" height="${target.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${radius}" fill="white"/></svg>`,
  );
  return sharp(bytes)
    .resize(target.width, target.height, { fit: 'cover', position: 'attention' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function backgroundSvg(): string {
  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#050B12"/>
        <stop offset="0.48" stop-color="#0A1722"/>
        <stop offset="1" stop-color="#101827"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="48%" r="64%">
        <stop offset="0" stop-color="#22D3EE" stop-opacity="0.11"/>
        <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <path d="M0 144H${WIDTH}M0 288H${WIDTH}M0 432H${WIDTH}M0 576H${WIDTH}" stroke="#D9F9FF" stroke-opacity="0.025"/>
    <path d="M160 0V${HEIGHT}M320 0V${HEIGHT}M480 0V${HEIGHT}M640 0V${HEIGHT}M800 0V${HEIGHT}M960 0V${HEIGHT}M1120 0V${HEIGHT}" stroke="#D9F9FF" stroke-opacity="0.02"/>
  </svg>`;
}

function arrowPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  type: VisualPlan['transitions'][number]['type'],
): string {
  const dx = to.x - from.x;
  const startX = from.x + Math.sign(dx || 1) * 34;
  const endX = to.x - Math.sign(dx || 1) * 38;
  const bend = type === 'branch' ? Math.round(Math.abs(dx) * 0.18) : 0;
  const controlY = Math.min(from.y, to.y) - bend;
  return `M ${startX} ${from.y} C ${Math.round((startX + endX) / 2)} ${controlY}, ${Math.round(
    (startX + endX) / 2,
  )} ${controlY}, ${endX} ${to.y}`;
}

function pillSvg(overlay: OverlayGroup, region: VisualRegion, index: number): string {
  const box = bounds(region);
  const primary = overlay.importance === 'primary';
  const fontSize = overlay.text.length > 22 ? 16 : 18;
  const width = Math.min(
    Math.max(112, Math.round(overlay.text.length * fontSize * 0.62 + 34)),
    Math.max(112, box.width - 22),
  );
  const height = 38;
  const x = box.left + 12;
  const y = box.top + 12 + index * 46;
  const fill = primary ? '#CFFAFE' : '#083344';
  const text = primary ? '#083344' : '#ECFEFF';
  const stroke = primary ? '#67E8F9' : '#155E75';
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="19" fill="${fill}" fill-opacity="${
      primary ? '0.96' : '0.91'
    }" stroke="${stroke}" stroke-width="1.5"/>
    <text x="${x + 17}" y="${y + 25}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${text}">${xml(
      overlay.text,
    )}</text>
  </g>`;
}

function structureSvg(plan: VisualPlan, includeLabels: boolean): Buffer {
  const regionById = new Map(plan.regions.map((region) => [region.id, region]));
  const parts = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#67E8F9"/></marker></defs>',
  ];

  if (plan.format === 'cinematic_split') {
    parts.push(
      `<path d="M640 90V630" stroke="#67E8F9" stroke-opacity="0.34" stroke-width="2"/>`,
    );
  }
  if (plan.format === 'cinematic_data_contrast') {
    const amplified = regionById.get('amplified');
    if (amplified) {
      const box = bounds(amplified);
      parts.push(
        `<path d="M ${box.left + 46} ${box.top + box.height - 48} C ${box.left + 30} ${
          box.top + 52
        }, ${box.left + box.width - 30} ${box.top + 52}, ${box.left + box.width - 46} ${
          box.top + box.height - 48
        }" fill="none" stroke="#67E8F9" stroke-opacity="0.55" stroke-width="5" marker-end="url(#arrow)"/>`,
      );
    }
  }
  if (plan.format === 'cinematic_cutaway') {
    const removed = regionById.get('removed-layers');
    if (removed) {
      const box = bounds(removed);
      for (let index = 0; index < 3; index += 1) {
        parts.push(
          `<rect x="${box.left + 16 + index * 9}" y="${box.top + 46 + index * 28}" width="${
            box.width - 50
          }" height="${Math.max(56, box.height - 150)}" rx="20" fill="#22D3EE" fill-opacity="${
            0.08 + index * 0.035
          }" stroke="#67E8F9" stroke-opacity="0.62" stroke-width="2" stroke-dasharray="8 8"/>`,
        );
      }
    }
  }
  if (plan.format === 'cinematic_routing') {
    const source = regionById.get('route-source');
    if (source) {
      const point = center(source);
      parts.push(
        `<circle cx="${point.x}" cy="${point.y}" r="62" fill="#071B26" fill-opacity="0.96" stroke="#67E8F9" stroke-width="4"/>`,
        `<circle cx="${point.x}" cy="${point.y}" r="30" fill="#22D3EE" fill-opacity="0.24" stroke="#CFFAFE" stroke-width="2"/>`,
      );
    }
  }

  for (const transition of plan.transitions) {
    const from = regionById.get(transition.from);
    const to = regionById.get(transition.to);
    if (!from || !to) continue;
    parts.push(
      `<path d="${arrowPath(center(from), center(to), transition.type)}" fill="none" stroke="#67E8F9" stroke-opacity="0.82" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)"/>`,
    );
  }

  if (includeLabels) {
    const overlayIndexByRegion = new Map<string, number>();
    for (const overlay of plan.overlays) {
      const region = overlay.regionId ? regionById.get(overlay.regionId) : plan.regions[0];
      if (!region) continue;
      const current = overlayIndexByRegion.get(region.id) ?? 0;
      parts.push(pillSvg(overlay, region, current));
      overlayIndexByRegion.set(region.id, current + 1);
    }
  }
  parts.push('</svg>');
  return Buffer.from(parts.join(''));
}

async function composePlan(
  record: PlanRecord,
  assetsByRegion: Map<string, Buffer>,
  includeLabels: boolean,
): Promise<Buffer> {
  const layers: OverlayOptions[] = [];
  for (const unit of record.plan.renderUnits) {
    const region = record.plan.regions.find((candidate) => candidate.id === unit.regionId);
    const asset = assetsByRegion.get(unit.regionId);
    if (!region || !asset) continue;
    const box = bounds(region);
    layers.push({
      input: await roundedRegionImage(asset, region),
      left: box.left,
      top: box.top,
    });
  }
  layers.push({ input: structureSvg(record.plan, includeLabels), left: 0, top: 0 });
  return sharp(Buffer.from(backgroundSvg()))
    .composite(layers)
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function renderStory(record: PlanRecord): Promise<RenderedRecord> {
  const storyId = record.plan.claim.storyId;
  const generatedByUnit = new Map<string, Buffer>();
  const assetsByRegion = new Map<string, Buffer>();
  const assetPaths: string[] = [];

  for (const [index, unit] of record.plan.renderUnits.entries()) {
    const fallbackReferenceId =
      index > 0 && record.plan.format === 'cinematic_cutaway' ? 'asset-1' : undefined;
    const referenceId = unit.referenceFrom ?? fallbackReferenceId;
    const reference = referenceId ? generatedByUnit.get(referenceId) : undefined;
    console.log(`[render] ${record.rank}/${storyId}/${unit.id}${reference ? ' + reference' : ''}`);
    const bytes = await generateAsset({ unit, storyId, reference });
    generatedByUnit.set(unit.id, bytes);
    assetsByRegion.set(unit.regionId, bytes);
    const assetPath = join(ASSET_DIR, `${record.rank}-${storyId}-${unit.id}.png`);
    await sharp(bytes).png().toFile(assetPath);
    assetPaths.push(assetPath);
  }

  const pixelOnly = await composePlan(record, assetsByRegion, false);
  const final = await composePlan(record, assetsByRegion, true);
  const pixelOnlyPath = join(IMAGE_DIR, `${record.rank}-${storyId}-pixels.jpg`);
  const finalPath = join(IMAGE_DIR, `${record.rank}-${storyId}-final.jpg`);
  await Promise.all([writeFile(pixelOnlyPath, pixelOnly), writeFile(finalPath, final)]);

  return {
    rank: record.rank,
    headline: record.headline,
    storyId,
    format: record.plan.format,
    pixelOnlyPath,
    finalPath,
    assetPaths,
    imageCalls: record.plan.renderUnits.length,
    estimatedCostUsd: record.plan.execution.estimatedUsd,
  };
}

function wrapHeadline(value: string, maxChars = 75): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

async function contactSheet(records: RenderedRecord[]): Promise<Buffer> {
  const thumbWidth = 720;
  const thumbHeight = 405;
  const margin = 28;
  const titleHeight = 92;
  const rowHeight = titleHeight + thumbHeight + 34;
  const width = margin * 3 + thumbWidth * 2;
  const height = margin + rowHeight * records.length;
  const layers: OverlayOptions[] = [];
  const svg = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
    '<rect width="100%" height="100%" fill="#050B12"/>',
  ];

  for (const [rowIndex, record] of records.entries()) {
    const y = margin + rowIndex * rowHeight;
    const lines = wrapHeadline(`${record.rank}. ${record.headline}`);
    lines.forEach((line, lineIndex) => {
      svg.push(
        `<text x="${margin}" y="${y + 30 + lineIndex * 27}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="800" fill="#ECFEFF">${xml(
          line,
        )}</text>`,
      );
    });
    svg.push(
      `<text x="${margin}" y="${y + 82}" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="700" fill="#67E8F9">PIXELS + STRUCTURE</text>`,
      `<text x="${margin * 2 + thumbWidth}" y="${y + 82}" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="700" fill="#67E8F9">FINAL + APPROVED OVERLAYS</text>`,
    );

    for (const [column, path] of [record.pixelOnlyPath, record.finalPath].entries()) {
      const x = margin + column * (thumbWidth + margin);
      const thumbnail = await sharp(path)
        .resize(thumbWidth, thumbHeight, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();
      layers.push({ input: thumbnail, left: x, top: y + titleHeight });
    }
  }
  svg.push('</svg>');
  layers.push({ input: Buffer.from(svg.join('')), left: 0, top: 0 });
  return sharp({
    create: { width, height, channels: 3, background: '#050B12' },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

async function main() {
  await Promise.all([
    mkdir(ROOT, { recursive: true }),
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(ASSET_DIR, { recursive: true }),
  ]);
  const plans = JSON.parse(await readFile(join(ROOT, 'plans.json'), 'utf8')) as PlanRecord[];
  const rendered: RenderedRecord[] = [];
  for (const record of plans) rendered.push(await renderStory(record));
  const sheet = await contactSheet(rendered);
  await Promise.all([
    writeFile(join(ROOT, 'contact-sheet.png'), sheet),
    writeFile(join(ROOT, 'render-manifest.json'), `${JSON.stringify(rendered, null, 2)}\n`),
  ]);
  console.log(
    JSON.stringify(
      {
        stories: rendered.length,
        imageCalls: rendered.reduce((sum, record) => sum + record.imageCalls, 0),
        estimatedCostUsd: rendered.reduce(
          (sum, record) => sum + record.estimatedCostUsd,
          0,
        ),
        contactSheet: join(ROOT, 'contact-sheet.png'),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
