import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import {
  buildDeepWorkPromptsV10,
  ownerReworkTreatmentV10,
  renderDeepWorkOverlaySvgV10,
  renderOwnerReworkSvgV10,
  validateDeterministicGeometryV10,
  type OwnerReworkKindV10,
  type OwnerReworkTreatmentV10,
} from '../src/lib/weekly-digest/visual-owner-rework-v10';

const INPUT_PATH =
  process.env.VISUAL_V10_TARGET_STORIES?.trim() ||
  'experiments/visual-affordance-v10/targeted/owner-rework-stories.json';
const ROOT =
  process.env.VISUAL_V10_TARGET_OUT_DIR?.trim() ||
  'artifacts/visual-affordance-v10-targeted';
const IMAGE_DIR = join(ROOT, 'images');
const CARD_DIR = join(ROOT, 'cards');
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL =
  process.env.VISUAL_V10_IMAGE_MODEL?.trim() ||
  '@cf/black-forest-labs/flux-2-klein-9b';

const IMAGE_WIDTH = 1280;
const IMAGE_HEIGHT = 720;
const CARD_WIDTH = 720;
const CARD_HEADER = 156;
const CARD_IMAGE_HEIGHT = 405;
const CARD_HEIGHT = CARD_HEADER + CARD_IMAGE_HEIGHT + 18;

interface TargetStoryJson {
  rank: number;
  id: string;
  kind: OwnerReworkKindV10;
  title: string;
  summary: string;
  why: string;
  takeaway: string;
}

interface RenderVariant {
  variantId: string;
  rank: number;
  story: HoldoutStoryInput;
  treatment: OwnerReworkTreatmentV10;
  pixelPath: string;
  finalPath: string;
  pixelCardPath: string;
  finalCardPath: string;
  prompt: string | null;
  provider: 'local' | 'cloudflare';
  model: string;
  imageCalls: number;
  estimatedImageCostUsd: number;
  durationMs: number;
  geometryIssues: string[];
}

function storyFromJson(row: TargetStoryJson): HoldoutStoryInput {
  return {
    week_start: '2026-06-22',
    week_end: '2026-07-05',
    rank: row.rank,
    revision_item_id: row.id,
    title: row.title,
    summary: row.summary,
    why: row.why,
    practical: null,
    takeaway: row.takeaway,
  };
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeName(value: string): string {
  return value
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1_000_000;
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
    const payload = (await response.json()) as {
      result?: { image?: string };
      image?: string;
    };
    const base64 = payload.result?.image ?? payload.image;
    if (!base64) throw new Error('Cloudflare JSON response contained no image.');
    return Buffer.from(base64, 'base64');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_024) throw new Error('Cloudflare returned an empty image.');
  return bytes;
}

async function generateDeepWorkCandidate(input: {
  variantId: string;
  prompt: string;
}): Promise<Buffer> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for Deep Work candidates.',
    );
  }
  const form = new FormData();
  form.append('prompt', input.prompt);
  form.append('width', String(IMAGE_WIDTH));
  form.append('height', String(IMAGE_HEIGHT));
  form.append('seed', String(seedFromString(`visual-v10:${input.variantId}`)));
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    },
  );
  return readCloudflareImage(response);
}

async function normalizeImage(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
      fit: 'cover',
      position: 'attention',
    })
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer();
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
  const header = Buffer.from(`<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="26" fill="#050B12"/><rect x="1.5" y="1.5" width="${CARD_WIDTH - 3}" height="${CARD_HEIGHT - 3}" rx="24.5" fill="none" stroke="#164E63" stroke-width="3"/><text x="28" y="37" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="800" fill="#ECFEFF">${lines
    .map(
      (line, index) =>
        `<tspan x="28" dy="${index === 0 ? 0 : 30}">${xml(line)}</tspan>`,
    )
    .join('')}</text><text x="28" y="137" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.2" fill="#67E8F9">AI TODAY BRIEF</text></svg>`);
  const resized = await sharp(image)
    .resize(CARD_WIDTH - 28, CARD_IMAGE_HEIGHT, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();
  return sharp(header)
    .composite([{ input: resized, left: 14, top: CARD_HEADER }])
    .png()
    .toBuffer();
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/');
}

async function writeVariant(input: {
  variantId: string;
  story: HoldoutStoryInput;
  treatment: OwnerReworkTreatmentV10;
  pixels: Buffer;
  final: Buffer;
  prompt: string | null;
  provider: 'local' | 'cloudflare';
  model: string;
  imageCalls: number;
  durationMs: number;
  geometryIssues: string[];
}): Promise<RenderVariant> {
  const prefix = `${input.story.rank}-${safeName(input.variantId)}`;
  const pixelPath = join(IMAGE_DIR, `${prefix}-pixels.jpg`);
  const finalPath = join(IMAGE_DIR, `${prefix}-final.jpg`);
  const pixelCardPath = join(CARD_DIR, `${prefix}-pixels.png`);
  const finalCardPath = join(CARD_DIR, `${prefix}-final.png`);
  await Promise.all([
    writeFile(pixelPath, input.pixels),
    writeFile(finalPath, input.final),
    writeFile(pixelCardPath, await card(input.story.title, input.pixels)),
    writeFile(finalCardPath, await card(input.story.title, input.final)),
  ]);
  return {
    variantId: input.variantId,
    rank: input.story.rank,
    story: input.story,
    treatment: input.treatment,
    pixelPath,
    finalPath,
    pixelCardPath,
    finalCardPath,
    prompt: input.prompt,
    provider: input.provider,
    model: input.model,
    imageCalls: input.imageCalls,
    estimatedImageCostUsd: input.imageCalls * 0.015,
    durationMs: input.durationMs,
    geometryIssues: input.geometryIssues,
  };
}

async function renderDeterministic(
  story: HoldoutStoryInput,
  kind: Exclude<OwnerReworkKindV10, 'deep_work_bounded_hint'>,
): Promise<RenderVariant> {
  const started = Date.now();
  const treatment = ownerReworkTreatmentV10(kind);
  const geometryIssues = validateDeterministicGeometryV10(kind);
  if (geometryIssues.length) {
    throw new Error(
      `${kind} deterministic geometry is invalid: ${geometryIssues.join('; ')}`,
    );
  }
  const pixels = await sharp(
    renderOwnerReworkSvgV10({ kind, includeLabels: false }),
  )
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer();
  const final = await sharp(
    renderOwnerReworkSvgV10({ kind, includeLabels: true }),
  )
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return writeVariant({
    variantId: kind,
    story,
    treatment,
    pixels,
    final,
    prompt: null,
    provider: 'local',
    model: `owner-directed-${kind}-v10`,
    imageCalls: 0,
    durationMs: Date.now() - started,
    geometryIssues,
  });
}

async function renderDeepWork(
  story: HoldoutStoryInput,
): Promise<RenderVariant[]> {
  const treatment = ownerReworkTreatmentV10('deep_work_bounded_hint');
  const prompts = buildDeepWorkPromptsV10(story);
  const variants: RenderVariant[] = [];
  for (const [index, prompt] of prompts.entries()) {
    const started = Date.now();
    const variantId = `deep-work-${index === 0 ? 'mechanical' : 'linkage'}`;
    const generated = await generateDeepWorkCandidate({ variantId, prompt });
    const pixels = await normalizeImage(generated);
    const final = await sharp(pixels)
      .composite([
        {
          input: renderDeepWorkOverlaySvgV10(IMAGE_WIDTH, IMAGE_HEIGHT),
          left: 0,
          top: 0,
        },
      ])
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
      .toBuffer();
    variants.push(
      await writeVariant({
        variantId,
        story,
        treatment,
        pixels,
        final,
        prompt,
        provider: 'cloudflare',
        model: MODEL,
        imageCalls: 1,
        durationMs: Date.now() - started,
        geometryIssues: [],
      }),
    );
  }
  return variants;
}

async function contactSheet(variants: RenderVariant[]): Promise<Buffer> {
  const ordered = [...variants].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.variantId.localeCompare(right.variantId);
  });
  const thumbWidth = 560;
  const thumbHeight = Math.round((CARD_HEIGHT / CARD_WIDTH) * thumbWidth);
  const margin = 28;
  const headerHeight = 58;
  const footerHeight = 74;
  const rowGap = 34;
  const rowHeight = headerHeight + thumbHeight + footerHeight + rowGap;
  const width = margin * 3 + thumbWidth * 2;
  const height = margin + ordered.length * rowHeight;
  const layers: OverlayOptions[] = [];
  const labels = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const [index, variant] of ordered.entries()) {
    const y = margin + index * rowHeight;
    for (const [column, path] of [
      variant.pixelCardPath,
      variant.finalCardPath,
    ].entries()) {
      const x = margin + column * (thumbWidth + margin);
      const bytes = await sharp(path)
        .resize(thumbWidth, thumbHeight, { fit: 'fill' })
        .png()
        .toBuffer();
      layers.push({ input: bytes, left: x, top: y + headerHeight });
      labels.push(
        `<text x="${x}" y="${y + 34}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="${column === 0 ? '#94A3B8' : '#34D399'}">${column === 0 ? 'LABELS HIDDEN' : 'FINAL COMPOSITE'}</text>`,
      );
    }
    const footerY = y + headerHeight + thumbHeight + 30;
    labels.push(
      `<text x="${margin}" y="${footerY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="17" font-weight="800" fill="#ECFEFF">${xml(`${variant.rank}. ${variant.story.title}`)}</text>`,
      `<text x="${margin}" y="${footerY + 27}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#94A3B8">${xml(`${variant.variantId} • ${variant.treatment.coreClaim}`.slice(0, 180))}</text>`,
    );
  }
  labels.push('</svg>');
  return sharp({
    create: { width, height, channels: 3, background: '#03070D' },
  })
    .composite([
      ...layers,
      { input: Buffer.from(labels.join('')), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function report(variants: RenderVariant[]): string {
  const imageCalls = variants.reduce((sum, variant) => sum + variant.imageCalls, 0);
  const cost = variants.reduce(
    (sum, variant) => sum + variant.estimatedImageCostUsd,
    0,
  );
  const duration = variants.reduce((sum, variant) => sum + variant.durationMs, 0);
  const lines = [
    '# Visual Affordance v10 — owner-directed targeted render',
    '',
    `Rendered variants: **${variants.length}** across **6 stories**.`,
    `Image-model calls: **${imageCalls}**.`,
    `Estimated image cost: **$${cost.toFixed(3)}**.`,
    `Serialized render time: **${(duration / 1000).toFixed(1)}s**.`,
    '',
    'Every row includes a labels-hidden card and the final composite. The pixels must communicate the action and outcome before labels are added.',
    '',
    '| # | Story | Variant | Mode | Calls | Geometry | Time |',
    '|---:|---|---|---|---:|---:|---:|',
  ];
  for (const variant of [...variants].sort((a, b) => a.rank - b.rank)) {
    lines.push(
      `| ${variant.rank} | ${variant.story.title.replace(/\|/g, '\\|')} | \`${variant.variantId}\` | \`${variant.treatment.renderMode}\` | ${variant.imageCalls} | ${variant.geometryIssues.length ? variant.geometryIssues.join('; ') : '✓'} | ${(variant.durationMs / 1000).toFixed(1)}s |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const source = JSON.parse(
    await readFile(INPUT_PATH, 'utf8'),
  ) as TargetStoryJson[];
  if (source.length !== 6) {
    throw new Error(`Expected six owner-rework stories; received ${source.length}.`);
  }
  await Promise.all([
    mkdir(ROOT, { recursive: true }),
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(CARD_DIR, { recursive: true }),
  ]);
  const variants: RenderVariant[] = [];
  for (const row of [...source].sort((left, right) => left.rank - right.rank)) {
    const story = storyFromJson(row);
    console.log(`[visual-v10] ${row.rank}/6 ${row.kind}: ${row.title}`);
    if (row.kind === 'deep_work_bounded_hint') {
      variants.push(...(await renderDeepWork(story)));
    } else {
      variants.push(await renderDeterministic(story, row.kind));
    }
    await writeFile(
      join(ROOT, 'render-progress.json'),
      `${JSON.stringify(
        variants.map((variant) => ({
          ...variant,
          pixelPath: rel(variant.pixelPath),
          finalPath: rel(variant.finalPath),
          pixelCardPath: rel(variant.pixelCardPath),
          finalCardPath: rel(variant.finalCardPath),
        })),
        null,
        2,
      )}\n`,
    );
  }
  const serializable = variants.map((variant) => ({
    ...variant,
    pixelPath: rel(variant.pixelPath),
    finalPath: rel(variant.finalPath),
    pixelCardPath: rel(variant.pixelCardPath),
    finalCardPath: rel(variant.finalCardPath),
  }));
  const markdown = report(variants);
  await Promise.all([
    writeFile(
      join(ROOT, 'render-manifest.json'),
      `${JSON.stringify(serializable, null, 2)}\n`,
    ),
    writeFile(join(ROOT, 'render-report.md'), markdown),
    writeFile(join(ROOT, 'contact-sheet.png'), await contactSheet(variants)),
  ]);
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
