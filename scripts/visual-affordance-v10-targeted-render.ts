import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { AutoVisualClaimV5 } from '../src/lib/weekly-digest/visual-auto-claim-v5';
import {
  affordanceImagePromptV10,
  renderAffordanceOverlaySvgV10,
  renderAffordanceVisualSvgV10,
  selectAffordanceTreatmentV10,
  type AffordanceTreatmentV10,
} from '../src/lib/weekly-digest/visual-affordance-treatment-v10';

const CLAIMS_PATH =
  process.env.VISUAL_V10_CLAIMS?.trim() ||
  'experiments/visual-compiler-v7/fresh-holdout/output/v7-routed-claims.json';
const BASELINE_ROOT =
  process.env.VISUAL_V10_BASELINE_ROOT?.trim() ||
  'artifacts/visual-compiler-v8-v4-baseline';
const ROOT =
  process.env.VISUAL_V10_OUT_DIR?.trim() ||
  'artifacts/visual-affordance-v10-targeted';
const IMAGE_DIR = join(ROOT, 'images');
const CARD_DIR = join(ROOT, 'cards');
const ASSET_DIR = join(ROOT, 'assets');
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL =
  process.env.VISUAL_V10_IMAGE_MODEL?.trim() ||
  '@cf/black-forest-labs/flux-2-klein-9b';

const IMG_W = 1280;
const IMG_H = 720;
const CARD_WIDTH = 720;
const CARD_HEADER = 156;
const CARD_IMAGE_HEIGHT = 405;
const CARD_HEIGHT = CARD_HEADER + CARD_IMAGE_HEIGHT + 18;
const TARGET_RANKS = new Set([2, 4, 5]);

interface ClaimRecord {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
}

interface VariantAudit {
  provider: string;
  model: string;
  imageCalls: number;
  estimatedImageCostUsd: number;
  durationMs: number;
  prompt?: string;
  assetPaths: string[];
}

interface ManifestRow {
  storyId: string;
  rank: number;
  headline: string;
  story: HoldoutStoryInput;
  treatment: AffordanceTreatmentV10;
  baselinePixelPath: string;
  baselineFinalPath: string;
  candidatePixelPath: string;
  candidateFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: 'v8' | 'v10';
  blindYSource: 'v8' | 'v10';
  baseline: VariantAudit;
  candidate: VariantAudit;
}

function assertEnvironment(records: ClaimRecord[]) {
  const needsGenerated = records.some((record) => {
    const treatment = selectAffordanceTreatmentV10(record);
    return treatment?.renderMode === 'generated_source_cinematic';
  });
  if (needsGenerated && (!CF_ACCOUNT_ID || !CF_API_TOKEN)) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for generated v10 treatments.',
    );
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

function safeName(value: string): string {
  return value
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1_000_000;
}

async function normalizeImage(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .resize(IMG_W, IMG_H, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
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
  if (buffer.length < 1_024) {
    throw new Error('Cloudflare returned an empty image payload.');
  }
  return buffer;
}

async function generateImage(input: {
  storyId: string;
  prompt: string;
}): Promise<Buffer> {
  const form = new FormData();
  form.append('prompt', input.prompt);
  form.append('width', String(IMG_W));
  form.append('height', String(IMG_H));
  form.append('seed', String(seedFromString(`v10:${input.storyId}`)));
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

async function applyGeneratedOverlays(
  pixels: Buffer,
  treatment: AffordanceTreatmentV10,
): Promise<Buffer> {
  return sharp(pixels)
    .composite([
      {
        input: renderAffordanceOverlaySvgV10(treatment, IMG_W, IMG_H),
        left: 0,
        top: 0,
      },
    ])
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function renderCandidate(input: {
  record: ClaimRecord;
  treatment: AffordanceTreatmentV10;
}): Promise<{ pixels: Buffer; final: Buffer; audit: VariantAudit }> {
  const started = Date.now();
  if (input.treatment.renderMode === 'deterministic') {
    const pixels = await sharp(
      renderAffordanceVisualSvgV10({
        treatment: input.treatment,
        width: IMG_W,
        height: IMG_H,
        includeOverlays: false,
      }),
    )
      .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
      .toBuffer();
    const final = await sharp(
      renderAffordanceVisualSvgV10({
        treatment: input.treatment,
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
        model: `affordance-${input.treatment.kind}-v10`,
        imageCalls: 0,
        estimatedImageCostUsd: 0,
        durationMs: Date.now() - started,
        assetPaths: [],
      },
    };
  }

  const prompt = affordanceImagePromptV10(input.treatment, input.record.story);
  const raw = await generateImage({
    storyId: input.record.story.revision_item_id,
    prompt,
  });
  const pixels = await normalizeImage(raw);
  const assetPath = join(
    ASSET_DIR,
    `${input.record.story.rank}-${safeName(input.record.story.revision_item_id)}-${input.treatment.kind}.jpg`,
  );
  await writeFile(assetPath, pixels);
  return {
    pixels,
    final: await applyGeneratedOverlays(pixels, input.treatment),
    audit: {
      provider: 'cloudflare',
      model: MODEL,
      imageCalls: 1,
      estimatedImageCostUsd: 0.015,
      durationMs: Date.now() - started,
      prompt,
      assetPaths: [assetPath],
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
  const headerSvg = `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="26" fill="#050B12"/><rect x="1.5" y="1.5" width="${CARD_WIDTH - 3}" height="${CARD_HEIGHT - 3}" rx="24.5" fill="none" stroke="#164E63" stroke-width="3"/><text x="28" y="37" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="800" fill="#ECFEFF">${lines.map((line, index) => `<tspan x="28" dy="${index === 0 ? 0 : 30}">${xml(line)}</tspan>`).join('')}</text><text x="28" y="137" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.2" fill="#67E8F9">AI TODAY BRIEF</text></svg>`;
  const resized = await sharp(image)
    .resize(CARD_WIDTH - 28, CARD_IMAGE_HEIGHT, { fit: 'cover' })
    .jpeg({ quality: 91 })
    .toBuffer();
  return sharp(Buffer.from(headerSvg))
    .composite([{ input: resized, left: 14, top: CARD_HEADER }])
    .png()
    .toBuffer();
}

async function contactSheet(rows: ManifestRow[]): Promise<Buffer> {
  const thumbW = 560;
  const thumbH = Math.round((CARD_HEIGHT / CARD_WIDTH) * thumbW);
  const margin = 28;
  const labelH = 48;
  const rowGap = 34;
  const rowH = labelH + thumbH + rowGap;
  const width = margin * 3 + thumbW * 2;
  const height = margin + rows.length * rowH;
  const imageLayers: OverlayOptions[] = [];
  const labels = [`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`];
  for (const [index, row] of rows.entries()) {
    const y = margin + index * rowH;
    for (const [column, path] of [row.blindXCardPath, row.blindYCardPath].entries()) {
      const x = margin + column * (thumbW + margin);
      const bytes = await sharp(path)
        .resize(thumbW, thumbH, { fit: 'fill' })
        .png()
        .toBuffer();
      imageLayers.push({ input: bytes, left: x, top: y + labelH });
      labels.push(`<text x="${x}" y="${y + 32}" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="900" fill="#67E8F9">${column === 0 ? 'X' : 'Y'}</text>`);
    }
  }
  labels.push('</svg>');
  return sharp({
    create: { width, height, channels: 3, background: '#03070D' },
  })
    .composite([
      ...imageLayers,
      { input: Buffer.from(labels.join('')), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/');
}

function report(rows: ManifestRow[]): string {
  const calls = rows.reduce((sum, row) => sum + row.candidate.imageCalls, 0);
  const cost = rows.reduce(
    (sum, row) => sum + row.candidate.estimatedImageCostUsd,
    0,
  );
  const durationMs = rows.reduce(
    (sum, row) => sum + row.candidate.durationMs,
    0,
  );
  const lines = [
    '# Visual Affordance v10 targeted render — V8 versus V10',
    '',
    `Stories: **${rows.length}**.`,
    `V10 image calls: **${calls}**; estimated image cost: **$${cost.toFixed(3)}**; serialized candidate time: **${(durationMs / 1000).toFixed(1)}s**.`,
    '',
    '| # | Story | V10 treatment | Grammar | Mode | Calls | X | Y |',
    '|---:|---|---|---|---|---:|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.treatment.kind}\` | \`${row.treatment.grammar}\` | \`${row.treatment.renderMode}\` | ${row.candidate.imageCalls} | ${row.blindXSource} | ${row.blindYSource} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const all = JSON.parse(await readFile(CLAIMS_PATH, 'utf8')) as ClaimRecord[];
  const records = all
    .filter((record) => TARGET_RANKS.has(record.story.rank))
    .sort((left, right) => left.story.rank - right.story.rank);
  if (records.length !== TARGET_RANKS.size) {
    throw new Error(`Expected ${TARGET_RANKS.size} targeted records; received ${records.length}.`);
  }
  assertEnvironment(records);
  await Promise.all([
    mkdir(ROOT, { recursive: true }),
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(CARD_DIR, { recursive: true }),
    mkdir(ASSET_DIR, { recursive: true }),
  ]);

  const rows: ManifestRow[] = [];
  for (const [index, record] of records.entries()) {
    const treatment = selectAffordanceTreatmentV10(record);
    if (!treatment) {
      throw new Error(`No v10 affordance treatment for ${record.story.title}.`);
    }
    console.log(`[v10-render] ${index + 1}/${records.length} ${treatment.kind}: ${record.story.title}`);
    const label = `${record.story.rank}-${safeName(record.story.revision_item_id)}`;
    const baselinePixelSource = join(
      BASELINE_ROOT,
      'images',
      `${label}-v8-pixels.jpg`,
    );
    const baselineFinalSource = join(
      BASELINE_ROOT,
      'images',
      `${label}-v8-final.jpg`,
    );
    await Promise.all([access(baselinePixelSource), access(baselineFinalSource)]);
    const baselinePixels = await normalizeImage(await readFile(baselinePixelSource));
    const baselineFinal = await normalizeImage(await readFile(baselineFinalSource));
    const candidate = await renderCandidate({ record, treatment });

    const baselinePixelPath = join(IMAGE_DIR, `${label}-v8-pixels.jpg`);
    const baselineFinalPath = join(IMAGE_DIR, `${label}-v8-final.jpg`);
    const candidatePixelPath = join(IMAGE_DIR, `${label}-v10-pixels.jpg`);
    const candidateFinalPath = join(IMAGE_DIR, `${label}-v10-final.jpg`);
    await Promise.all([
      writeFile(baselinePixelPath, baselinePixels),
      writeFile(baselineFinalPath, baselineFinal),
      writeFile(candidatePixelPath, candidate.pixels),
      writeFile(candidateFinalPath, candidate.final),
    ]);

    const baselineCard = await card(record.story.title, baselineFinal);
    const candidateCard = await card(record.story.title, candidate.final);
    const v10IsX = seedFromString(`v10-blind:${record.story.revision_item_id}`) % 2 === 0;
    const blindXSource = v10IsX ? 'v10' : 'v8';
    const blindYSource = v10IsX ? 'v8' : 'v10';
    const blindXCardPath = join(CARD_DIR, `${label}-X.png`);
    const blindYCardPath = join(CARD_DIR, `${label}-Y.png`);
    await Promise.all([
      writeFile(blindXCardPath, v10IsX ? candidateCard : baselineCard),
      writeFile(blindYCardPath, v10IsX ? baselineCard : candidateCard),
      writeFile(join(CARD_DIR, `${label}-v8.png`), baselineCard),
      writeFile(join(CARD_DIR, `${label}-v10.png`), candidateCard),
    ]);

    rows.push({
      storyId: record.story.revision_item_id,
      rank: record.story.rank,
      headline: record.story.title,
      story: record.story,
      treatment,
      baselinePixelPath,
      baselineFinalPath,
      candidatePixelPath,
      candidateFinalPath,
      blindXCardPath,
      blindYCardPath,
      blindXSource,
      blindYSource,
      baseline: {
        provider: 'reused',
        model: 'visual-compiler-v8-v4',
        imageCalls: 0,
        estimatedImageCostUsd: 0,
        durationMs: 0,
        assetPaths: [baselinePixelPath, baselineFinalPath],
      },
      candidate: candidate.audit,
    });
  }

  const serializable = rows.map((row) => ({
    ...row,
    baselinePixelPath: rel(row.baselinePixelPath),
    baselineFinalPath: rel(row.baselineFinalPath),
    candidatePixelPath: rel(row.candidatePixelPath),
    candidateFinalPath: rel(row.candidateFinalPath),
    blindXCardPath: rel(row.blindXCardPath),
    blindYCardPath: rel(row.blindYCardPath),
    baseline: {
      ...row.baseline,
      assetPaths: row.baseline.assetPaths.map(rel),
    },
    candidate: {
      ...row.candidate,
      assetPaths: row.candidate.assetPaths.map(rel),
    },
  }));

  await Promise.all([
    writeFile(
      join(ROOT, 'render-manifest.json'),
      `${JSON.stringify(serializable, null, 2)}\n`,
    ),
    writeFile(
      join(ROOT, 'blind-key.json'),
      `${JSON.stringify(
        rows.map((row) => ({
          storyId: row.storyId,
          X: row.blindXSource,
          Y: row.blindYSource,
        })),
        null,
        2,
      )}\n`,
    ),
    writeFile(join(ROOT, 'render-report.md'), report(rows)),
    writeFile(join(ROOT, 'blind-contact-sheet.png'), await contactSheet(rows)),
  ]);
  console.log(report(rows));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
