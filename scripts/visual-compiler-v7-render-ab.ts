import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import {
  generateWeeklyReportageIllustrations,
  IMG_H,
  IMG_W,
  type CardImageConfig,
  type WeeklyReportageGeneratedVariant,
} from '../pipeline/card-image';
import {
  analogyPromptV5,
  selectVisualRenderModeV5,
  type AutoVisualClaimV5,
  type VisualRenderModeV5,
} from '../src/lib/weekly-digest/visual-auto-claim-v5';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { VisualPlan, VisualRegion } from '../src/lib/weekly-digest/visual-compiler';
import { renderGenericVisualSvgV5 } from '../src/lib/weekly-digest/visual-generic-svg-v5';
import type { VisualPipelineV7 } from '../src/lib/weekly-digest/visual-role-router-v7';

const INPUT_PATH =
  process.env.VISUAL_V7_ROUTED_CLAIMS?.trim() ||
  'experiments/visual-compiler-v7/fresh-holdout/output/v7-routed-claims.json';
const ROOT =
  process.env.VISUAL_V7_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-v7-fresh-ab';
const IMAGE_DIR = join(ROOT, 'images');
const CARD_DIR = join(ROOT, 'cards');
const ASSET_DIR = join(ROOT, 'assets');
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL =
  process.env.VISUAL_V5_IMAGE_MODEL?.trim() ||
  '@cf/black-forest-labs/flux-2-klein-9b';
const CARD_WIDTH = 720;
const CARD_HEADER = 156;
const CARD_IMAGE_HEIGHT = 405;
const CARD_HEIGHT = CARD_HEADER + CARD_IMAGE_HEIGHT + 18;

interface ClaimAudit {
  storyId: string;
  passed: boolean;
  issues: string[];
  rationale: string;
}

interface V7ClaimRecord {
  story: HoldoutStoryInput;
  initialRaw: unknown;
  finalRaw: unknown;
  autoClaim: AutoVisualClaimV5;
  plan: VisualPlan;
  renderMode: VisualRenderModeV5;
  initialAudit: ClaimAudit;
  finalAudit: ClaimAudit;
  deterministicIssues: string[];
  repaired: boolean;
eligible: boolean;
router: {
  storyId: string;
  role: AutoVisualClaimV5['semantics']['explanatoryRole'];
  pipeline: VisualPipelineV7;
  reason: string;
  expectedImageCalls: 0 | 1;
  requiredGuards: string[];
};
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
  durationMs: number;
  scene?: string;
  prompt?: string;
  assetPaths: string[];
}

interface RenderRow {
  storyId: string;
  rank: number;
  headline: string;
  role: AutoVisualClaimV5['semantics']['explanatoryRole'];
  certainty: AutoVisualClaimV5['semantics']['certainty'];
  mappingMode: AutoVisualClaimV5['semantics']['mappingMode'];
  format: VisualPlan['format'];
  renderMode: VisualPipelineV7;
  claimEligible: boolean;
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
    const data = (await response.json()) as { result?: { image?: string }; image?: string };
    const base64 = data.result?.image ?? data.image;
    if (!base64) throw new Error('Cloudflare JSON response contained no image.');
    return Buffer.from(base64, 'base64');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1_024) throw new Error('Cloudflare returned an empty image payload.');
  return buffer;
}

async function generateAsset(input: {
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
    form.append('input_image_0', await referenceBlob(input.reference), 'reference.png');
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

function overlaySvg(plan: VisualPlan): Buffer {
  const counts = new Map<string, number>();
  const pills = plan.overlays
    .map((overlay) => {
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
  return Buffer.from(`<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.42"/><stop offset="0.26" stop-color="#020617" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity="0.28"/></linearGradient></defs>
    <rect width="${IMG_W}" height="${IMG_H}" fill="url(#vignette)"/>
    <rect x="2" y="2" width="${IMG_W - 4}" height="${IMG_H - 4}" rx="25" fill="none" stroke="#22D3EE" stroke-opacity="0.28" stroke-width="3"/>
    ${pills}
  </svg>`);
}

async function applyOverlays(bytes: Buffer, plan: VisualPlan): Promise<Buffer> {
  return sharp(bytes)
    .composite([{ input: overlaySvg(plan), left: 0, top: 0 }])
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

function sequenceFrameSvg(plan: VisualPlan, includeLabels: boolean): Buffer {
  const regions = plan.regions
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
  const labels = includeLabels ? overlaySvg(plan).toString('utf8').replace(/^<svg[^>]*>|<\/svg>$/g, '') : '';
  return Buffer.from(`<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="seq-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#CFFAFE"/></marker></defs>
    ${regions}${arrows}${labels}
  </svg>`);
}

async function composeSequence(assets: Buffer[], plan: VisualPlan, includeLabels: boolean) {
  const layers: OverlayOptions[] = [];
  for (const [index, region] of plan.regions.entries()) {
    const asset = assets[index] ?? assets[0];
    if (!asset) throw new Error(`Missing sequence asset ${index}.`);
    const box = bounds(region);
    const image = await sharp(asset)
      .resize(box.width, box.height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 92 })
      .toBuffer();
    layers.push({ input: image, left: box.left, top: box.top });
  }
  layers.push({ input: sequenceFrameSvg(plan, includeLabels), left: 0, top: 0 });
  return sharp({ create: { width: IMG_W, height: IMG_H, channels: 3, background: '#040A11' } })
    .composite(layers)
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

function fallbackSvg(): Buffer {
  return Buffer.from(`<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="fb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03070D"/><stop offset="0.6" stop-color="#082F49"/><stop offset="1" stop-color="#1E1B4B"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#22D3EE" stop-opacity="0.28"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#fb)"/><ellipse cx="760" cy="360" rx="500" ry="330" fill="url(#glow)"/>
    ${Array.from({ length: 11 }, (_, index) => `<circle cx="${120 + index * 104}" cy="${210 + (index % 3) * 86}" r="${18 + (index % 4) * 7}" fill="#67E8F9" fill-opacity="${0.05 + (index % 5) * 0.025}"/>`).join('')}
    <path d="M110 510C360 340 540 580 790 380S1080 300 1190 470" fill="none" stroke="#C4B5FD" stroke-opacity="0.26" stroke-width="8"/>
  </svg>`);
}

async function renderCurrent(record: V7ClaimRecord): Promise<{
  bytes: Buffer;
  variant: WeeklyReportageGeneratedVariant;
  durationMs: number;
}> {
  const started = Date.now();
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
      accent: 'cool cyan',
      seedBase: `v7-current:${record.story.revision_item_id}`,
      variantCount: 1,
    },
    config,
  );
  const variant = result?.variants[0];
  if (!variant) throw new Error(`Current pipeline produced no image for ${record.story.title}.`);
  return { bytes: await normalizeImage(variant.bytes), variant, durationMs: Date.now() - started };
}

async function renderCompiler(record: V7ClaimRecord, currentBytes: Buffer): Promise<{
  pixels: Buffer;
  final: Buffer;
  audit: VariantAudit;
}> {
  const started = Date.now();
if (record.router.pipeline === 'current_art_director') {
  return {
    pixels: currentBytes,
    final: currentBytes,
    audit: {
      provider: 'reuse',
      model: 'current-art-director-v7',
      imageCalls: 0,
      estimatedImageCostUsd: 0,
      durationMs: Date.now() - started,
      assetPaths: [],
    },
  };
}
if (record.router.pipeline === 'source_led_fallback' || !record.eligible) {
    const pixels = await sharp(fallbackSvg()).jpeg({ quality: 93 }).toBuffer();
    return {
      pixels,
      final: pixels,
      audit: {
        provider: 'local',
        model: 'source-led-fallback-v1',
        imageCalls: 0,
        estimatedImageCostUsd: 0,
        durationMs: Date.now() - started,
        assetPaths: [],
      },
    };
  }

  if (record.router.pipeline !== 'deterministic_compiler') {
  throw new Error(`Unsupported v7 route ${record.router.pipeline} for ${record.story.title}.`);
}
const mode: VisualRenderModeV5 = 'deterministic_literal';
  if (mode === 'deterministic_literal') {
    const pixels = await sharp(
      renderGenericVisualSvgV5({
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
      renderGenericVisualSvgV5({
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
        model: 'generic-visual-grammar-v5',
        imageCalls: 0,
        estimatedImageCostUsd: 0,
        durationMs: Date.now() - started,
        assetPaths: [],
      },
    };
  }

  if (mode === 'generated_reference_sequence') {
    const assets: Buffer[] = [];
    const assetPaths: string[] = [];
    for (const [index, unit] of record.plan.renderUnits.entries()) {
      const raw = await generateAsset({
        id: `v5:${record.story.revision_item_id}:${unit.id}`,
        prompt: `${unit.prompt} Required visible state delta: ${record.autoClaim.semantics.requiredVisibleDelta}. The changed physical evidence must be unmistakable between states.`,
        width: 768,
        height: 768,
        reference: index > 0 ? assets[0] : undefined,
      });
      const normalized = await normalizeImage(raw, 768, 768);
      const path = join(ASSET_DIR, `${record.story.rank}-${safeName(record.story.revision_item_id)}-${unit.id}.jpg`);
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
        durationMs: Date.now() - started,
        prompt: record.plan.renderUnits.map((unit) => unit.prompt).join('\n---\n'),
        assetPaths,
      },
    };
  }

  if (mode === 'generated_identity_action_pair') {
    const neutralPrompt = [
      `Create a neutral identity reference for this editorial subject: ${record.autoClaim.claim.identity}.`,
      'No action, no result, no explanatory symbols. Preserve face, clothing, environment and camera for a subsequent action frame.',
      'Premium technology-magazine cinematography, wide 16:9 composition.',
      'Absolutely no text, letters, numbers, logos, UI, code, labels or watermarks.',
    ].join(' ');
    const neutralRaw = await generateAsset({
      id: `v5:${record.story.revision_item_id}:identity`,
      prompt: neutralPrompt,
      width: IMG_W,
      height: IMG_H,
    });
    const neutral = await normalizeImage(neutralRaw);
    const actionRaw = await generateAsset({
      id: `v5:${record.story.revision_item_id}:action`,
      prompt: analogyPromptV5(record.autoClaim),
      width: IMG_W,
      height: IMG_H,
      reference: neutral,
    });
    const pixels = await normalizeImage(actionRaw);
    const identityPath = join(ASSET_DIR, `${record.story.rank}-${safeName(record.story.revision_item_id)}-identity.jpg`);
    const actionPath = join(ASSET_DIR, `${record.story.rank}-${safeName(record.story.revision_item_id)}-action.jpg`);
    await Promise.all([writeFile(identityPath, neutral), writeFile(actionPath, pixels)]);
    return {
      pixels,
      final: await applyOverlays(pixels, record.plan),
      audit: {
        provider: 'cloudflare',
        model: MODEL,
        imageCalls: 2,
        estimatedImageCostUsd: 0.03,
        durationMs: Date.now() - started,
        prompt: `${neutralPrompt}\n---\n${analogyPromptV5(record.autoClaim)}`,
        assetPaths: [identityPath, actionPath],
      },
    };
  }

  const prompt = analogyPromptV5(record.autoClaim);
  const raw = await generateAsset({
    id: `v5:${record.story.revision_item_id}:analogy`,
    prompt,
    width: IMG_W,
    height: IMG_H,
  });
  const pixels = await normalizeImage(raw);
  const path = join(ASSET_DIR, `${record.story.rank}-${safeName(record.story.revision_item_id)}-analogy.jpg`);
  await writeFile(path, pixels);
  return {
    pixels,
    final: await applyOverlays(pixels, record.plan),
    audit: {
      provider: 'cloudflare',
      model: MODEL,
      imageCalls: 1,
      estimatedImageCostUsd: 0.015,
      durationMs: Date.now() - started,
      prompt,
      assetPaths: [path],
    },
  };
}

function wrapHeadline(value: string, maxChars = 43, maxLines = 4): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  let consumed = 0;
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      consumed += 1;
      continue;
    }
    lines.push(current);
    current = word;
    consumed += 1;
    if (lines.length >= maxLines - 1) break;
  }
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
    <text x="28" y="37" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="800" fill="#ECFEFF">${lines
      .map((line, index) => `<tspan x="28" dy="${index === 0 ? 0 : 30}">${xml(line)}</tspan>`)
      .join('')}</text>
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

async function blindSheet(rows: RenderRow[]): Promise<Buffer> {
  const thumbW = 560;
  const thumbH = Math.round((CARD_HEIGHT / CARD_WIDTH) * thumbW);
  const margin = 28;
  const labelH = 48;
  const rowGap = 34;
  const rowH = labelH + thumbH + rowGap;
  const width = margin * 3 + thumbW * 2;
  const height = margin + rows.length * rowH;
  const imageLayers: OverlayOptions[] = [];
  const text = [`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`];
  for (const [index, row] of rows.entries()) {
    const y = margin + index * rowH;
    for (const [column, path] of [row.blindXCardPath, row.blindYCardPath].entries()) {
      const x = margin + column * (thumbW + margin);
      const bytes = await sharp(path).resize(thumbW, thumbH, { fit: 'fill' }).png().toBuffer();
      imageLayers.push({ input: bytes, left: x, top: y + labelH });
      text.push(
        `<text x="${x}" y="${y + 32}" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="900" fill="#67E8F9">${column === 0 ? 'X' : 'Y'}</text>`,
      );
    }
  }
  text.push('</svg>');
  return sharp({ create: { width, height, channels: 3, background: '#03070D' } })
    .composite([...imageLayers, { input: Buffer.from(text.join('')), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/');
}

function report(rows: RenderRow[]): string {
  const currentCalls = rows.reduce((sum, row) => sum + row.current.imageCalls, 0);
  const compilerCalls = rows.reduce((sum, row) => sum + row.compiler.imageCalls, 0);
  const v7ExpectedCalls = rows.reduce(
    (sum, row) => sum + (row.renderMode === 'current_art_director' ? 1 : 0),
    0,
  );
  const currentCost = rows.reduce((sum, row) => sum + row.current.estimatedImageCostUsd, 0);
  const compilerCost = rows.reduce((sum, row) => sum + row.compiler.estimatedImageCostUsd, 0);
  const currentMs = rows.reduce((sum, row) => sum + row.current.durationMs, 0);
  const compilerMs = rows.reduce((sum, row) => sum + row.compiler.durationMs, 0);
  const lines = [
    '# Visual Compiler v7 unseen routed A/B render',
    '',
    `Stories: **${rows.length}**.`,
    `Current: ${currentCalls} image calls, estimated $${currentCost.toFixed(3)}, measured ${(currentMs / 1000).toFixed(1)}s serialized wall time.`,
    `V7 selected route: ${v7ExpectedCalls} expected production image call(s); ${compilerCalls} additional experiment call(s), estimated $${compilerCost.toFixed(3)}, measured ${(compilerMs / 1000).toFixed(1)}s local/reuse time.`,
    '',
    '| # | Story | Role | Certainty | Mapping | Route | Eligible | Current time | V7 time | X | Y |',
    '|---:|---|---|---|---|---|---:|---:|---:|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.role}\` | \`${row.certainty}\` | \`${row.mappingMode}\` | \`${row.renderMode}\` | ${row.claimEligible ? '✓' : '✕'} | ${(row.current.durationMs / 1000).toFixed(1)}s | ${(row.compiler.durationMs / 1000).toFixed(1)}s | ${row.blindXSource} | ${row.blindYSource} |`,
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
  const claims = JSON.parse(await readFile(INPUT_PATH, 'utf8')) as V7ClaimRecord[];
  if (claims.length !== 7) throw new Error(`Expected 7 v5 claims; received ${claims.length}.`);
  const rows: RenderRow[] = [];

  for (const [index, record] of [...claims].sort((a, b) => a.story.rank - b.story.rank).entries()) {
    const label = `${record.story.rank}-${safeName(record.story.revision_item_id)}`;
    console.log(`[v7-ab] ${index + 1}/${claims.length} current: ${record.story.title}`);
    const current = await renderCurrent(record);
    console.log(`[v7-ab] ${index + 1}/${claims.length} compiler: ${record.renderMode}`);
    const compiler = await renderCompiler(record, current.bytes);
    const currentImagePath = join(IMAGE_DIR, `${label}-current.jpg`);
    const compilerPixelPath = join(IMAGE_DIR, `${label}-compiler-pixels.jpg`);
    const compilerFinalPath = join(IMAGE_DIR, `${label}-compiler-final.jpg`);
    await Promise.all([
      writeFile(currentImagePath, current.bytes),
      writeFile(compilerPixelPath, compiler.pixels),
      writeFile(compilerFinalPath, compiler.final),
    ]);
    const currentCard = await card(record.story.title, current.bytes);
    const compilerCard = await card(record.story.title, compiler.final);
    const compilerIsX = seedFromString(`v7-blind:${record.story.revision_item_id}`) % 2 === 0;
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
    rows.push({
      storyId: record.story.revision_item_id,
      rank: record.story.rank,
      headline: record.story.title,
      role: record.autoClaim.semantics.explanatoryRole,
      certainty: record.autoClaim.semantics.certainty,
      mappingMode: record.autoClaim.semantics.mappingMode,
      format: record.plan.format,
      renderMode: record.router.pipeline,
      claimEligible: record.eligible,
      baselineImagePath: currentImagePath,
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
        durationMs: current.durationMs,
        scene: current.variant.scene,
        prompt: current.variant.positivePrompt,
        assetPaths: [],
      },
      compiler: compiler.audit,
    });
    await writeFile(
      join(ROOT, 'render-progress.json'),
      `${JSON.stringify(
        rows.map((row) => ({
          ...row,
          baselineImagePath: rel(row.baselineImagePath),
          compilerPixelPath: rel(row.compilerPixelPath),
          compilerFinalPath: rel(row.compilerFinalPath),
          blindXCardPath: rel(row.blindXCardPath),
          blindYCardPath: rel(row.blindYCardPath),
          compiler: { ...row.compiler, assetPaths: row.compiler.assetPaths.map(rel) },
        })),
        null,
        2,
      )}\n`,
    );
  }

  const serializable = rows.map((row) => ({
    ...row,
    baselineImagePath: rel(row.baselineImagePath),
    compilerPixelPath: rel(row.compilerPixelPath),
    compilerFinalPath: rel(row.compilerFinalPath),
    blindXCardPath: rel(row.blindXCardPath),
    blindYCardPath: rel(row.blindYCardPath),
    compiler: { ...row.compiler, assetPaths: row.compiler.assetPaths.map(rel) },
  }));
  await Promise.all([
    writeFile(join(ROOT, 'render-manifest.json'), `${JSON.stringify(serializable, null, 2)}\n`),
    writeFile(
      join(ROOT, 'blind-key.json'),
      `${JSON.stringify(
        rows.map((row) => ({ storyId: row.storyId, X: row.blindXSource, Y: row.blindYSource })),
        null,
        2,
      )}\n`,
    ),
    writeFile(join(ROOT, 'render-report.md'), report(rows)),
    writeFile(join(ROOT, 'blind-contact-sheet.png'), await blindSheet(rows)),
  ]);
  console.log(report(rows));
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
