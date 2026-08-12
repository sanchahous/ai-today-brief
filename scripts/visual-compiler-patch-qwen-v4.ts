import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { OverlayGroup, VisualPlan, VisualRegion } from '../src/lib/weekly-digest/visual-compiler';

const ROOT =
  process.env.VISUAL_COMPILER_OUT_DIR?.trim() || 'artifacts/visual-compiler-shadow-v4';
const WIDTH = 1280;
const HEIGHT = 720;

interface PlanRecord {
  rank: number;
  headline: string;
  plan: VisualPlan;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function bounds(region: VisualRegion) {
  return {
    left: Math.round(region.bounds.x * WIDTH),
    top: Math.round(region.bounds.y * HEIGHT),
    width: Math.max(1, Math.round(region.bounds.width * WIDTH)),
    height: Math.max(1, Math.round(region.bounds.height * HEIGHT)),
  };
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
      const fontSize = overlay.text.length > 22 ? 16 : 18;
      const width = Math.min(
        Math.max(112, Math.round(overlay.text.length * fontSize * 0.62 + 34)),
        Math.max(112, box.width - 22),
      );
      const x = box.left + 12;
      const y = box.top + 12 + index * 46;
      return `<g>
        <rect x="${x}" y="${y}" width="${width}" height="38" rx="19" fill="${
          primary ? '#CFFAFE' : '#083344'
        }" fill-opacity="0.96" stroke="#67E8F9" stroke-width="1.5"/>
        <text x="${x + 17}" y="${y + 25}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
          primary ? '#083344' : '#ECFEFF'
        }">${xml(overlay.text)}</text>
      </g>`;
    })
    .join('');
}

function defs(): string {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#040A11"/>
      <stop offset="0.52" stop-color="#0A1722"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <radialGradient id="cyanGlow">
      <stop offset="0" stop-color="#22D3EE" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#334155"/>
      <stop offset="0.5" stop-color="#0F172A"/>
      <stop offset="1" stop-color="#475569"/>
    </linearGradient>
    <linearGradient id="success" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#34D399"/>
      <stop offset="1" stop-color="#0F766E"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000814" flood-opacity="0.82"/>
    </filter>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#67E8F9"/>
    </marker>
  </defs>`;
}

function base(): string {
  return `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <ellipse cx="640" cy="350" rx="610" ry="330" fill="url(#cyanGlow)" opacity="0.24"/>
    <path d="M0 144H1280M0 288H1280M0 432H1280M0 576H1280" stroke="#D9F9FF" stroke-opacity="0.025"/>
    <path d="M160 0V720M320 0V720M480 0V720M640 0V720M800 0V720M960 0V720M1120 0V720" stroke="#D9F9FF" stroke-opacity="0.02"/>`;
}

function denseEngine(): string {
  const cells = Array.from({ length: 48 }, (_, index) => {
    const column = index % 8;
    const row = Math.floor(index / 8);
    const opacity = 0.38 + ((column * 2 + row) % 4) * 0.14;
    return `<rect x="${102 + column * 28}" y="${176 + row * 28}" width="17" height="17" rx="4" fill="#67E8F9" fill-opacity="${opacity}"/>`;
  }).join('');
  return `<g filter="url(#shadow)">
    <rect x="66" y="116" width="330" height="320" rx="34" fill="#06111B" stroke="#67E8F9" stroke-width="3"/>
    ${cells}
    <path d="M104 374h252" stroke="#CFFAFE" stroke-opacity="0.2" stroke-width="9" stroke-linecap="round"/>
  </g>`;
}

function moeEngine(): string {
  const nodes = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * 45 - 90) * (Math.PI / 180);
    const cx = 1049 + Math.cos(angle) * 102;
    const cy = 274 + Math.sin(angle) * 102;
    const active = index === 1 || index === 5;
    return `<circle cx="${cx}" cy="${cy}" r="24" fill="${
      active ? '#67E8F9' : '#0F2A37'
    }" fill-opacity="${active ? '0.92' : '0.9'}" stroke="#A5F3FC" stroke-opacity="${
      active ? '1' : '0.35'
    }" stroke-width="3"/>${
      active
        ? `<path d="M1049 274L${cx} ${cy}" stroke="#67E8F9" stroke-width="5"/>`
        : ''
    }`;
  }).join('');
  return `<g filter="url(#shadow)">
    <rect x="884" y="116" width="330" height="320" rx="34" fill="#06111B" stroke="#67E8F9" stroke-width="3"/>
    <circle cx="1049" cy="274" r="42" fill="#164E63" stroke="#67E8F9" stroke-width="4"/>
    ${nodes}
  </g>`;
}

function router(): string {
  return `<g filter="url(#shadow)">
    <rect x="556" y="218" width="168" height="150" rx="34" fill="url(#metal)" stroke="#67E8F9" stroke-width="4"/>
    <path d="M592 260h96M592 296h96M592 332h58" stroke="#CFFAFE" stroke-width="9" stroke-linecap="round"/>
  </g>
  <path d="M556 292C500 244 458 240 412 272" fill="none" stroke="#67E8F9" stroke-width="7" marker-end="url(#arrow)"/>
  <path d="M724 292C780 244 822 240 868 272" fill="none" stroke="#67E8F9" stroke-width="7" marker-end="url(#arrow)"/>`;
}

function codeOutcome(): string {
  return `<g filter="url(#shadow)">
    <path d="M118 476h198l44 44v118H118Z" fill="#07131E" stroke="#67E8F9" stroke-width="3"/>
    <path d="M316 476v44h44" fill="#0E7490" fill-opacity="0.28" stroke="#67E8F9" stroke-width="3"/>
    <path d="M162 528l-24 22 24 22M246 528l24 22-24 22" fill="none" stroke="#A5F3FC" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M186 598h96" stroke="#67E8F9" stroke-width="9" stroke-linecap="round"/>
    <circle cx="330" cy="602" r="32" fill="url(#success)" stroke="#A7F3D0" stroke-width="3"/>
    <path d="M314 602l11 12 22-28" fill="none" stroke="#ECFDF5" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M230 436V466" stroke="#67E8F9" stroke-width="6" marker-end="url(#arrow)"/>
  </g>`;
}

function systemOutcome(): string {
  return `<g filter="url(#shadow)">
    <rect x="898" y="482" width="302" height="154" rx="28" fill="#07131E" stroke="#67E8F9" stroke-width="3"/>
    <path d="M942 530l24 22-24 22M990 574h42" fill="none" stroke="#A5F3FC" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M1072 518v80M1072 538h58M1130 538v-22M1130 538v22" fill="none" stroke="#67E8F9" stroke-width="6" stroke-linecap="round"/>
    <circle cx="1072" cy="518" r="10" fill="#CFFAFE"/>
    <circle cx="1130" cy="516" r="10" fill="#CFFAFE"/>
    <circle cx="1130" cy="560" r="10" fill="#CFFAFE"/>
    <circle cx="1162" cy="598" r="27" fill="url(#success)" stroke="#A7F3D0" stroke-width="3"/>
    <path d="M1148 598l10 11 19-24" fill="none" stroke="#ECFDF5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M1049 436V468" stroke="#67E8F9" stroke-width="6" marker-end="url(#arrow)"/>
  </g>`;
}

function localBoundary(): string {
  return `<path d="M44 86H1236V662H44Z" fill="none" stroke="#67E8F9" stroke-opacity="0.14" stroke-width="2" stroke-dasharray="10 12"/>`;
}

function qwenSvg(plan: VisualPlan, labels: boolean): Buffer {
  return Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${defs()}${base()}${localBoundary()}${denseEngine()}${moeEngine()}${router()}${codeOutcome()}${systemOutcome()}
      ${labels ? overlayPills(plan) : ''}
    </svg>`,
  );
}

async function toJpeg(svg: Buffer): Promise<Buffer> {
  return sharp(svg).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
}

async function main() {
  const plans = JSON.parse(await readFile(join(ROOT, 'plans.json'), 'utf8')) as PlanRecord[];
  const qwen = plans.find((record) => record.plan.claim.storyId === 'qwen-local-routing');
  if (!qwen) throw new Error('Qwen routing story plan not found.');
  const pixelPath = join(ROOT, 'images', '4-qwen-local-routing-pixels.jpg');
  const finalPath = join(ROOT, 'images', '4-qwen-local-routing-final.jpg');
  await Promise.all([
    writeFile(pixelPath, await toJpeg(qwenSvg(qwen.plan, false))),
    writeFile(finalPath, await toJpeg(qwenSvg(qwen.plan, true))),
  ]);
  console.log(JSON.stringify({ pixelPath, finalPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
