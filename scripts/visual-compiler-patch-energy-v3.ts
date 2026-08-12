import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { OverlayGroup, VisualPlan, VisualRegion } from '../src/lib/weekly-digest/visual-compiler';

const ROOT =
  process.env.VISUAL_COMPILER_OUT_DIR?.trim() || 'artifacts/visual-compiler-shadow-v3';
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
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#334155"/>
      <stop offset="0.5" stop-color="#0F172A"/>
      <stop offset="1" stop-color="#475569"/>
    </linearGradient>
    <radialGradient id="cyanGlow">
      <stop offset="0" stop-color="#22D3EE" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="heatGlow">
      <stop offset="0" stop-color="#FDBA74" stop-opacity="0.78"/>
      <stop offset="0.42" stop-color="#F97316" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#EF4444" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000814" flood-opacity="0.8"/>
    </filter>
    <filter id="blur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#67E8F9"/>
    </marker>
  </defs>`;
}

function base(): string {
  return `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <ellipse cx="640" cy="350" rx="610" ry="330" fill="url(#cyanGlow)" opacity="0.22"/>
    <path d="M0 144H1280M0 288H1280M0 432H1280M0 576H1280" stroke="#D9F9FF" stroke-opacity="0.025"/>
    <path d="M160 0V720M320 0V720M480 0V720M640 0V720M800 0V720M960 0V720M1120 0V720" stroke="#D9F9FF" stroke-opacity="0.02"/>`;
}

function meter(input: {
  x: number;
  y: number;
  radius: number;
  hot: boolean;
}): string {
  const { x, y, radius, hot } = input;
  const start = Math.PI * 0.82;
  const end = Math.PI * 2.18;
  const segments = Array.from({ length: 9 }, (_, index) => {
    const angle = start + ((end - start) * index) / 8;
    const x1 = x + Math.cos(angle) * (radius - 13);
    const y1 = y + Math.sin(angle) * (radius - 13);
    const x2 = x + Math.cos(angle) * (radius + 2);
    const y2 = y + Math.sin(angle) * (radius + 2);
    const active = hot ? index <= 7 : index <= 1;
    return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${
      active ? (hot ? '#FB923C' : '#67E8F9') : '#334155'
    }" stroke-width="${hot ? 8 : 6}" stroke-linecap="round"/>`;
  }).join('');
  const needleAngle = hot ? Math.PI * 2.03 : Math.PI * 1.02;
  const needleX = x + Math.cos(needleAngle) * (radius - 21);
  const needleY = y + Math.sin(needleAngle) * (radius - 21);
  return `<g>
    <path d="M${x - radius} ${y} A${radius} ${radius} 0 0 1 ${x + radius} ${y}" fill="none" stroke="#1E293B" stroke-width="18" stroke-linecap="round"/>
    ${segments}
    <path d="M${x} ${y}L${needleX} ${needleY}" stroke="${
      hot ? '#FED7AA' : '#CFFAFE'
    }" stroke-width="8" stroke-linecap="round"/>
    <circle cx="${x}" cy="${y}" r="15" fill="${hot ? '#F97316' : '#0E7490'}" stroke="#ECFEFF" stroke-width="3"/>
  </g>`;
}

function contextBlocks(): string {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = (-118 + index * 34) * (Math.PI / 180);
    const x = 935 + Math.cos(angle) * 192;
    const y = 315 + Math.sin(angle) * 192;
    return `<rect x="${x - 33}" y="${y - 19}" width="66" height="38" rx="10" fill="#0E7490" fill-opacity="${
      0.5 + index * 0.045
    }" stroke="#A5F3FC" stroke-opacity="0.82" stroke-width="2"/>`;
  }).join('');
}

function energySvg(plan: VisualPlan, labels: boolean): Buffer {
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    ${defs()}${base()}
    <g filter="url(#shadow)">
      <rect x="64" y="92" width="454" height="544" rx="38" fill="#06111B" stroke="#164E63" stroke-width="2"/>
      <path d="M154 250h84c18 0 32 14 32 32v32c0 18-14 32-32 32h-24l-30 31v-31h-30c-18 0-32-14-32-32v-32c0-18 14-32 32-32Z" fill="#0E7490" fill-opacity="0.23" stroke="#67E8F9" stroke-width="3"/>
      <rect x="337" y="260" width="108" height="108" rx="24" fill="url(#metal)" stroke="#67E8F9" stroke-width="3"/>
      <path d="M270 306H337" stroke="#67E8F9" stroke-width="7" marker-end="url(#arrow)"/>
      <path d="M363 290h56M363 316h56M363 342h56" stroke="#CFFAFE" stroke-opacity="0.7" stroke-width="7" stroke-linecap="round"/>
      <path d="M391 368V430" stroke="#67E8F9" stroke-width="5"/>
      <path d="M391 430C348 430 330 450 330 475" fill="none" stroke="#67E8F9" stroke-width="5"/>
      ${meter({ x: 330, y: 520, radius: 76, hot: false })}
      <path d="M166 520h72" stroke="#67E8F9" stroke-opacity="0.42" stroke-width="8" stroke-linecap="round"/>
    </g>

    <path d="M528 352H590" stroke="#67E8F9" stroke-width="6" marker-end="url(#arrow)"/>

    <g filter="url(#shadow)">
      <rect x="604" y="92" width="612" height="544" rx="38" fill="#06111B" stroke="#7C2D12" stroke-width="2"/>
      <ellipse cx="935" cy="300" rx="280" ry="250" fill="url(#heatGlow)" filter="url(#blur)"/>
      <rect x="850" y="220" width="170" height="170" rx="36" fill="url(#metal)" stroke="#FB923C" stroke-width="6"/>
      <path d="M886 262h98M886 304h98M886 346h98" stroke="#FED7AA" stroke-width="10" stroke-linecap="round"/>
      ${contextBlocks()}
      <path d="M 756 404 C 654 120, 1148 78, 1168 330 C 1184 529, 964 574, 784 478" fill="none" stroke="#67E8F9" stroke-width="8" marker-end="url(#arrow)"/>
      <path d="M746 304H832" stroke="#67E8F9" stroke-width="7" marker-end="url(#arrow)"/>

      <path d="M906 180C884 146 892 120 912 92M952 174C934 138 946 112 970 82M996 190C984 152 1000 128 1028 102" fill="none" stroke="#FDBA74" stroke-width="9" stroke-linecap="round" stroke-opacity="0.92"/>
      <path d="M935 390V426" stroke="#FB923C" stroke-width="13"/>
      <path d="M935 426C1060 426 1095 458 1095 486" fill="none" stroke="#FB923C" stroke-width="16" stroke-linecap="round"/>
      ${meter({ x: 1040, y: 526, radius: 88, hot: true })}
      <path d="M704 538h116M704 560h164M704 582h202" stroke="#FB923C" stroke-width="12" stroke-linecap="round" stroke-opacity="0.82"/>
    </g>
    ${labels ? overlayPills(plan) : ''}
  </svg>`;
  return Buffer.from(svg);
}

async function toJpeg(svg: Buffer): Promise<Buffer> {
  return sharp(svg).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
}

async function main() {
  const plans = JSON.parse(await readFile(join(ROOT, 'plans.json'), 'utf8')) as PlanRecord[];
  const energy = plans.find((record) => record.plan.claim.storyId === 'energy-600x');
  if (!energy) throw new Error('Energy story plan not found.');
  const pixelPath = join(ROOT, 'images', '1-energy-600x-pixels.jpg');
  const finalPath = join(ROOT, 'images', '1-energy-600x-final.jpg');
  await Promise.all([
    writeFile(pixelPath, await toJpeg(energySvg(energy.plan, false))),
    writeFile(finalPath, await toJpeg(energySvg(energy.plan, true))),
  ]);
  console.log(JSON.stringify({ pixelPath, finalPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
