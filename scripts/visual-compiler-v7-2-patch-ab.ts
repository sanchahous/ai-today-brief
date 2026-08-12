import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { AutoVisualClaimV5 } from '../src/lib/weekly-digest/visual-auto-claim-v5';
import { renderSpecializedVisualSvgV72 } from '../src/lib/weekly-digest/visual-specialized-svg-v7-2';
import {
  selectVisualTreatmentV72,
  type VisualTreatmentDecisionV72,
} from '../src/lib/weekly-digest/visual-treatment-v7-2';
import type { VisualRouterDecisionV7 } from '../src/lib/weekly-digest/visual-role-router-v7';

const ROOT =
  process.env.VISUAL_V7_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-v7-2-ab';
const ROUTED_PATH =
  process.env.VISUAL_V7_ROUTED_CLAIMS?.trim() ||
  'experiments/visual-compiler-v7/fresh-holdout/output-v7-1/v7-routed-claims.json';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL =
  process.env.VISUAL_V7_IMAGE_MODEL?.trim() ||
  '@cf/black-forest-labs/flux-2-klein-9b';
const IMG_W = 1280;
const IMG_H = 720;
const CARD_WIDTH = 720;
const CARD_HEADER = 156;
const CARD_IMAGE_HEIGHT = 405;
const CARD_HEIGHT = CARD_HEADER + CARD_IMAGE_HEIGHT + 18;

interface RoutedRecord {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
  router: VisualRouterDecisionV7;
}

interface ManifestAudit {
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
  mappingMode: string;
  renderMode: string;
  baselineImagePath: string;
  compilerPixelPath: string;
  compilerFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: 'current' | 'compiler';
  blindYSource: 'current' | 'compiler';
  current: ManifestAudit;
  compiler: ManifestAudit;
}

interface TreatmentRecord {
  storyId: string;
  rank: number;
  headline: string;
  eligible: boolean;
  router: VisualRouterDecisionV7;
  treatment: VisualTreatmentDecisionV72;
  compilerPixelPath: string;
  compilerFinalPath: string;
  compilerCardPath: string;
}

function assertEnvironment(records: RoutedRecord[]) {
  const requiresGeneration = records.some((record) => {
    const treatment = selectVisualTreatmentV72({
      story: record.story,
      claim: record.autoClaim,
      eligible: record.eligible,
      router: record.router,
    });
    return treatment.expectedImageCalls > 0;
  });
  if (requiresGeneration && (!CF_ACCOUNT_ID || !CF_API_TOKEN)) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for human_behavior_split.',
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
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1_000_000;
}

function rel(path: string): string {
  return relative(process.cwd(), path);
}

async function referenceBlob(bytes: Buffer): Promise<Blob> {
  const resized = await sharp(bytes)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
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

async function normalizeImage(
  bytes: Buffer,
  width = IMG_W,
  height = IMG_H,
): Promise<Buffer> {
  return sharp(bytes)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

function wrapHeadline(value: string, maxCharacters = 43): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxCharacters && lines.length < 2) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function card(headline: string, image: Buffer): Promise<Buffer> {
  const lines = wrapHeadline(headline);
  const headlineText = lines
    .map(
      (line, index) =>
        `<text x="22" y="${34 + index * 24}" font-family="DejaVu Sans,Arial,sans-serif" font-size="20" font-weight="800" fill="#F8FAFC">${xml(
          line,
        )}</text>`,
    )
    .join('');
  const header = Buffer.from(`<svg width="${CARD_WIDTH}" height="${CARD_HEADER}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#020617"/>
    ${headlineText}
    <text x="22" y="136" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="1.7" fill="#22D3EE">AI TODAY BRIEF</text>
  </svg>`);
  const body = await sharp(image)
    .resize(CARD_WIDTH - 24, CARD_IMAGE_HEIGHT, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer();
  const frame = Buffer.from(`<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${CARD_WIDTH - 2}" height="${CARD_HEIGHT - 2}" rx="20" fill="#020617" stroke="#22D3EE" stroke-opacity="0.7" stroke-width="2"/>
  </svg>`);
  return sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 3,
      background: '#020617',
    },
  })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: header, left: 0, top: 0 },
      { input: body, left: 12, top: CARD_HEADER },
    ])
    .png()
    .toBuffer();
}

function behaviorOverlay(labels: string[]): Buffer {
  const text = (label: string | undefined, x: number, primary = false) => {
    if (!label) return '';
    const fontSize = label.length > 18 ? 16 : 18;
    const width = Math.max(150, Math.min(300, Math.round(label.length * fontSize * 0.64 + 38)));
    return `<g><rect x="${x}" y="38" width="${width}" height="42" rx="21" fill="${
      primary ? '#CFFAFE' : '#083344'
    }" stroke="#22D3EE" stroke-width="1.5"/><text x="${
      x + 18
    }" y="65" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
      primary ? '#083344' : '#ECFEFF'
    }">${xml(label)}</text></g>`;
  };
  return Buffer.from(`<svg width="${IMG_W}" height="${IMG_H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="v72-behavior-vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.5"/><stop offset="0.22" stop-color="#020617" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity="0.3"/></linearGradient></defs>
    <rect width="${IMG_W}" height="${IMG_H}" fill="url(#v72-behavior-vignette)"/>
    <path d="M640 24V696" stroke="#CFFAFE" stroke-opacity="0.72" stroke-width="5"/>
    ${text(labels[0], 44, true)}
    ${text(labels[1], 700)}
    ${labels[2] ? `<g><rect x="500" y="642" width="280" height="44" rx="22" fill="#083344" fill-opacity="0.96" stroke="#34D399" stroke-width="2"/><text x="640" y="670" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="900" fill="#ECFDF5">${xml(labels[2])}</text></g>` : ''}
    <rect x="2" y="2" width="1276" height="716" rx="26" fill="none" stroke="#22D3EE" stroke-opacity="0.3" stroke-width="3"/>
  </svg>`);
}

async function composeBehavior(
  left: Buffer,
  right: Buffer,
  labels: string[],
  includeOverlays: boolean,
): Promise<Buffer> {
  const layers: OverlayOptions[] = [
    {
      input: await sharp(left)
        .resize(640, IMG_H, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 92 })
        .toBuffer(),
      left: 0,
      top: 0,
    },
    {
      input: await sharp(right)
        .resize(640, IMG_H, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 92 })
        .toBuffer(),
      left: 640,
      top: 0,
    },
  ];
  if (includeOverlays) {
    layers.push({ input: behaviorOverlay(labels), left: 0, top: 0 });
  } else {
    layers.push({
      input: Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><path d="M640 24V696" stroke="#CFFAFE" stroke-opacity="0.64" stroke-width="5"/><rect x="2" y="2" width="1276" height="716" rx="26" fill="none" stroke="#22D3EE" stroke-opacity="0.26" stroke-width="3"/></svg>`),
      left: 0,
      top: 0,
    });
  }
  return sharp({
    create: { width: IMG_W, height: IMG_H, channels: 3, background: '#020617' },
  })
    .composite(layers)
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function renderBehaviorSplit(input: {
  record: RoutedRecord;
  treatment: VisualTreatmentDecisionV72;
  assetDirectory: string;
}): Promise<{
  pixels: Buffer;
  final: Buffer;
  audit: ManifestAudit;
}> {
  const started = Date.now();
  const identityPrompt = [
    'Create a neutral cinematic identity reference for a technology editorial illustration.',
    'One adult software developer at a modern but non-branded workbench, plain dark clothing, thoughtful neutral expression, hands resting naturally, a compact abstract AI assistant device placed at the edge of the desk.',
    'Wide horizontal composition, realistic materials and human anatomy, dramatic practical light, restrained cyan and violet accents, premium magazine photography.',
    'The room, person, clothing, desk, assistant device and camera angle must be easy to preserve in two later action states.',
    'No text, letters, numbers, logos, screens with content, captions, UI, diagrams or watermarks.',
  ].join(' ');
  const identityRaw = await generateAsset({
    id: `${input.record.story.revision_item_id}:identity`,
    prompt: identityPrompt,
    width: 768,
    height: 720,
  });
  const identity = await normalizeImage(identityRaw, 768, 720);
  const passivePrompt = [
    'Use the supplied identity reference. Preserve exactly the same developer, clothing, assistant device, desk, room, camera height and lighting.',
    'Show the developer visibly passive and cognitively disengaged: sitting back, both hands away from a difficult physical architecture puzzle and blueprint on the desk.',
    'The compact AI assistant device or a small robotic arm is actively completing the whole puzzle and placing the final pieces while the developer only watches.',
    'The transfer of work from person to assistant must be unmistakable without text. The developer must not touch the task.',
    'Cinematic editorial photography, realistic anatomy and materials, clear focal action, no UI, no text, no logos, no labels, no symbols, no split screen.',
  ].join(' ');
  const activePrompt = [
    'Use the supplied identity reference. Preserve exactly the same developer, clothing, assistant device, desk, room, camera height and lighting.',
    'Show the developer actively solving the difficult physical architecture puzzle and blueprint with both hands, visibly reasoning and testing pieces.',
    'The compact AI assistant device stays physically aside and does not complete the task; it offers only one small bounded clue by illuminating a single piece while the developer performs the work.',
    'The contrast with cognitive offloading must be unmistakable: the human is doing the problem solving and the assistant is only a sparring partner.',
    'Cinematic editorial photography, realistic anatomy and materials, clear focal action, no UI, no text, no logos, no labels, no symbols, no split screen.',
  ].join(' ');
  const [passiveRaw, activeRaw] = await Promise.all([
    generateAsset({
      id: `${input.record.story.revision_item_id}:offload`,
      prompt: passivePrompt,
      width: 768,
      height: 720,
      reference: identity,
    }),
    generateAsset({
      id: `${input.record.story.revision_item_id}:sparring`,
      prompt: activePrompt,
      width: 768,
      height: 720,
      reference: identity,
    }),
  ]);
  const [passive, active] = await Promise.all([
    normalizeImage(passiveRaw, 768, 720),
    normalizeImage(activeRaw, 768, 720),
  ]);
  const identityPath = join(
    input.assetDirectory,
    `${input.record.story.rank}-${safeName(input.record.story.revision_item_id)}-v72-identity.jpg`,
  );
  const passivePath = join(
    input.assetDirectory,
    `${input.record.story.rank}-${safeName(input.record.story.revision_item_id)}-v72-offload.jpg`,
  );
  const activePath = join(
    input.assetDirectory,
    `${input.record.story.rank}-${safeName(input.record.story.revision_item_id)}-v72-sparring.jpg`,
  );
  await Promise.all([
    writeFile(identityPath, identity),
    writeFile(passivePath, passive),
    writeFile(activePath, active),
  ]);
  return {
    pixels: await composeBehavior(passive, active, input.treatment.approvedLabels, false),
    final: await composeBehavior(passive, active, input.treatment.approvedLabels, true),
    audit: {
      provider: 'cloudflare',
      model: MODEL,
      imageCalls: 3,
      estimatedImageCostUsd: 0.045,
      durationMs: Date.now() - started,
      prompt: `${identityPrompt}\n\nLEFT=${passivePrompt}\n\nRIGHT=${activePrompt}`,
      assetPaths: [identityPath, passivePath, activePath].map(rel),
    },
  };
}

async function renderDeterministic(input: {
  treatment: VisualTreatmentDecisionV72;
}): Promise<{ pixels: Buffer; final: Buffer; audit: ManifestAudit }> {
  const started = Date.now();
  const [pixels, final] = await Promise.all([
    sharp(
      renderSpecializedVisualSvgV72({
        treatment: input.treatment,
        width: IMG_W,
        height: IMG_H,
        includeOverlays: false,
      }),
    )
      .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
      .toBuffer(),
    sharp(
      renderSpecializedVisualSvgV72({
        treatment: input.treatment,
        width: IMG_W,
        height: IMG_H,
        includeOverlays: true,
      }),
    )
      .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
      .toBuffer(),
  ]);
  return {
    pixels,
    final,
    audit: {
      provider: 'local',
      model: input.treatment.treatment,
      imageCalls: 0,
      estimatedImageCostUsd: 0,
      durationMs: Date.now() - started,
      assetPaths: [],
    },
  };
}

async function rewriteBlindCards(row: ManifestRow, compilerCard: Buffer) {
  const currentCard = await readFile(
    join(ROOT, 'cards', `${row.rank}-${safeName(row.storyId)}-current.png`),
  );
  await Promise.all([
    writeFile(
      row.blindXCardPath,
      row.blindXSource === 'compiler' ? compilerCard : currentCard,
    ),
    writeFile(
      row.blindYCardPath,
      row.blindYSource === 'compiler' ? compilerCard : currentCard,
    ),
  ]);
}

async function main() {
  const assetDirectory = join(ROOT, 'assets');
  await mkdir(assetDirectory, { recursive: true });
  const [records, manifest] = await Promise.all([
    readFile(ROUTED_PATH, 'utf8').then(
      (value) => JSON.parse(value) as RoutedRecord[],
    ),
    readFile(join(ROOT, 'render-manifest.json'), 'utf8').then(
      (value) => JSON.parse(value) as ManifestRow[],
    ),
  ]);
  assertEnvironment(records);
  if (records.length !== 7 || manifest.length !== 7) {
    throw new Error(
      `Expected seven frozen records and manifest rows; got ${records.length}/${manifest.length}.`,
    );
  }

  const treatments: TreatmentRecord[] = [];
  for (const record of [...records].sort((a, b) => a.story.rank - b.story.rank)) {
    const row = manifest.find((candidate) => candidate.storyId === record.story.revision_item_id);
    if (!row) throw new Error(`Missing manifest row for ${record.story.revision_item_id}.`);
    const treatment = selectVisualTreatmentV72({
      story: record.story,
      claim: record.autoClaim,
      eligible: record.eligible,
      router: record.router,
    });
    const compilerCardPath = join(
      ROOT,
      'cards',
      `${record.story.rank}-${safeName(record.story.revision_item_id)}-compiler.png`,
    );
    if (treatment.treatment !== 'reuse_router_selection') {
      const rendered =
        treatment.treatment === 'human_behavior_split'
          ? await renderBehaviorSplit({ record, treatment, assetDirectory })
          : treatment.treatment === 'source_led_fallback'
            ? null
            : await renderDeterministic({ treatment });
      if (rendered) {
        await Promise.all([
          writeFile(row.compilerPixelPath, rendered.pixels),
          writeFile(row.compilerFinalPath, rendered.final),
        ]);
        const compilerCard = await card(record.story.title, rendered.final);
        await writeFile(compilerCardPath, compilerCard);
        await rewriteBlindCards(row, compilerCard);
        row.mappingMode = 'literal';
        row.renderMode = treatment.treatment;
        row.compiler = rendered.audit;
      }
    }
    treatments.push({
      storyId: record.story.revision_item_id,
      rank: record.story.rank,
      headline: record.story.title,
      eligible: record.eligible,
      router: record.router,
      treatment,
      compilerPixelPath: row.compilerPixelPath,
      compilerFinalPath: row.compilerFinalPath,
      compilerCardPath,
    });
  }

  await Promise.all([
    writeFile(
      join(ROOT, 'render-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    ),
    writeFile(
      join(ROOT, 'v7-2-treatments.json'),
      `${JSON.stringify(treatments, null, 2)}\n`,
    ),
    writeFile(
      join(ROOT, 'v7-2-treatment-report.md'),
      `${[
        '# Visual Compiler v7.2 — targeted treatment patch',
        '',
        '| # | Story | Treatment | Selected source | Image calls | Safety mode |',
        '|---:|---|---|---|---:|---|',
        ...treatments.map(
          (value) =>
            `| ${value.rank} | ${value.headline.replace(/\|/g, '\\|')} | \`${
              value.treatment.treatment
            }\` | ${value.treatment.selectedSource} | ${
              value.treatment.expectedImageCalls
            } | \`${value.treatment.safetyMode}\` |`,
        ),
      ].join('\n')}\n`,
    ),
  ]);
  console.log(
    `Patched ${treatments.filter((value) => value.treatment.treatment !== 'reuse_router_selection').length} of ${treatments.length} frozen stories.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
