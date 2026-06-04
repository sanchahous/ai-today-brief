/**
 * Decorative 404 scene: pipeline nodes, drifting story cards, broken link.
 * CSS motion in globals.css; respects prefers-reduced-motion.
 */
export function NotFoundIllustration() {
  return (
    <svg
      viewBox="0 0 400 180"
      aria-hidden
      className="not-found-scene mx-auto mb-2 block h-auto w-full max-w-[24rem]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nf-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(240,192,64,0.35)" />
          <stop offset="100%" stopColor="rgba(91,201,240,0.12)" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="90" rx="160" ry="68" fill="url(#nf-glow)" opacity="0.55" />

      <g transform="translate(48 40)">
        <g className="nf-card nf-card-a">
          <rect width="72" height="48" rx="6" fill="var(--surface-elevated, #1e1e22)" stroke="rgba(240,192,64,0.35)" strokeWidth="1.2" />
          <rect x="10" y="12" width="40" height="4" rx="2" fill="rgba(240,192,64,0.55)" />
          <rect x="10" y="22" width="52" height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
          <rect x="10" y="30" width="44" height="3" rx="1.5" fill="rgba(255,255,255,0.08)" />
        </g>
      </g>

      <g transform="translate(268 28)">
        <g className="nf-card nf-card-b">
          <rect width="72" height="48" rx="6" fill="var(--surface-elevated, #1e1e22)" stroke="rgba(91,201,240,0.3)" strokeWidth="1.2" />
          <rect x="10" y="12" width="36" height="4" rx="2" fill="rgba(91,201,240,0.5)" />
          <rect x="10" y="22" width="48" height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
          <rect x="10" y="30" width="38" height="3" rx="1.5" fill="rgba(255,255,255,0.08)" />
        </g>
      </g>

      <g transform="translate(158 108)">
        <g className="nf-card nf-card-c">
          <rect width="84" height="52" rx="6" fill="var(--surface-elevated, #1e1e22)" stroke="rgba(181,140,247,0.35)" strokeWidth="1.2" />
          <rect x="10" y="14" width="44" height="4" rx="2" fill="rgba(181,140,247,0.55)" />
          <rect x="10" y="26" width="58" height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
          <rect x="10" y="34" width="50" height="3" rx="1.5" fill="rgba(255,255,255,0.08)" />
        </g>
      </g>

      <path
        d="M 120 64 L 168 80 L 200 56 L 248 46"
        fill="none"
        stroke="rgba(240,192,64,0.45)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        className="nf-pipeline"
      />
      <circle cx="200" cy="56" r="5" fill="rgba(240,192,64,0.9)" className="nf-node" />
      <circle cx="248" cy="46" r="4" fill="rgba(91,201,240,0.5)" opacity="0.6" />

      <g transform="translate(302 118)">
        <g className="nf-broken-link">
          <path
            d="M 0 8 C 8 0 20 0 28 8 M 28 8 L 40 20 M 40 20 C 48 28 60 28 68 20"
            fill="none"
            stroke="rgba(240,192,64,0.7)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line x1="22" y1="14" x2="46" y2="2" stroke="rgba(255,100,100,0.75)" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>

      <g transform="translate(88 30)">
        <circle cx="0" cy="0" r="14" fill="none" stroke="rgba(240,192,64,0.25)" strokeWidth="1.5" className="nf-radar" />
        <path d="M 0 0 L 12 -12" stroke="rgba(240,192,64,0.5)" strokeWidth="1.5" strokeLinecap="round" className="nf-radar-arm" />
      </g>
    </svg>
  );
}
