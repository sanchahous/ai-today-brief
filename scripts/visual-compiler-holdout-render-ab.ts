import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import {
  generateWeeklyReportageIllustrations,
  IMG_H,
  IMG_W,
  type CardImageConfig,
  type WeeklyReportageGeneratedVariant,
} from '../pipeline/card-image';
import type { AutoVisualClaim, HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { OverlayGroup, VisualPlan, VisualRegion } from '../src/lib/weekly-digest/visual-compiler';
import { renderGenericVisualSvg } from '../src/lib/weekly-digest/visual-generic-svg';
import { decideVisualRenderPolicy } from '../src/lib/weekly-digest/visual-render-policy';

const INPUT_PATH =
  process.env.VISUAL_HOLDOUT_SELECTION?.trim() ||
  'artifacts/visual-compiler-holdout/render-selection.json';
const ROOT =
  process.env.VISUAL_HOLDOUT_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-holdout-ab';
const IMAGE_DIR = join(ROOT, 'images');
const CARD_DIR = join(ROOT, 'cards');
const ASSET_DIR = join(ROOT, 'assets');
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL =
  process.env.VISUAL_HOLDOUT_IMAGE_MODEL?.trim() ||
  '@cf/black-forest-labs/flux-2-klein-9b';
const ACCENT = 'cool cyan';
const CARD_WIDTH = 720;
const CARD_HEADER = 156;
const CARD_IMAGE_HEIGHT = 405;
const CARD_HEIGHT = CARD_HEADER + CARD_IMAGE_HEIGHT + 18;

interface HoldoutPlanRecord {
  weekStart: string;
  weekEnd: string;
  rank: number;
  headline: string;
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaim;
  plan: VisualPlan;
}

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface VariantAudit {
  provider: string;
  model: string;
  imageCalls: number;
  estimatedImageCostUsd: number;
  scene?: string;
  prompt?: string;
  assetPaths: string[];
}

interface AbRenderRecord {
  storyId: string;
  weekStart: string;
  rank: number;
  headline: string;
  format: VisualPlan['format'];
  renderMode: ReturnType<typeof decideVisualRenderPolicy>['mode'];
  baselineImagePath: string;
  compilerPixelPath: string;
  compilerFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: 'current' | 'compiler';
  blindYSource: 'current' | 'compiler';
  current: VariantAudit;
  compiler: VariantAudit;
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
  }
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

function safeName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function bounds(region: VisualRegion): PixelBounds {
  return {
    left: Math.round(region.bounds.x * IMG_W),
    top: Math.round(region.bounds.y * IMG_H),
    width: Math.max(1, Math.round(region.bounds.width * IMG_W)),
    height: Math.max(1, Math.round(region.bounds.height * IMG_H)),
  };
}

async function normalizeImage(bytes: Buffer, width = IMG_W, height = IMG_H): Promise<Buffer> {
  return sharp(bytes)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
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
    throw new Error(
      `Cloudflare image generation failed (${response.status}): ${(await response.text()).slice(
        0,
        900,
      )}`,
    );
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

async function generateCompilerAsset(input: {
  id: string;
  prompt: string;
  width: number;
  height: number;
  reference?: Buffer;
}): Promise<Buffer> {
  const form = new FormData();
  form.append('prompt', input.prompt);
  form.append('width', String(input.width));
  form.append('height', String(input.height));
  form.append('seed', String(seedFromString(input.id)));
  if (input.reference) {
    form.append('input_image_0', await referenceBlob(input.reference), 'identity-reference.png');
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

function overlayPills(plan: VisualPlan): string {
  const counts = new Map<string, number>();
  return plan.overlays
    .map((overlay: OverlayGroup) => {
      const region = overlay.regionId
        ? plan.regions.find((candidate) => candidate.id === overlay.regionId)
        : plan.regions[0];
      if (!region) return '';
      const box = bounds(region);
      const index = counts.get(region.id) ?? 0;
      counts.set(region.id, index + 1);
      const primary = overlay.importance === 'primary';
      const fontSize = overlay.text.length > 24 ? 16 : 18;
      const pillWidth = Math.min(
        Math.max(112, Math.round(overlay.text.length * fontSize * 0.62 + 34)),
        Math.max(112, box.width - 20),
      );
      const x = box.left + 11;
      const y = box.top + 11 + index * 45;
      return `<g><rect x="${x}" y="${y}" width="${pillWidth}" height="37" rx="18.5" fill="${
        primary ? '#CFFAFE' : '#083344'
      }" fill-opacity="0.97" stroke="#22D3EE" stroke-width="1.5"/><text x="${
        x + 17
      }" y="${y + 24.5}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
        primary ? '#083344' : '#ECFEFF'
      }">${xml(overlay.text)}</text></g>`;
    })
    .join('');
}

function generatedImageOverlay(plan: VisualPlan, includeLabels: boolean): Buffer {
  return Buffer.from(`<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="top-vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.58"/><stop offset="0.34" stop-color="#020617" stop-opacity="0"/></linearGradient>
      <linearGradient id="bottom-vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0.62" stop-color="#020617" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity="0.44"/></linearGradient>
    </defs>
    <rect width="${IMG_W}" height="${IMG_H}" fill="url(#top-vignette)"/>
    <rect width="${IMG_W}" height="${IMG_H}" fill="url(#bottom-vignette)"/>
    <rect x="2" y="2" width="${IMG_W - 4}" height="${IMG_H - 4}" rx="25" fill="none" stroke="#22D3EE" stroke-opacity="0.28" stroke-width="3"/>
    ${includeLabels ? overlayPills(plan) : ''}
  </svg>`);
}

async function addGeneratedOverlay(
  pixels: Buffer,
  plan: VisualPlan,
  includeLabels: boolean,
): Promise<Buffer> {
  return sharp(pixels)
    .composite([{ input: generatedImageOverlay(plan, includeLabels), left: 0, top: 0 }])
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

function sequenceStructure(plan: VisualPlan, includeLabels: boolean): Buffer {
  const regionRects = plan.regions
    .map((region) => {
      const box = bounds(region);
      return `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="24" fill="none" stroke="#67E8F9" stroke-opacity="0.55" stroke-width="3"/>`;
    })
    .join('');
  const arrows = plan.transitions
    .map((transition) => {
      const from = plan.regions.find((region) => region.id === transition.from);
      const to = plan.regions.find((region) => region.id === transition.to);
      if (!from || !to) return '';
      const a = bounds(from);
      const b = bounds(to);
      const x1 = a.left + a.width + 7;
      const y1 = a.top + a.height / 2;
      const x2 = b.left - 7;
      const y2 = b.top + b.height / 2;
      return `<path d="M${x1} ${y1}C${(x1 + x2) / 2} ${y1 - 18},${
        (x1 + x2) / 2
      } ${y2 + 18},${x2} ${y2}" fill="none" stroke="#CFFAFE" stroke-width="6" marker-end="url(#seq-arrow)"/>`;
    })
    .join('');
  return Buffer.from(`<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="seq-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#CFFAFE"/></marker>
      <linearGradient id="seq-vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.42"/><stop offset="0.26" stop-color="#020617" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity="0.24"/></linearGradient>
    </defs>
    <rect width="${IMG_W}" height="${IMG_H}" fill="url(#seq-vignette)"/>
    ${regionRects}${arrows}${includeLabels ? overlayPills(plan) : ''}
  </svg>`);
}

async function composeSequence(
  assets: Buffer[],
  plan: VisualPlan,
  includeLabels: boolean,
): Promise<Buffer> {
  const layers: OverlayOptions[] = [];
  for (const [index, region] of plan.regions.entries()) {
    const asset = assets[index] ?? assets[0];
    if (!asset) throw new Error(`Missing generated sequence asset ${index}.`);
    const box = bounds(region);
    const image = await sharp(asset)
      .resize(box.width, box.height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 92 })
      .toBuffer();
    layers.push({ input: image, left: box.left, top: box.top });
  }
  layers.push({ input: sequenceStructure(plan, includeLabels), left: 0, top: 0 });
  return sharp({
    create: { width: IMG_W, height: IMG_H, channels: 3, background: '#040A11' },
  })
    .composite(layers)
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function renderCurrent(record: HoldoutPlanRecord): Promise<{
  bytes: Buffer;
  variant: WeeklyReportageGeneratedVariant;
}> {
  const config: CardImageConfig = {
    geminiApiKey: '',
    openRouterApiKey: OPEN_ROUTER_API_KEY,
    cloudflareAccountId: CF_ACCOUNT_ID,
    cloudflareApiToken: CF_API_TOKEN,
    cloudflareImageModel: MODEL,
  };
  const result = await generateWeeklyReportageIllustrations(
    {
      headline: record.story.title,
      summary: record.story.summary,
      why: record.story.why ?? undefined,
      practical: record.story.practical ?? undefined,
      takeaway: record.story.takeaway ?? undefined,
      accent: ACCENT,
      seedBase: `holdout-current:${record.story.revision_item_id}`,
      variantCount: 1,
    },
    config,
  );
  const variant = result?.variants[0];
  if (!variant) throw new Error(`Current pipeline produced no image for ${record.story.title}.`);
  return { bytes: await normalizeImage(variant.bytes), variant };
}

async function renderCompiler(record: HoldoutPlanRecord): Promise<{
  pixels: Buffer;
  final: Buffer;
  audit: VariantAudit;
}> {
  const decision = decideVisualRenderPolicy(record.plan);
  if (decision.mode === 'deterministic_vector') {
    const pixels = await sharp(
      renderGenericVisualSvg({
        autoClaim: record.autoClaim,
        plan: record.plan,
        width: IMG_W,
        height: IMG_H,
        includeOverlays: false,
      }),
    )
      .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
      .toBuffer();
    const final = await sharp(
      renderGenericVisualSvg({
        autoClaim: record.autoClaim,
        plan: record.plan,
        width: IMG_W,
        height: IMG_H,
        includeOverlays: true,
      }),
    )
      .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
      .toBuffer();
    return {
      pixels,
      final,
      audit: {
        provider: 'local',
        model: 'generic-visual-grammar-v1',
        imageCalls: 0,
        estimatedImageCostUsd: 0,
        assetPaths: [],
      },
    };
  }

  if (decision.mode === 'generated_reference_sequence') {
    const assets: Buffer[] = [];
    const assetPaths: string[] = [];
    for (const [index, unit] of record.plan.renderUnits.entries()) {
      const raw = await generateCompilerAsset({
        id: `holdout-compiler:${record.story.revision_item_id}:${unit.id}`,
        prompt: unit.prompt,
        width: 768,
        height: 768,
        reference: index > 0 ? assets[0] : undefined,
      });
      const normalized = await normalizeImage(raw, 768, 768);
      const path = join(
        ASSET_DIR,
        `${record.weekStart}-${record.rank}-${safeName(record.story.revision_item_id)}-${unit.id}.jpg`,
      );
      await writeFile(path, normalized);
      assets.push(normalized);
      assetPaths.push(path);
    }
    return {
      pixels: await composeSequence(assets, record.plan, false),
      final: await composeSequence(assets, record.plan, true),
      audit: {
        provider: 'cloudflare',
        model: MODEL,
        imageCalls: assets.length,
        estimatedImageCostUsd: assets.length * 0.015,
        prompt: record.plan.renderUnits.map((unit) => unit.prompt).join('\n---\n'),
        assetPaths,
      },
    };
  }

  const unit = record.plan.renderUnits[0];
  if (!unit) throw new Error(`Missing compiler render unit for ${record.story.title}.`);
  const raw = await generateCompilerAsset({
    id: `holdout-compiler:${record.story.revision_item_id}:${unit.id}`,
    prompt: `${unit.prompt} Compose the one visible mechanism and its visible result in a single coherent 16:9 cause-and-effect scene, with neither element hidden by shallow depth of field.`,
    width: IMG_W,
    height: IMG_H,
  });
  const normalized = await normalizeImage(raw);
  const assetPath = join(
    ASSET_DIR,
    `${record.weekStart}-${record.rank}-${safeName(record.story.revision_item_id)}-${unit.id}.jpg`,
  );
  await writeFile(assetPath, normalized);
  return {
    pixels: await addGeneratedOverlay(normalized, record.plan, false),
    final: await addGeneratedOverlay(normalized, record.plan, true),
    audit: {
      provider: 'cloudflare',
      model: MODEL,
      imageCalls: 1,
      estimatedImageCostUsd: 0.015,
      prompt: unit.prompt,
      assetPaths: [assetPath],
    },
  };
}

function wrapHeadline(value: string, maxChars = 43, maxLines = 4): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }
  const consumed = lines.join(' ').split(' ').filter(Boolean).length + current.split(' ').filter(Boolean).length;
  const truncated = consumed < words.length;
  if (current && lines.length < maxLines) {
    lines.push(truncated ? `${current.replace(/[.,;:!?-]+$/, '')}…` : current);
  }
  return lines.slice(0, maxLines);
}

async function card(headline: string, image: Buffer): Promise<Buffer> {
  const lines = wrapHeadline(headline);
  const headerSvg = `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="26" fill="#050B12"/>
    <rect x="1.5" y="1.5" width="${CARD_WIDTH - 3}" height="${CARD_HEIGHT - 3}" rx="24.5" fill="none" stroke="#164E63" stroke-width="3"/>
    <text x="28" y="37" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="800" fill="#ECFEFF">
      ${lines.map((line, index) => `<tspan x="28" dy="${index === 0 ? 0 : 30}">${xml(line)}</tspan>`).join('')}
    </text>
    <text x="28" y="137" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.2" fill="#67E8F9">AI TODAY BRIEF</text>
  </svg>`;
  const resized = await sharp(image)
    .resize(CARD_WIDTH - 28, CARD_IMAGE_HEIGHT, { fit: 'cover' })
    .jpeg({ quality: 91 })
    .toBuffer();
  return sharp(Buffer.from(headerSvg))
    .composite([{ input: resized, left: 14, top: CARD_HEADER }])
    .png()
    .toBuffer();
}

async function contactSheet(records: AbRenderRecord[]): Promise<Buffer> {
  const thumbW = 560;
  const thumbH = Math.round((CARD_HEIGHT / CARD_WIDTH) * thumbW);
  const margin = 28;
  const labelH = 48;
  const rowGap = 34;
  const rowH = labelH + thumbH + rowGap;
  const width = margin * 3 + thumbW * 2;
  const height = margin + records.length * rowH;
  const layers: OverlayOptions[] = [];
  const svg = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
    '<rect width="100%" height="100%" fill="#03070D"/>',
  ];
  for (const [index, record] of records.entries()) {
    const y = margin + index * rowH;
    for (const [column, path] of [record.blindXCardPath, record.blindYCardPath].entries()) {
      const x = margin + column * (thumbW + margin);
      const bytes = await sharp(path)
        .resize(thumbW, thumbH, { fit: 'inside' })
        .png()
        .toBuffer();
      layers.push({ input: bytes, left: x, top: y + labelH });
      svg.push(
        `<text x="${x}" y="${y + 32}" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="900" fill="#67E8F9">${column === 0 ? 'X' : 'Y'}</text>`,
      );
    }
  }
  svg.push('</svg>');
  layers.push({ input: Buffer.from(svg.join('')), left: 0, top: 0 });
  return sharp({ create: { width, height, channels: 3, background: '#03070D' } })
    .composite(layers)
    .png()
    .toBuffer();
}

function relativePath(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/');
}

function report(records: AbRenderRecord[]): string {
  const currentImageCost = records.reduce(
    (sum, record) => sum + record.current.estimatedImageCostUsd,
    0,
  );
  const compilerImageCost = records.reduce(
    (sum, record) => sum + record.compiler.estimatedImageCostUsd,
    0,
  );
  const compilerCalls = records.reduce((sum, record) => sum + record.compiler.imageCalls, 0);
  const lines = [
    '# Unseen holdout A/B render manifest',
    '',
    `Stories: **${records.length}**.`,
    `Current image calls: **${records.length}**; estimated image cost: **$${currentImageCost.toFixed(3)}**.`,
    `Compiler image calls: **${compilerCalls}**; estimated image cost: **$${compilerImageCost.toFixed(3)}**.`,
    '',
    'The public review sheet is blinded as X/Y. `blind-key.json` is intentionally separate.',
    '',
    '| Week | # | Story | Compiler format | Compiler mode | Current scene source | X | Y |',
    '|---|---:|---|---|---|---|---|---|',
  ];
  for (const record of records) {
    lines.push(
      `| ${record.weekStart} | ${record.rank} | ${record.headline.replace(/\|/g, '\\|')} | \`${record.format}\` | \`${record.renderMode}\` | ${record.current.provider}/${record.current.model} | ${record.blindXSource} | ${record.blindYSource} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  assertEnvironment();
  await Promise.all([
    mkdir(ROOT, { recursive: true }),
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(CARD_DIR, { recursive: true }),
    mkdir(ASSET_DIR, { recursive: true }),
  ]);
  const selection = JSON.parse(await readFile(INPUT_PATH, 'utf8')) as HoldoutPlanRecord[];
  if (selection.length !== 12) throw new Error(`Expected 12 selected stories; received ${selection.length}.`);
  const records: AbRenderRecord[] = [];

  for (const [index, record] of selection.entries()) {
    const label = `${record.weekStart}-${record.rank}-${safeName(record.story.revision_item_id)}`;
    console.log(`[holdout-ab] ${index + 1}/${selection.length} current: ${record.story.title}`);
    const current = await renderCurrent(record);
    console.log(`[holdout-ab] ${index + 1}/${selection.length} compiler: ${record.plan.format}`);
    const compiler = await renderCompiler(record);

    const baselineImagePath = join(IMAGE_DIR, `${label}-current.jpg`);
    const compilerPixelPath = join(IMAGE_DIR, `${label}-compiler-pixels.jpg`);
    const compilerFinalPath = join(IMAGE_DIR, `${label}-compiler-final.jpg`);
    await Promise.all([
      writeFile(baselineImagePath, current.bytes),
      writeFile(compilerPixelPath, compiler.pixels),
      writeFile(compilerFinalPath, compiler.final),
    ]);

    const currentCard = await card(record.headline, current.bytes);
    const compilerCard = await card(record.headline, compiler.final);
    const compilerIsX = seedFromString(`blind:${record.story.revision_item_id}`) % 2 === 0;
    const xCard = compilerIsX ? compilerCard : currentCard;
    const yCard = compilerIsX ? currentCard : compilerCard;
    const blindXCardPath = join(CARD_DIR, `${label}-X.png`);
    const blindYCardPath = join(CARD_DIR, `${label}-Y.png`);
    await Promise.all([
      writeFile(blindXCardPath, xCard),
      writeFile(blindYCardPath, yCard),
      writeFile(join(CARD_DIR, `${label}-current.png`), currentCard),
      writeFile(join(CARD_DIR, `${label}-compiler.png`), compilerCard),
    ]);

    records.push({
      storyId: record.story.revision_item_id,
      weekStart: record.weekStart,
      rank: record.rank,
      headline: record.headline,
      format: record.plan.format,
      renderMode: decideVisualRenderPolicy(record.plan).mode,
      baselineImagePath,
      compilerPixelPath,
      compilerFinalPath,
      blindXCardPath,
      blindYCardPath,
      blindXSource: compilerIsX ? 'compiler' : 'current',
      blindYSource: compilerIsX ? 'current' : 'compiler',
      current: {
        provider: current.variant.provider,
        model: current.variant.model,
        imageCalls: 1,
        estimatedImageCostUsd: current.variant.estimatedCostUsd,
        scene: current.variant.scene,
        prompt: current.variant.positivePrompt,
        assetPaths: [],
      },
      compiler: compiler.audit,
    });

    await writeFile(
      join(ROOT, 'render-progress.json'),
      `${JSON.stringify(
        records.map((item) => ({
          ...item,
          baselineImagePath: relativePath(item.baselineImagePath),
          compilerPixelPath: relativePath(item.compilerPixelPath),
          compilerFinalPath: relativePath(item.compilerFinalPath),
          blindXCardPath: relativePath(item.blindXCardPath),
          blindYCardPath: relativePath(item.blindYCardPath),
          compiler: {
            ...item.compiler,
            assetPaths: item.compiler.assetPaths.map(relativePath),
          },
        })),
        null,
        2,
      )}\n`,
    );
  }

  const serializable = records.map((item) => ({
    ...item,
    baselineImagePath: relativePath(item.baselineImagePath),
    compilerPixelPath: relativePath(item.compilerPixelPath),
    compilerFinalPath: relativePath(item.compilerFinalPath),
    blindXCardPath: relativePath(item.blindXCardPath),
    blindYCardPath: relativePath(item.blindYCardPath),
    compiler: { ...item.compiler, assetPaths: item.compiler.assetPaths.map(relativePath) },
  }));
  const blindKey = records.map((item) => ({
    storyId: item.storyId,
    weekStart: item.weekStart,
    rank: item.rank,
    X: item.blindXSource,
    Y: item.blindYSource,
  }));
  await Promise.all([
    writeFile(join(ROOT, 'render-manifest.json'), `${JSON.stringify(serializable, null, 2)}\n`),
    writeFile(join(ROOT, 'blind-key.json'), `${JSON.stringify(blindKey, null, 2)}\n`),
    writeFile(join(ROOT, 'render-report.md'), report(records)),
    writeFile(join(ROOT, 'blind-contact-sheet.png'), await contactSheet(records)),
  ]);
  console.log(report(records));
  console.log(join(ROOT, 'blind-contact-sheet.png'));
}

main().catch(async (error) => {
  await mkdir(ROOT, { recursive: true });
  await writeFile(
    join(ROOT, 'render-failure.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
