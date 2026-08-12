import type { VisualTreatmentDecisionV72 } from './visual-treatment-v7-2';

export interface SpecializedVisualSvgV72Input {
  treatment: VisualTreatmentDecisionV72;
  width?: number;
  height?: number;
  includeOverlays?: boolean;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pill(text: string, x: number, y: number, primary = false): string {
  const fontSize = text.length > 20 ? 16 : 18;
  const width = Math.max(
    150,
    Math.min(330, Math.round(text.length * fontSize * 0.64 + 38)),
  );
  return `<g><rect x="${x}" y="${y}" width="${width}" height="42" rx="21" fill="${
    primary ? '#CFFAFE' : '#083344'
  }" stroke="#22D3EE" stroke-width="1.5"/><text x="${
    x + 18
  }" y="${y + 27}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
    primary ? '#083344' : '#ECFEFF'
  }">${xml(text)}</text></g>`;
}

function commonDefs(): string {
  return `<defs>
    <linearGradient id="v72-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617"/><stop offset="0.52" stop-color="#061827"/><stop offset="1" stop-color="#11152A"/></linearGradient>
    <radialGradient id="v72-cyan-glow"><stop offset="0" stop-color="#22D3EE" stop-opacity="0.27"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient>
    <radialGradient id="v72-violet-glow"><stop offset="0" stop-color="#A78BFA" stop-opacity="0.2"/><stop offset="1" stop-color="#A78BFA" stop-opacity="0"/></radialGradient>
    <filter id="v72-shadow"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000814" flood-opacity="0.75"/></filter>
    <marker id="v72-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#CFFAFE"/></marker>
  </defs>`;
}

function commonBackground(): string {
  return `<rect width="1280" height="720" fill="url(#v72-bg)"/>
    <ellipse cx="335" cy="370" rx="330" ry="300" fill="url(#v72-cyan-glow)"/>
    <ellipse cx="1000" cy="380" rx="320" ry="300" fill="url(#v72-violet-glow)"/>
    <rect x="30" y="30" width="1220" height="660" rx="34" fill="none" stroke="#22D3EE" stroke-opacity="0.34" stroke-width="2"/>`;
}

function overlays(input: SpecializedVisualSvgV72Input): string {
  if (input.includeOverlays === false) return '';
  const labels = input.treatment.approvedLabels.slice(0, 3);
  return [
    labels[0] ? pill(labels[0], 70, 70, true) : '',
    labels[1] ? pill(labels[1], 470, 70) : '',
    labels[2] ? pill(labels[2], 890, 70) : '',
  ].join('');
}

function consistencySignal(input: SpecializedVisualSvgV72Input): Buffer {
  const lanes = [
    { y: 218, color: '#34D399', length: 150 },
    { y: 300, color: '#F59E0B', length: 88 },
    { y: 382, color: '#34D399', length: 138 },
    { y: 464, color: '#F59E0B', length: 64 },
  ]
    .map(
      ({ y, color, length }) => `<g>
        <path d="M320 ${y + 25}H430" stroke="#CFFAFE" stroke-opacity="0.65" stroke-width="5" marker-end="url(#v72-arrow)"/>
        <rect x="450" y="${y}" width="300" height="50" rx="18" fill="#07131E" stroke="#1E4D62" stroke-width="2"/>
        <rect x="470" y="${y + 15}" width="${length}" height="20" rx="10" fill="${color}"/>
        <circle cx="720" cy="${y + 25}" r="10" fill="${color}"/>
      </g>`,
    )
    .join('');
  const svg = `<svg width="${input.width ?? 1280}" height="${
    input.height ?? 720
  }" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" data-v72-treatment="reported-consistency-signal">
    ${commonDefs()}${commonBackground()}${overlays(input)}
    <g filter="url(#v72-shadow)">
      <rect x="82" y="192" width="230" height="330" rx="34" fill="#07131E" stroke="#22D3EE" stroke-width="3"/>
      <rect x="130" y="245" width="134" height="134" rx="28" fill="#0F2940" stroke="#67E8F9" stroke-width="4"/>
      <circle cx="197" cy="312" r="31" fill="#A78BFA" fill-opacity="0.75"/>
      <path d="M168 426h58M168 454h88M168 482h70" stroke="#CFFAFE" stroke-width="8" stroke-linecap="round" opacity="0.65"/>
    </g>
    ${lanes}
    <rect x="428" y="180" width="345" height="370" rx="28" fill="none" stroke="#A78BFA" stroke-width="3" stroke-dasharray="12 10"/>
    <path d="M790 365H860" stroke="#CFFAFE" stroke-width="6" marker-end="url(#v72-arrow)"/>
    <g filter="url(#v72-shadow)">
      <rect x="890" y="190" width="300" height="350" rx="34" fill="#07131E" stroke="#A78BFA" stroke-width="3"/>
      <circle cx="970" cy="280" r="42" fill="#0F2940" stroke="#67E8F9" stroke-width="3"/>
      <circle cx="1110" cy="280" r="42" fill="#201337" stroke="#C4B5FD" stroke-width="3"/>
      <path d="M945 370h190" stroke="#CFFAFE" stroke-opacity="0.25" stroke-width="14" stroke-linecap="round"/>
      <path d="M945 370h126" stroke="#34D399" stroke-width="10" stroke-linecap="round"/>
      <path d="M945 425h190" stroke="#CFFAFE" stroke-opacity="0.25" stroke-width="14" stroke-linecap="round"/>
      <path d="M945 425h82" stroke="#F59E0B" stroke-width="10" stroke-linecap="round"/>
      <path d="M1018 488l22 22 48-56" fill="none" stroke="#34D399" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>`;
  return Buffer.from(svg);
}

function usageSignal(input: SpecializedVisualSvgV72Input): Buffer {
  const blocks = Array.from({ length: 5 }, (_, index) => {
    const y = 250 + index * 52;
    return `<rect x="120" y="${y}" width="188" height="34" rx="10" fill="${
      index < 3 ? '#0E7490' : '#7C3AED'
    }" fill-opacity="${0.45 + index * 0.08}" stroke="#CFFAFE" stroke-opacity="0.42"/>`;
  }).join('');
  const tokens = Array.from({ length: 9 }, (_, index) => {
    const x = 380 + index * 55;
    const y = 320 + ((index % 3) - 1) * 34;
    return `<rect x="${x}" y="${y}" width="34" height="34" rx="9" fill="#22D3EE" fill-opacity="${
      0.55 + index * 0.035
    }" transform="rotate(${-6 + (index % 4) * 4} ${x + 17} ${y + 17})"/>`;
  }).join('');
  const svg = `<svg width="${input.width ?? 1280}" height="${
    input.height ?? 720
  }" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" data-v72-treatment="reported-usage-signal">
    ${commonDefs()}${commonBackground()}${overlays(input)}
    <g filter="url(#v72-shadow)">
      <rect x="78" y="190" width="270" height="360" rx="34" fill="#07131E" stroke="#22D3EE" stroke-width="3"/>
      ${blocks}
    </g>
    ${tokens}
    <path d="M350 365C510 265 610 470 760 360" fill="none" stroke="#CFFAFE" stroke-width="6" stroke-opacity="0.78" marker-end="url(#v72-arrow)"/>
    <g filter="url(#v72-shadow)">
      <rect x="760" y="180" width="430" height="380" rx="34" fill="#07131E" stroke="#A78BFA" stroke-width="3"/>
      <path d="M842 430A135 135 0 0 1 1108 430" fill="none" stroke="#CFFAFE" stroke-opacity="0.18" stroke-width="30" stroke-linecap="round"/>
      <path d="M842 430A135 135 0 0 1 1034 315" fill="none" stroke="#22D3EE" stroke-width="18" stroke-linecap="round"/>
      <path d="M1034 315A135 135 0 0 1 1108 430" fill="none" stroke="#F59E0B" stroke-width="18" stroke-dasharray="12 10" stroke-linecap="round"/>
      <path d="M975 430L1038 335" stroke="#ECFEFF" stroke-width="10" stroke-linecap="round"/>
      <circle cx="975" cy="430" r="15" fill="#A78BFA"/>
      <path d="M817 505H1135" stroke="#CFFAFE" stroke-opacity="0.28" stroke-width="10" stroke-linecap="round"/>
      <path d="M817 505H1016" stroke="#34D399" stroke-width="9" stroke-linecap="round"/>
      <circle cx="1092" cy="280" r="34" fill="none" stroke="#F59E0B" stroke-width="5" stroke-dasharray="9 7"/>
      <path d="M1092 256v28M1092 298v3" stroke="#FDE68A" stroke-width="7" stroke-linecap="round"/>
    </g>
  </svg>`;
  return Buffer.from(svg);
}

function scienceFlow(input: SpecializedVisualSvgV72Input): Buffer {
  const cells = [
    [680, 250, 18],
    [736, 286, 12],
    [658, 330, 14],
    [725, 365, 20],
    [676, 420, 11],
    [752, 460, 15],
  ]
    .map(
      ([x, y, radius]) =>
        `<circle cx="${x}" cy="${y}" r="${radius}" fill="#34D399" fill-opacity="0.75"/>`,
    )
    .join('');
  const svg = `<svg width="${input.width ?? 1280}" height="${
    input.height ?? 720
  }" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" data-v72-treatment="science-reasoning-flow">
    ${commonDefs()}${commonBackground()}${overlays(input)}
    <g filter="url(#v72-shadow)">
      <rect x="70" y="205" width="260" height="320" rx="34" fill="#07131E" stroke="#22D3EE" stroke-width="3"/>
      <rect x="126" y="265" width="148" height="148" rx="28" fill="#0F2940" stroke="#67E8F9" stroke-width="4"/>
      <path d="M126 300h-28M126 335h-28M126 370h-28M274 300h28M274 335h28M274 370h28M160 265v-28M195 265v-28M230 265v-28M160 413v28M195 413v28M230 413v28" stroke="#CFFAFE" stroke-width="6" stroke-linecap="round"/>
      <circle cx="200" cy="339" r="40" fill="#A78BFA" fill-opacity="0.75"/>
      <path d="M175 339h50M200 314v50" stroke="#ECFEFF" stroke-width="7" stroke-linecap="round"/>
    </g>
    <path d="M340 365H410" stroke="#CFFAFE" stroke-width="6" marker-end="url(#v72-arrow)"/>
    <g filter="url(#v72-shadow)">
      <rect x="430" y="165" width="390" height="400" rx="34" fill="#07131E" stroke="#A78BFA" stroke-width="3"/>
      <path d="M495 240C555 270 555 330 495 360S435 450 495 480M575 240C515 270 515 330 575 360S635 450 575 480" fill="none" stroke="#67E8F9" stroke-width="7"/>
      <path d="M505 260h60M482 305h106M480 360h110M500 415h68M500 465h68" stroke="#C4B5FD" stroke-width="5" stroke-linecap="round"/>
      ${cells}
      <path d="M635 500h120M635 500l22-42 28 20 30-58 34 38" fill="none" stroke="#F59E0B" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <path d="M825 365H875" stroke="#CFFAFE" stroke-width="6" marker-end="url(#v72-arrow)"/>
    <g>
      <circle cx="925" cy="365" r="64" fill="#0F2940" stroke="#22D3EE" stroke-width="5"/>
      <path d="M897 337l56 56M953 337l-56 56" stroke="#A78BFA" stroke-width="8" stroke-linecap="round"/>
      <circle cx="925" cy="365" r="22" fill="#34D399" fill-opacity="0.75"/>
    </g>
    <path d="M990 365H1032" stroke="#CFFAFE" stroke-width="6" marker-end="url(#v72-arrow)"/>
    <g filter="url(#v72-shadow)">
      <rect x="1045" y="190" width="175" height="350" rx="34" fill="#07131E" stroke="#34D399" stroke-width="3"/>
      <circle cx="1132" cy="308" r="62" fill="#0E7490" fill-opacity="0.28" stroke="#67E8F9" stroke-width="4"/>
      <circle cx="1132" cy="308" r="24" fill="#A78BFA"/>
      <path d="M1077 278l-22-18M1081 338l-26 20M1184 278l24-20M1184 340l25 18M1132 244v-28M1132 372v28" stroke="#CFFAFE" stroke-width="6" stroke-linecap="round"/>
      <path d="M1088 455l24 24 64-72" fill="none" stroke="#34D399" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>`;
  return Buffer.from(svg);
}

export function renderSpecializedVisualSvgV72(
  input: SpecializedVisualSvgV72Input,
): Buffer {
  switch (input.treatment.treatment) {
    case 'reported_consistency_signal':
      return consistencySignal(input);
    case 'reported_usage_signal':
      return usageSignal(input);
    case 'science_reasoning_flow':
      return scienceFlow(input);
    default:
      throw new Error(
        `Treatment ${input.treatment.treatment} has no specialized deterministic SVG renderer.`,
      );
  }
}
