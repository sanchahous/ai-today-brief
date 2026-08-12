import type { VisualPlan } from './visual-compiler';
import { overlayDirectivesForLabels, type HoldoutStoryInput } from './visual-auto-claim';
import { compileAutoVisualClaimV5, type AutoVisualClaimV5 } from './visual-auto-claim-v5';
import { renderGenericVisualSvgV5 } from './visual-generic-svg-v5';
import type { HybridTreatmentV6 } from './visual-hybrid-v6';

export interface GenericVisualSvgV6Input {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  plan: VisualPlan;
  treatment: HybridTreatmentV6;
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
  const fontSize = text.length > 18 ? 15 : 18;
  const width = Math.max(120, Math.min(310, Math.round(text.length * fontSize * 0.65 + 36)));
  return `<g><rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="${
    primary ? '#CFFAFE' : '#083344'
  }" fill-opacity="0.97" stroke="#22D3EE" stroke-width="1.5"/><text x="${
    x + 18
  }" y="${y + 26}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
    primary ? '#083344' : '#ECFEFF'
  }">${xml(text)}</text></g>`;
}

function uncertaintySvg(input: GenericVisualSvgV6Input, width: number, height: number): Buffer {
  const scaleX = width / 1280;
  const scaleY = height / 720;
  const currentBlocks = Array.from({ length: 4 }, (_, index) => {
    const y = 482 - index * 58;
    return `<rect x="190" y="${y}" width="210" height="42" rx="13" fill="${
      index % 2 ? '#A78BFA' : '#22D3EE'
    }" fill-opacity="${0.42 + index * 0.1}" stroke="#CFFAFE" stroke-opacity="0.62" stroke-width="2"/>`;
  }).join('');
  const futureBlocks = Array.from({ length: 7 }, (_, index) => {
    const y = 486 - index * 48;
    return `<rect x="875" y="${y}" width="210" height="34" rx="11" fill="#22D3EE" fill-opacity="${
      0.035 + index * 0.012
    }" stroke="#67E8F9" stroke-opacity="0.58" stroke-width="2" stroke-dasharray="10 8"/>`;
  }).join('');
  const labels = input.includeOverlays === false ? '' : [
    input.treatment.labels[0] ? pill(input.treatment.labels[0], 88, 112, true) : '',
    input.treatment.labels[1] ? pill(input.treatment.labels[1], 778, 112) : '',
    input.treatment.labels[2] ? pill(input.treatment.labels[2], 778, 160) : '',
  ].join('');
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" data-v6-future-unconfirmed="true">
    <defs>
      <linearGradient id="v6-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03070D"/><stop offset="0.55" stop-color="#071827"/><stop offset="1" stop-color="#101827"/></linearGradient>
      <radialGradient id="v6-current-glow"><stop offset="0" stop-color="#22D3EE" stop-opacity="0.3"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient>
      <radialGradient id="v6-future-glow"><stop offset="0" stop-color="#A78BFA" stop-opacity="0.16"/><stop offset="1" stop-color="#A78BFA" stop-opacity="0"/></radialGradient>
      <filter id="v6-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000814" flood-opacity="0.82"/></filter>
      <marker id="v6-arrow" markerWidth="11" markerHeight="11" refX="9" refY="5.5" orient="auto"><path d="M0 0 11 5.5 0 11Z" fill="#CFFAFE"/></marker>
    </defs>
    <rect width="1280" height="720" fill="url(#v6-bg)"/>
    <ellipse cx="322" cy="370" rx="290" ry="285" fill="url(#v6-current-glow)"/>
    <ellipse cx="980" cy="370" rx="290" ry="285" fill="url(#v6-future-glow)"/>
    <rect x="62" y="82" width="470" height="548" rx="34" fill="#07131E" stroke="#22D3EE" stroke-opacity="0.52" stroke-width="3" filter="url(#v6-shadow)"/>
    <rect x="748" y="82" width="470" height="548" rx="34" fill="#07131E" fill-opacity="0.58" stroke="#A78BFA" stroke-opacity="0.78" stroke-width="4" stroke-dasharray="16 13" filter="url(#v6-shadow)"/>
    ${currentBlocks}
    ${futureBlocks}
    <g transform="translate(252 218)">
      <path d="M0 132A70 70 0 0 1 140 132" fill="none" stroke="#ECFEFF" stroke-opacity="0.2" stroke-width="18" stroke-linecap="round"/>
      <path d="M0 132A70 70 0 0 1 126 88" fill="none" stroke="#34D399" stroke-width="10" stroke-linecap="round"/>
      <path d="M70 132 112 101" stroke="#CFFAFE" stroke-width="8" stroke-linecap="round"/><circle cx="70" cy="132" r="10" fill="#22D3EE"/>
    </g>
    <g transform="translate(940 218)" opacity="0.55">
      <path d="M0 132A70 70 0 0 1 140 132" fill="none" stroke="#ECFEFF" stroke-opacity="0.2" stroke-width="18" stroke-linecap="round" stroke-dasharray="11 9"/>
      <path d="M0 132A70 70 0 0 1 136 106" fill="none" stroke="#A78BFA" stroke-width="10" stroke-linecap="round" stroke-dasharray="11 9"/>
      <path d="M70 132 121 113" stroke="#CFFAFE" stroke-width="8" stroke-linecap="round" stroke-dasharray="10 8"/><circle cx="70" cy="132" r="10" fill="#A78BFA"/>
    </g>
    <path d="M554 366C612 338 642 338 694 357" fill="none" stroke="#CFFAFE" stroke-opacity="0.85" stroke-width="7" stroke-linecap="round" marker-end="url(#v6-arrow)"/>
    <path d="M706 360H735" stroke="#A78BFA" stroke-opacity="0.72" stroke-width="5" stroke-dasharray="7 8"/>
    <circle cx="738" cy="360" r="10" fill="none" stroke="#A78BFA" stroke-width="4" stroke-dasharray="5 5"/>
    ${labels}
  </svg>`;
  void scaleX;
  void scaleY;
  return Buffer.from(svg);
}

export function renderGenericVisualSvgV6(input: GenericVisualSvgV6Input): Buffer {
  const width = Math.max(320, Math.round(input.width ?? 1280));
  const height = Math.max(180, Math.round(input.height ?? 720));
  if (input.autoClaim.semantics.explanatoryRole === 'uncertainty_announcement') {
    return uncertaintySvg(input, width, height);
  }
  const overlays = overlayDirectivesForLabels(input.treatment.labels, input.plan.format);
  const autoClaim: AutoVisualClaimV5 = {
    ...input.autoClaim,
    claim: {
      ...input.autoClaim.claim,
      approvedLabels: input.treatment.labels,
      overlayDirectives: overlays,
    },
  };
  const plan = compileAutoVisualClaimV5(autoClaim);
  return renderGenericVisualSvgV5({
    autoClaim,
    plan,
    width,
    height,
    includeOverlays: input.includeOverlays,
  });
}
