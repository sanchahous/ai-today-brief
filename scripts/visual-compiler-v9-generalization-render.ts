import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import {
  compileAutoVisualClaimV5,
  type AutoVisualClaimV5,
} from '../src/lib/weekly-digest/visual-auto-claim-v5';
import { renderGenericVisualSvgV5 } from '../src/lib/weekly-digest/visual-generic-svg-v5';
import {
  renderSpecializedOverlaySvgV8,
  renderSpecializedVisualSvgV8,
  specializedImagePromptV8,
} from '../src/lib/weekly-digest/visual-specialized-v8';
import type { VisualRouteDecisionV9 } from '../src/lib/weekly-digest/visual-router-v9';

const INPUT_PATH =
  process.env.VISUAL_V9_ROUTED_CLAIMS?.trim() ||
  'experiments/visual-compiler-v9/generalization-2026-07-27/output/v9-routed-claims.json';
const ROOT =
  process.env.VISUAL_V9_AB_OUT_DIR?.trim() ||
  'artifacts/visual-compiler-v9-generalization-ab';
const IMAGE_DIR = join(ROOT, 'images');
const CARD_DIR = join(ROOT, 'cards');
const ASSET_DIR = join(ROOT, 'assets');
const SUPABASE_URL =
  process.env.SCRAPPER_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  '';
const SUPABASE_KEY =
  process.env.SCRAPPER_SERVICE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  '';
const REVISION_ID =
  process.env.VISUAL_V9_REVISION_ID?.trim() ||
  '1cb9dbf6-3298-4433-9213-c7c7cd592ed0';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL =
  process.env.VISUAL_V9_IMAGE_MODEL?.trim() ||
  '@cf/black-forest-labs/flux-2-klein-9b';

const IMG_W = 1280;
const IMG_H = 720;
const CARD_WIDTH = 720;
const CARD_HEADER = 156;
const CARD_IMAGE_HEIGHT = 405;
const CARD_HEIGHT = CARD_HEADER + CARD_IMAGE_HEIGHT + 18;

interface RoutedClaimRecordV9 {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
  repaired: boolean;
  router: VisualRouteDecisionV9;
}

interface ArtifactRow {
  revision_item_id: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  version: number;
  review_status: string | null;
  generation_status: string | null;
}

interface VariantAudit {
  provider: string;
  model: string;
  imageCalls: number;
  expectedProductionImageCalls: number;
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
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
  router: VisualRouteDecisionV9;
  baselineImagePath: string;
  selectedPixelPath: string;
  selectedFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: 'current' | 'selected';
  blindYSource: 'current' | 'selected';
  current: VariantAudit;
  selected: VariantAudit;
}

function assertEnvironment(records: RoutedClaimRecordV9[]) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SCRAPPER_BASE_URL and SCRAPPER_SERVICE_KEY are required.');
  }
  const needsGenerated = records.some(
    (record) => record.router.pipeline === 'specialized_source_cinematic',
  );
  if (needsGenerated && (!CF_ACCOUNT_ID || !CF_API_TOKEN)) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for specialized source-cinematic routes.',
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

async function loadApprovedCurrentImages(
  records: RoutedClaimRecordV9[],
): Promise<Map<string, Buffer>> {
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ids = records.map((record) => record.story.revision_item_id);
  const result = await db
    .from('weekly_digest_artifacts')
    .select(
      'revision_item_id,storage_bucket,storage_path,external_url,version,review_status,generation_status',
    )
    .eq('revision_id', REVISION_ID)
    .eq('artifact_type', 'story_image')
    .eq('is_current', true)
    .in('revision_item_id', ids);
  if (result.error) {
    throw new Error(`Current visual query failed: ${result.error.message}`);
  }
  const rows = (result.data ?? []) as ArtifactRow[];
  const byId = new Map(rows.map((row) => [row.revision_item_id, row]));
  const output = new Map<string, Buffer>();
  for (const record of records) {
    const row = byId.get(record.story.revision_item_id);
    if (!row) {
      throw new Error(`No current story image for ${record.story.revision_item_id}.`);
    }
    if (row.generation_status !== 'ready') {
      throw new Error(
        `Current story image is not ready for ${record.story.revision_item_id}.`,
      );
    }
    let bytes: Buffer;
    if (row.external_url) {
      const response = await fetch(row.external_url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`Current external image failed (${response.status}).`);
      }
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      if (!row.storage_bucket || !row.storage_path) {
        throw new Error(
          `Current story image has no storage location for ${record.story.revision_item_id}.`,
        );
      }
      const download = await db.storage
        .from(row.storage_bucket)
        .download(row.storage_path);
      if (download.error || !download.data) {
        throw new Error(
          `Current image download failed for ${record.story.revision_item_id}: ${download.error?.message ?? 'no data'}`,
        );
      }
      bytes = Buffer.from(await download.data.arrayBuffer());
    }
    output.set(record.story.revision_item_id, await normalizeImage(bytes));
  }
  return output;
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
  form.append('seed', String(seedFromString(`v9:${input.storyId}`)));
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

function fallbackSvg(): Buffer {
  const rails = Array.from({ length: 8 }, (_, index) => {
    const x = 110 + index * 145;
    return `<path d="M${x} 110V610" stroke="#67E8F9" stroke-opacity="${
      0.035 + index * 0.008
    }" stroke-width="2"/>`;
  }).join('');
  const nodes = Array.from({ length: 11 }, (_, index) => {
    const cx = 120 + ((index * 101) % 1040);
    const cy = 150 + ((index * 137) % 410);
    return `<circle cx="${cx}" cy="${cy}" r="${8 + (index % 3) * 4}" fill="#22D3EE" fill-opacity="${0.08 + (index % 4) * 0.025}"/>`;
  }).join('');
  return Buffer.from(`<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fallback-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#02060C"/><stop offset="0.54" stop-color="#071827"/><stop offset="1" stop-color="#12172B"/></linearGradient><radialGradient id="fallback-glow"><stop offset="0" stop-color="#22D3EE" stop-opacity="0.22"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient></defs><rect width="1280" height="720" fill="url(#fallback-bg)"/><ellipse cx="640" cy="360" rx="470" ry="280" fill="url(#fallback-glow)"/>${rails}${nodes}<path d="M240 470C365 350 470 390 575 285S805 190 1040 300" fill="none" stroke="#CFFAFE" stroke-opacity="0.14" stroke-width="6" stroke-linecap="round"/><rect x="2" y="2" width="1276" height="716" rx="30" fill="none" stroke="#22D3EE" stroke-opacity="0.25" stroke-width="3"/></svg>`);
}

async function applySpecializedOverlay(
  pixels: Buffer,
  record: RoutedClaimRecordV9,
): Promise<Buffer> {
  const treatment = record.router.specializedTreatment;
  if (!treatment) throw new Error('Specialized route has no treatment.');
  return sharp(pixels)
    .composite([
      {
        input: renderSpecializedOverlaySvgV8(treatment, IMG_W, IMG_H),
        left: 0,
        top: 0,
      },
    ])
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function renderSelected(input: {
  record: RoutedClaimRecordV9;
  current: Buffer;
}): Promise<{ pixels: Buffer; final: Buffer; audit: VariantAudit }> {
  const started = Date.now();
  const { record, current } = input;
  switch (record.router.pipeline) {
    case 'current_art_director':
      return {
        pixels: current,
        final: current,
        audit: {
          provider: 'reused',
          model: 'approved-current-art-director',
          imageCalls: 0,
          expectedProductionImageCalls: 1,
          estimatedImageCostUsd: 0.015,
          durationMs: Date.now() - started,
          assetPaths: [],
        },
      };

    case 'source_led_fallback': {
      const pixels = await sharp(fallbackSvg())
        .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
        .toBuffer();
      return {
        pixels,
        final: pixels,
        audit: {
          provider: 'local',
          model: 'neutral-source-led-fallback-v9',
          imageCalls: 0,
          expectedProductionImageCalls: 0,
          estimatedImageCostUsd: 0,
          durationMs: Date.now() - started,
          assetPaths: [],
        },
      };
    }

    case 'deterministic_compiler': {
      const plan = compileAutoVisualClaimV5(record.autoClaim);
      const pixels = await sharp(
        renderGenericVisualSvgV5({
          autoClaim: record.autoClaim,
          plan,
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
          plan,
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
          model: 'generic-deterministic-compiler-v9',
          imageCalls: 0,
          expectedProductionImageCalls: 0,
          estimatedImageCostUsd: 0,
          durationMs: Date.now() - started,
          assetPaths: [],
        },
      };
    }

    case 'specialized_deterministic': {
      const treatment = record.router.specializedTreatment;
      if (!treatment) throw new Error('Specialized deterministic route has no treatment.');
      const pixels = await sharp(
        renderSpecializedVisualSvgV8({
          treatment,
          width: IMG_W,
          height: IMG_H,
          includeOverlays: false,
        }),
      )
        .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
        .toBuffer();
      const final = await sharp(
        renderSpecializedVisualSvgV8({
          treatment,
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
          model: `specialized-${treatment.kind}-v9`,
          imageCalls: 0,
          expectedProductionImageCalls: 0,
          estimatedImageCostUsd: 0,
          durationMs: Date.now() - started,
          assetPaths: [],
        },
      };
    }

    case 'specialized_source_cinematic': {
      const treatment = record.router.specializedTreatment;
      if (!treatment) throw new Error('Specialized source-cinematic route has no treatment.');
      const prompt = specializedImagePromptV8(treatment, record.story);
      const raw = await generateImage({
        storyId: record.story.revision_item_id,
        prompt,
      });
      const pixels = await normalizeImage(raw);
      const assetPath = join(
        ASSET_DIR,
        `${record.story.rank}-${safeName(record.story.revision_item_id)}-${treatment.kind}.jpg`,
      );
      await writeFile(assetPath, pixels);
      return {
        pixels,
        final: await applySpecializedOverlay(pixels, record),
        audit: {
          provider: 'cloudflare',
          model: MODEL,
          imageCalls: 1,
          expectedProductionImageCalls: 1,
          estimatedImageCostUsd: 0.015,
          durationMs: Date.now() - started,
          prompt,
          assetPaths: [assetPath],
        },
      };
    }
  }
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
  const headerSvg = `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="26" fill="#050B12"/><rect x="1.5" y="1.5" width="${CARD_WIDTH - 3}" height="${CARD_HEIGHT - 3}" rx="24.5" fill="none" stroke="#164E63" stroke-width="3"/><text x="28" y="37" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="800" fill="#ECFEFF">${lines
    .map(
      (line, index) =>
        `<tspan x="28" dy="${index === 0 ? 0 : 30}">${xml(line)}</tspan>`,
    )
    .join('')}</text><text x="28" y="137" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.2" fill="#67E8F9">AI TODAY BRIEF</text></svg>`;
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
  const labels = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const [index, row] of rows.entries()) {
    const y = margin + index * rowH;
    for (const [column, path] of [row.blindXCardPath, row.blindYCardPath].entries()) {
      const x = margin + column * (thumbW + margin);
      const bytes = await sharp(path)
        .resize(thumbW, thumbH, { fit: 'fill' })
        .png()
        .toBuffer();
      imageLayers.push({ input: bytes, left: x, top: y + labelH });
      labels.push(
        `<text x="${x}" y="${y + 32}" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="900" fill="#67E8F9">${column === 0 ? 'X' : 'Y'}</text>`,
      );
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
  const experimentCalls = rows.reduce(
    (sum, row) => sum + row.selected.imageCalls,
    0,
  );
  const expectedProductionCalls = rows.reduce(
    (sum, row) => sum + row.selected.expectedProductionImageCalls,
    0,
  );
  const cost = rows.reduce(
    (sum, row) => sum + row.selected.estimatedImageCostUsd,
    0,
  );
  const durationMs = rows.reduce(
    (sum, row) => sum + row.selected.durationMs,
    0,
  );
  const lines = [
    '# Visual Compiler v9 frozen generalization render',
    '',
    `Stories: **${rows.length}**.`,
    `Experiment image calls: **${experimentCalls}**.`,
    `Expected production image calls: **${expectedProductionCalls}**.`,
    `Estimated production image cost: **$${cost.toFixed(3)}**.`,
    `Serialized selected-candidate time excluding reused current-art-director generation: **${(durationMs / 1000).toFixed(1)}s**.`,
    '',
    '| # | Story | Pipeline | Specialized | Experiment calls | Expected production calls | Selected time | X | Y |',
    '|---:|---|---|---|---:|---:|---:|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.router.pipeline}\` | ${row.router.specializedTreatment ? `\`${row.router.specializedTreatment.kind}\`` : '—'} | ${row.selected.imageCalls} | ${row.selected.expectedProductionImageCalls} | ${(row.selected.durationMs / 1000).toFixed(1)}s | ${row.blindXSource} | ${row.blindYSource} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const records = JSON.parse(
    await readFile(INPUT_PATH, 'utf8'),
  ) as RoutedClaimRecordV9[];
  if (records.length !== 7) {
    throw new Error(`Expected seven routed records; received ${records.length}.`);
  }
  assertEnvironment(records);
  await Promise.all([
    mkdir(ROOT, { recursive: true }),
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(CARD_DIR, { recursive: true }),
    mkdir(ASSET_DIR, { recursive: true }),
  ]);
  const currentImages = await loadApprovedCurrentImages(records);
  const rows: ManifestRow[] = [];
  for (const [index, record] of [...records]
    .sort((left, right) => left.story.rank - right.story.rank)
    .entries()) {
    console.log(
      `[v9-render] ${index + 1}/${records.length} ${record.router.pipeline}: ${record.story.title}`,
    );
    const current = currentImages.get(record.story.revision_item_id);
    if (!current) throw new Error('Current image map is incomplete.');
    const selected = await renderSelected({ record, current });
    const label = `${record.story.rank}-${safeName(record.story.revision_item_id)}`;
    const baselineImagePath = join(IMAGE_DIR, `${label}-current.jpg`);
    const selectedPixelPath = join(IMAGE_DIR, `${label}-selected-pixels.jpg`);
    const selectedFinalPath = join(IMAGE_DIR, `${label}-selected-final.jpg`);
    await Promise.all([
      writeFile(baselineImagePath, current),
      writeFile(selectedPixelPath, selected.pixels),
      writeFile(selectedFinalPath, selected.final),
    ]);
    const currentCard = await card(record.story.title, current);
    const selectedCard = await card(record.story.title, selected.final);
    const selectedIsX =
      seedFromString(`v9-generalization-blind:${record.story.revision_item_id}`) % 2 ===
      0;
    const blindXSource = selectedIsX ? 'selected' : 'current';
    const blindYSource = selectedIsX ? 'current' : 'selected';
    const blindXCardPath = join(CARD_DIR, `${label}-X.png`);
    const blindYCardPath = join(CARD_DIR, `${label}-Y.png`);
    await Promise.all([
      writeFile(blindXCardPath, selectedIsX ? selectedCard : currentCard),
      writeFile(blindYCardPath, selectedIsX ? currentCard : selectedCard),
      writeFile(join(CARD_DIR, `${label}-current.png`), currentCard),
      writeFile(join(CARD_DIR, `${label}-selected.png`), selectedCard),
    ]);
    rows.push({
      storyId: record.story.revision_item_id,
      rank: record.story.rank,
      headline: record.story.title,
      story: record.story,
      autoClaim: record.autoClaim,
      eligible: record.eligible,
      router: record.router,
      baselineImagePath,
      selectedPixelPath,
      selectedFinalPath,
      blindXCardPath,
      blindYCardPath,
      blindXSource,
      blindYSource,
      current: {
        provider: 'supabase-storage',
        model: 'approved-current-visual',
        imageCalls: 0,
        expectedProductionImageCalls: 1,
        estimatedImageCostUsd: 0.015,
        durationMs: 0,
        assetPaths: [baselineImagePath],
      },
      selected: selected.audit,
    });
    await writeFile(
      join(ROOT, 'render-progress.json'),
      `${JSON.stringify(
        rows.map((row) => ({
          ...row,
          baselineImagePath: rel(row.baselineImagePath),
          selectedPixelPath: rel(row.selectedPixelPath),
          selectedFinalPath: rel(row.selectedFinalPath),
          blindXCardPath: rel(row.blindXCardPath),
          blindYCardPath: rel(row.blindYCardPath),
          current: {
            ...row.current,
            assetPaths: row.current.assetPaths.map(rel),
          },
          selected: {
            ...row.selected,
            assetPaths: row.selected.assetPaths.map(rel),
          },
        })),
        null,
        2,
      )}\n`,
    );
  }
  const serializable = rows.map((row) => ({
    ...row,
    baselineImagePath: rel(row.baselineImagePath),
    selectedPixelPath: rel(row.selectedPixelPath),
    selectedFinalPath: rel(row.selectedFinalPath),
    blindXCardPath: rel(row.blindXCardPath),
    blindYCardPath: rel(row.blindYCardPath),
    current: {
      ...row.current,
      assetPaths: row.current.assetPaths.map(rel),
    },
    selected: {
      ...row.selected,
      assetPaths: row.selected.assetPaths.map(rel),
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
