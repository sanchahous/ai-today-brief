import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type {
  OverlayGroup,
  VisualPlan,
  VisualRegion,
} from '../src/lib/weekly-digest/visual-compiler';
import { decideVisualRenderPolicy } from '../src/lib/weekly-digest/visual-render-policy';

const ROOT =
  process.env.VISUAL_COMPILER_OUT_DIR?.trim() || 'artifacts/visual-compiler-shadow-v2';
const V1_ROOT =
  process.env.VISUAL_COMPILER_V1_DIR?.trim() || 'artifacts/visual-compiler-shadow-v1';
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
  renderMode: string;
  pixelOnlyPath: string;
  finalPath: string;
  assetPaths: string[];
  imageCalls: number;
  productionImageCalls: number;
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

function regionById(plan: VisualPlan, id: string): VisualRegion {
  const region = plan.regions.find((candidate) => candidate.id === id);
  if (!region) throw new Error(`Missing region ${id} for ${plan.claim.storyId}.`);
  return region;
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
        800,
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
  reference?: Buffer;
}): Promise<Buffer> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
  }
  const form = new FormData();
  form.append('prompt', input.prompt);
  form.append('width', String(ASSET_SIZE));
  form.append('height', String(ASSET_SIZE));
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

function defs(): string {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#040A11"/><stop offset="0.52" stop-color="#0A1722"/><stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <radialGradient id="cyanGlow"><stop offset="0" stop-color="#22D3EE" stop-opacity="0.35"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient>
    <radialGradient id="heatGlow"><stop offset="0" stop-color="#FB923C" stop-opacity="0.52"/><stop offset="1" stop-color="#FB923C" stop-opacity="0"/></radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9F9FF" stop-opacity="0.2"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0.04"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#334155"/><stop offset="0.5" stop-color="#0F172A"/><stop offset="1" stop-color="#475569"/></linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000814" flood-opacity="0.8"/></filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#67E8F9"/></marker>
  </defs>`;
}

function base(): string {
  return `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <ellipse cx="640" cy="350" rx="610" ry="330" fill="url(#cyanGlow)" opacity="0.25"/>
    <path d="M0 144H1280M0 288H1280M0 432H1280M0 576H1280" stroke="#D9F9FF" stroke-opacity="0.025"/>
    <path d="M160 0V720M320 0V720M480 0V720M640 0V720M800 0V720M960 0V720M1120 0V720" stroke="#D9F9FF" stroke-opacity="0.02"/>`;
}

function overlayPills(plan: VisualPlan): string {
  const counts = new Map<string, number>();
  return plan.overlays
    .map((overlay) => {
      const region = overlay.regionId
        ? plan.regions.find((candidate) => candidate.id === overlay.regionId)
        : plan.regions[0];
      if (!region) return '';
      const box = bounds(region);
      const index = counts.get(region.id) ?? 0;
      counts.set(region.id, index + 1);
      const primary = overlay.importance === 'primary';
      const fontSize = overlay.text.length > 22 ? 16 : 18;
      const width = Math.min(
        Math.max(112, Math.round(overlay.text.length * fontSize * 0.62 + 34)),
        Math.max(112, box.width - 22),
      );
      const x = box.left + 12;
      const y = box.top + 12 + index * 46;
      return `<g><rect x="${x}" y="${y}" width="${width}" height="38" rx="19" fill="${
        primary ? '#CFFAFE' : '#083344'
      }" fill-opacity="0.96" stroke="#67E8F9" stroke-width="1.5"/><text x="${
        x + 17
      }" y="${y + 25}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
        primary ? '#083344' : '#ECFEFF'
      }">${xml(overlay.text)}</text></g>`;
    })
    .join('');
}

function energySvg(plan: VisualPlan, labels: boolean): Buffer {
  const contextBlocks = Array.from({ length: 7 }, (_, index) => {
    const angle = (-115 + index * 38) * (Math.PI / 180);
    const x = 934 + Math.cos(angle) * 190;
    const y = 356 + Math.sin(angle) * 190;
    return `<rect x="${x - 34}" y="${y - 20}" width="68" height="40" rx="10" fill="#0E7490" fill-opacity="${
      0.55 + index * 0.04
    }" stroke="#A5F3FC" stroke-opacity="0.8"/>`;
  }).join('');
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">${defs()}${base()}
    <g filter="url(#shadow)">
      <rect x="72" y="100" width="430" height="520" rx="38" fill="#06111B" stroke="#164E63" stroke-width="2"/>
      <path d="M178 282h84c18 0 32 14 32 32v32c0 18-14 32-32 32h-24l-30 31v-31h-30c-18 0-32-14-32-32v-32c0-18 14-32 32-32Z" fill="url(#glass)" stroke="#67E8F9" stroke-width="3"/>
      <rect x="340" y="286" width="104" height="104" rx="24" fill="url(#metal)" stroke="#67E8F9" stroke-width="3"/>
      <path d="M294 336H340" stroke="#67E8F9" stroke-width="7" marker-end="url(#arrow)"/>
      <path d="M366 318h52M366 342h52M366 366h52" stroke="#CFFAFE" stroke-opacity="0.65" stroke-width="7" stroke-linecap="round"/>
    </g>
    <g filter="url(#shadow)">
      <rect x="610" y="100" width="598" height="520" rx="38" fill="#06111B" stroke="#164E63" stroke-width="2"/>
      <ellipse cx="934" cy="356" rx="250" ry="250" fill="url(#heatGlow)" filter="url(#soft)"/>
      <rect x="854" y="276" width="160" height="160" rx="34" fill="url(#metal)" stroke="#FB923C" stroke-width="5"/>
      <path d="M888 316h92M888 356h92M888 396h92" stroke="#FED7AA" stroke-width="9" stroke-linecap="round"/>
      ${contextBlocks}
      <path d="M 754 456 C 650 170, 1135 100, 1152 390 C 1164 565, 947 614, 790 520" fill="none" stroke="#67E8F9" stroke-width="7" marker-end="url(#arrow)"/>
      <path d="M742 358H838" stroke="#67E8F9" stroke-width="7" marker-end="url(#arrow)"/>
    </g>
    <path d="M518 360H592" stroke="#67E8F9" stroke-opacity="0.78" stroke-width="6" marker-end="url(#arrow)"/>
    ${labels ? overlayPills(plan) : ''}</svg>`;
  return Buffer.from(svg);
}

function kitesurfSvg(plan: VisualPlan, labels: boolean): Buffer {
  const browserLayers = [0, 1, 2, 3].map((index) => {
    const x = 92 + index * 18;
    const y = 178 - index * 15;
    return `<g transform="translate(${x} ${y})"><rect width="390" height="330" rx="28" fill="#07131E" stroke="#67E8F9" stroke-opacity="${
      0.42 + index * 0.13
    }" stroke-width="3"/><rect x="18" y="18" width="354" height="42" rx="16" fill="#164E63" fill-opacity="0.55"/><circle cx="42" cy="39" r="7" fill="#67E8F9"/><circle cx="66" cy="39" r="7" fill="#A78BFA"/><circle cx="90" cy="39" r="7" fill="#FB7185"/><path d="M42 108h282M42 152h230M42 196h274M42 240h194" stroke="#CFFAFE" stroke-opacity="0.18" stroke-width="12" stroke-linecap="round"/></g>`;
  }).join('');
  const removed = [0, 1, 2].map((index) => `<rect x="550" y="${214 + index * 78}" width="132" height="62" rx="18" fill="#22D3EE" fill-opacity="${0.08 + index * 0.04}" stroke="#67E8F9" stroke-width="2" stroke-dasharray="10 8" transform="rotate(${-5 + index * 5} 616 ${245 + index * 78})"/>`).join('');
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">${defs()}${base()}
    <g filter="url(#shadow)">${browserLayers}</g>
    ${removed}
    <path d="M488 356H538" stroke="#67E8F9" stroke-width="6" marker-end="url(#arrow)"/>
    <path d="M692 356H760" stroke="#67E8F9" stroke-width="6" marker-end="url(#arrow)"/>
    <g filter="url(#shadow)">
      <rect x="780" y="196" width="380" height="330" rx="36" fill="#06111B" stroke="#67E8F9" stroke-width="4"/>
      <rect x="816" y="232" width="180" height="244" rx="28" fill="url(#metal)" stroke="#A5F3FC" stroke-width="3"/>
      <path d="M846 282h120M846 326h94M846 370h120M846 414h76" stroke="#CFFAFE" stroke-opacity="0.5" stroke-width="11" stroke-linecap="round"/>
      <g transform="translate(1032 266)"><circle cx="38" cy="38" r="30" fill="#22D3EE" fill-opacity="0.2" stroke="#67E8F9" stroke-width="3"/><circle cx="38" cy="38" r="9" fill="#CFFAFE"/><path d="M38 68v74M8 112h60" stroke="#67E8F9" stroke-width="5"/></g>
      <path d="M996 352h56" stroke="#67E8F9" stroke-width="5" marker-end="url(#arrow)"/>
    </g>
    ${labels ? overlayPills(plan) : ''}</svg>`;
  return Buffer.from(svg);
}

function denseModule(x: number, y: number): string {
  const cells = Array.from({ length: 48 }, (_, index) => {
    const col = index % 8;
    const row = Math.floor(index / 8);
    return `<rect x="${x + 36 + col * 32}" y="${y + 70 + row * 32}" width="20" height="20" rx="5" fill="#67E8F9" fill-opacity="${0.35 + ((col + row) % 3) * 0.18}"/>`;
  }).join('');
  return `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="330" height="330" rx="34" fill="#06111B" stroke="#67E8F9" stroke-width="3"/>${cells}<path d="M${x + 42} ${y + 280}h244" stroke="#CFFAFE" stroke-opacity="0.22" stroke-width="10" stroke-linecap="round"/></g>`;
}

function moeModule(x: number, y: number): string {
  const nodes = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * 45 - 90) * (Math.PI / 180);
    const cx = x + 165 + Math.cos(angle) * 108;
    const cy = y + 166 + Math.sin(angle) * 108;
    const active = index === 1 || index === 5;
    return `<circle cx="${cx}" cy="${cy}" r="25" fill="${active ? '#67E8F9' : '#0F2A37'}" fill-opacity="${active ? '0.92' : '0.9'}" stroke="#A5F3FC" stroke-opacity="${active ? '1' : '0.35'}" stroke-width="3"/>${active ? `<path d="M${x + 165} ${y + 166}L${cx} ${cy}" stroke="#67E8F9" stroke-width="5"/>` : ''}`;
  }).join('');
  return `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="330" height="330" rx="34" fill="#06111B" stroke="#67E8F9" stroke-width="3"/><circle cx="${x + 165}" cy="${y + 166}" r="42" fill="#164E63" stroke="#67E8F9" stroke-width="4"/>${nodes}</g>`;
}

function routingSvg(plan: VisualPlan, labels: boolean): Buffer {
  const qwen = plan.claim.storyId === 'qwen-local-routing';
  const left = qwen
    ? denseModule(72, 184)
    : `<g filter="url(#shadow)"><rect x="72" y="184" width="330" height="330" rx="34" fill="#06111B" stroke="#67E8F9" stroke-width="3"/><circle cx="210" cy="324" r="72" fill="none" stroke="#67E8F9" stroke-width="12"/><path d="M260 374l70 70" stroke="#67E8F9" stroke-width="16" stroke-linecap="round"/><rect x="126" y="426" width="108" height="52" rx="12" fill="url(#glass)" stroke="#A5F3FC"/><rect x="244" y="410" width="112" height="68" rx="12" fill="url(#glass)" stroke="#A5F3FC"/></g>`;
  const right = qwen
    ? moeModule(878, 184)
    : `<g filter="url(#shadow)"><rect x="878" y="184" width="330" height="330" rx="34" fill="#06111B" stroke="#67E8F9" stroke-width="3"/><path d="M946 284l38 38-38 38M1140 284l-38 38 38 38" fill="none" stroke="#67E8F9" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="1042" cy="420" r="28" fill="#164E63" stroke="#67E8F9" stroke-width="3"/><circle cx="952" cy="442" r="18" fill="#0F2A37" stroke="#A5F3FC"/><circle cx="1132" cy="442" r="18" fill="#0F2A37" stroke="#A5F3FC"/><path d="M970 438l44-14M1070 424l44 14" stroke="#67E8F9" stroke-width="5"/></g>`;
  const sourceIcon = qwen
    ? `<rect x="574" y="290" width="132" height="132" rx="32" fill="url(#metal)" stroke="#67E8F9" stroke-width="4"/><path d="M606 326h68M606 358h68M606 390h42" stroke="#CFFAFE" stroke-width="8" stroke-linecap="round"/>`
    : `<rect x="566" y="286" width="148" height="140" rx="28" fill="#050B12" stroke="#67E8F9" stroke-width="4"/><path d="M598 330l24 22-24 22M642 374h38" fill="none" stroke="#CFFAFE" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  const returnPath = qwen
    ? ''
    : `<path d="M232 536 C 356 620, 510 610, 620 454 M1044 536 C 920 620, 770 610, 660 454" fill="none" stroke="#A5F3FC" stroke-opacity="0.42" stroke-width="4" stroke-dasharray="12 10" marker-end="url(#arrow)"/>`;
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">${defs()}${base()}${left}${right}
    <g filter="url(#shadow)">${sourceIcon}</g>
    <path d="M574 356 C 500 320, 466 320, 416 350" fill="none" stroke="#67E8F9" stroke-width="6" marker-end="url(#arrow)"/>
    <path d="M706 356 C 780 320, 814 320, 864 350" fill="none" stroke="#67E8F9" stroke-width="6" marker-end="url(#arrow)"/>
    ${returnPath}
    ${labels ? overlayPills(plan) : ''}</svg>`;
  return Buffer.from(svg);
}

async function svgJpeg(svg: Buffer): Promise<Buffer> {
  return sharp(svg).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer();
}

async function roundedAsset(bytes: Buffer, region: VisualRegion): Promise<Buffer> {
  const box = bounds(region);
  const radius = Math.min(30, Math.round(Math.min(box.width, box.height) * 0.07));
  const mask = Buffer.from(
    `<svg width="${box.width}" height="${box.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${radius}" fill="white"/></svg>`,
  );
  return sharp(bytes)
    .resize(box.width, box.height, { fit: 'cover', position: 'attention' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function generatedStructure(plan: VisualPlan, labels: boolean): Buffer {
  const parts = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">${defs()}`,
  ];
  if (plan.format === 'cinematic_sequence') {
    parts.push(
      '<path d="M405 360H448" stroke="#67E8F9" stroke-width="5" marker-end="url(#arrow)"/><path d="M822 360H865" stroke="#67E8F9" stroke-width="5" marker-end="url(#arrow)"/>',
    );
  } else if (plan.format === 'cinematic_split') {
    parts.push('<path d="M640 90V630" stroke="#67E8F9" stroke-opacity="0.35" stroke-width="2"/>');
  }
  if (labels) parts.push(overlayPills(plan));
  parts.push('</svg>');
  return Buffer.from(parts.join(''));
}

async function composeGenerated(
  plan: VisualPlan,
  assetsByRegion: Map<string, Buffer>,
  labels: boolean,
): Promise<Buffer> {
  const layers: OverlayOptions[] = [];
  for (const [regionId, asset] of assetsByRegion) {
    const region = regionById(plan, regionId);
    const box = bounds(region);
    layers.push({ input: await roundedAsset(asset, region), left: box.left, top: box.top });
  }
  layers.push({ input: generatedStructure(plan, labels), left: 0, top: 0 });
  return sharp(Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">${defs()}${base()}</svg>`))
    .composite(layers)
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

function tutorPrompts(): { reference: string; left: string; right: string } {
  const common =
    'Premium cinematic editorial photograph, the same adult learner and the same calm tutoring assistant seated across one table with colorful wooden construction blocks, realistic hands and anatomy, coherent modern learning studio, dramatic available window light, restrained teal grade, no screens, no signs, no printed material, no text, no letters, no numbers, no logos, no watermark, no infographic, no split screen.';
  return {
    reference: `${common} Neutral identity reference only: both people are visible from the waist up, both keep their hands resting away from the blocks, the half-built tower sits centered between them, balanced composition.`,
    left: `${common} Use image 0 only for the exact identities, clothing, room, table and camera. Change the action decisively: the tutoring assistant leans over and uses both hands to grab and rearrange several blocks at once; the learner's hands are withdrawn and open, visibly unable to act, passive posture. Clear intrusive over-helping, not collaboration.`,
    right: `${common} Use image 0 only for the exact identities, clothing, room, table and camera. Change the action decisively: the learner actively places the next block with both hands; the tutoring assistant sits back with both hands clasped together on their lap, visibly not touching any block, attentive but restrained. The learner owns the task.`,
  };
}

function codexPrompts(): { left: string; right: string } {
  const common =
    'Cinematic editorial concept photograph of a physical miniature 3D game arena under dramatic studio light, consistent stylized white humanoid sub-agent figures with no faces, believable materials, no screens, no UI, no text, no letters, no numbers, no logos, no watermark, no infographic.';
  return {
    left: `${common} Several sub-agent figures rapidly assemble the arena: one places a bridge, one mounts a character, one carries a terrain piece. The scene is visibly becoming playable and coherent. Wide composition with the complete arena and all builders visible.`,
    right: `${common} Use image 0 as the exact arena, agent and camera reference. The arena is now finished and polished except for one large central object with an unmistakable bright magenta-and-black checkerboard missing-texture material. A compact inspection camera shines a green approval light while every agent looks satisfied and away from the obvious defect.`,
  };
}

async function saveAsset(name: string, bytes: Buffer): Promise<string> {
  const path = join(ASSET_DIR, name);
  await sharp(bytes).png().toFile(path);
  return path;
}

async function renderDeterministic(record: PlanRecord): Promise<RenderedRecord> {
  const plan = record.plan;
  let pixelsSvg: Buffer;
  let finalSvg: Buffer;
  switch (plan.claim.storyId) {
    case 'energy-600x':
      pixelsSvg = energySvg(plan, false);
      finalSvg = energySvg(plan, true);
      break;
    case 'kitesurf-browser':
      pixelsSvg = kitesurfSvg(plan, false);
      finalSvg = kitesurfSvg(plan, true);
      break;
    case 'qwen-local-routing':
    case 'anthropic-cli-tools':
      pixelsSvg = routingSvg(plan, false);
      finalSvg = routingSvg(plan, true);
      break;
    default:
      throw new Error(`No deterministic template for ${plan.claim.storyId}.`);
  }
  const pixelOnlyPath = join(IMAGE_DIR, `${record.rank}-${plan.claim.storyId}-pixels.jpg`);
  const finalPath = join(IMAGE_DIR, `${record.rank}-${plan.claim.storyId}-final.jpg`);
  await Promise.all([
    writeFile(pixelOnlyPath, await svgJpeg(pixelsSvg)),
    writeFile(finalPath, await svgJpeg(finalSvg)),
  ]);
  const policy = decideVisualRenderPolicy(plan);
  return {
    rank: record.rank,
    headline: record.headline,
    storyId: plan.claim.storyId,
    format: plan.format,
    renderMode: policy.mode,
    pixelOnlyPath,
    finalPath,
    assetPaths: [],
    imageCalls: 0,
    productionImageCalls: policy.imageCalls,
    estimatedCostUsd: policy.estimatedCostUsd,
  };
}

async function reuseMuse(record: PlanRecord): Promise<RenderedRecord> {
  const storyId = record.plan.claim.storyId;
  const assetsByRegion = new Map<string, Buffer>();
  const assetPaths: string[] = [];
  for (let index = 1; index <= 3; index += 1) {
    const source = join(V1_ROOT, 'assets', `2-muse-resume-asset-${index}.png`);
    const target = join(ASSET_DIR, `2-muse-resume-asset-${index}.png`);
    await copyFile(source, target);
    assetsByRegion.set(`state-${index}`, await readFile(source));
    assetPaths.push(target);
  }
  const pixelOnlyPath = join(IMAGE_DIR, '2-muse-resume-pixels.jpg');
  const finalPath = join(IMAGE_DIR, '2-muse-resume-final.jpg');
  await Promise.all([
    writeFile(pixelOnlyPath, await composeGenerated(record.plan, assetsByRegion, false)),
    writeFile(finalPath, await composeGenerated(record.plan, assetsByRegion, true)),
  ]);
  const policy = decideVisualRenderPolicy(record.plan);
  return {
    rank: record.rank,
    headline: record.headline,
    storyId,
    format: record.plan.format,
    renderMode: policy.mode,
    pixelOnlyPath,
    finalPath,
    assetPaths,
    imageCalls: 0,
    productionImageCalls: policy.imageCalls,
    estimatedCostUsd: policy.estimatedCostUsd,
  };
}

async function renderTutor(record: PlanRecord): Promise<RenderedRecord> {
  const prompts = tutorPrompts();
  console.log('[v2 render] tutor identity reference');
  const reference = await generateAsset({ id: 'tutor-v2-reference', prompt: prompts.reference });
  console.log('[v2 render] tutor over-help action');
  const left = await generateAsset({ id: 'tutor-v2-left', prompt: prompts.left, reference });
  console.log('[v2 render] tutor restraint action');
  const right = await generateAsset({ id: 'tutor-v2-right', prompt: prompts.right, reference });
  const assetPaths = await Promise.all([
    saveAsset('5-tutor-reference.png', reference),
    saveAsset('5-tutor-left.png', left),
    saveAsset('5-tutor-right.png', right),
  ]);
  const assetsByRegion = new Map([
    ['left', left],
    ['right', right],
  ]);
  const pixelOnlyPath = join(IMAGE_DIR, '5-tutor-restraint-pixels.jpg');
  const finalPath = join(IMAGE_DIR, '5-tutor-restraint-final.jpg');
  await Promise.all([
    writeFile(pixelOnlyPath, await composeGenerated(record.plan, assetsByRegion, false)),
    writeFile(finalPath, await composeGenerated(record.plan, assetsByRegion, true)),
  ]);
  const policy = decideVisualRenderPolicy(record.plan);
  return {
    rank: record.rank,
    headline: record.headline,
    storyId: record.plan.claim.storyId,
    format: record.plan.format,
    renderMode: policy.mode,
    pixelOnlyPath,
    finalPath,
    assetPaths,
    imageCalls: 3,
    productionImageCalls: policy.imageCalls,
    estimatedCostUsd: policy.estimatedCostUsd,
  };
}

async function renderCodex(record: PlanRecord): Promise<RenderedRecord> {
  const prompts = codexPrompts();
  console.log('[v2 render] Codex build action');
  const left = await generateAsset({ id: 'codex-v2-left', prompt: prompts.left });
  console.log('[v2 render] Codex inspection miss');
  const right = await generateAsset({ id: 'codex-v2-right', prompt: prompts.right, reference: left });
  const assetPaths = await Promise.all([
    saveAsset('7-codex-left.png', left),
    saveAsset('7-codex-right.png', right),
  ]);
  const assetsByRegion = new Map([
    ['left', left],
    ['right', right],
  ]);
  const pixelOnlyPath = join(IMAGE_DIR, '7-codex-visual-inspection-gap-pixels.jpg');
  const finalPath = join(IMAGE_DIR, '7-codex-visual-inspection-gap-final.jpg');
  await Promise.all([
    writeFile(pixelOnlyPath, await composeGenerated(record.plan, assetsByRegion, false)),
    writeFile(finalPath, await composeGenerated(record.plan, assetsByRegion, true)),
  ]);
  const policy = decideVisualRenderPolicy(record.plan);
  return {
    rank: record.rank,
    headline: record.headline,
    storyId: record.plan.claim.storyId,
    format: record.plan.format,
    renderMode: policy.mode,
    pixelOnlyPath,
    finalPath,
    assetPaths,
    imageCalls: 2,
    productionImageCalls: policy.imageCalls,
    estimatedCostUsd: policy.estimatedCostUsd,
  };
}

async function main() {
  await Promise.all([
    mkdir(ROOT, { recursive: true }),
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(ASSET_DIR, { recursive: true }),
  ]);
  const plans = JSON.parse(await readFile(join(ROOT, 'plans.json'), 'utf8')) as PlanRecord[];
  const rendered: RenderedRecord[] = [];
  for (const record of plans) {
    const policy = decideVisualRenderPolicy(record.plan);
    console.log(`[v2 policy] ${record.rank}/${record.plan.claim.storyId}: ${policy.mode}`);
    if (policy.mode === 'deterministic_vector') {
      rendered.push(await renderDeterministic(record));
    } else if (record.plan.claim.storyId === 'muse-resume') {
      rendered.push(await reuseMuse(record));
    } else if (record.plan.claim.storyId === 'tutor-restraint') {
      rendered.push(await renderTutor(record));
    } else if (record.plan.claim.storyId === 'codex-visual-inspection-gap') {
      rendered.push(await renderCodex(record));
    } else {
      throw new Error(`No v2 renderer for ${record.plan.claim.storyId}/${policy.mode}.`);
    }
  }
  await writeFile(join(ROOT, 'render-manifest.json'), `${JSON.stringify(rendered, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        stories: rendered.length,
        newImageCalls: rendered.reduce((sum, record) => sum + record.imageCalls, 0),
        productionImageCalls: rendered.reduce(
          (sum, record) => sum + record.productionImageCalls,
          0,
        ),
        estimatedAcceptedImageCostUsd: rendered.reduce(
          (sum, record) => sum + record.estimatedCostUsd,
          0,
        ),
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
