import { useId } from 'react';
import { getStrings } from '@/lib/i18n';
import { ribPaths } from '@/lib/motion/brand-resolve';
import type { Lang } from '@/lib/site';

/**
 * SSR brand scene — The Resolve. Motion is layered client-side; without JS or
 * reduced motion the finished mark is visible immediately.
 */
export function BrandStage({ lang }: { lang: Lang }) {
  const id = useId().replace(/:/g, '');
  const t = getStrings(lang).landing.brandStage;
  const ribs = ribPaths();

  return (
    <div className="brand-stage grain" data-brand-state="rest">
      <svg viewBox="0 0 540 440" role="img" aria-label={t.ariaLabel} focusable="false">
        <defs>
          <linearGradient
            id={`${id}-brass`}
            gradientUnits="userSpaceOnUse"
            x1="70"
            y1="90"
            x2="445"
            y2="375"
          >
            <stop stopColor="#6f5c3d" />
            <stop offset="0.26" stopColor="#ecd7a9" />
            <stop offset="0.49" stopColor="#9a7f52" />
            <stop offset="0.72" stopColor="#e8c995" />
            <stop offset="1" stopColor="#746247" />
          </linearGradient>
          <linearGradient
            id={`${id}-edge`}
            gradientUnits="userSpaceOnUse"
            x1="140"
            y1="95"
            x2="400"
            y2="330"
          >
            <stop stopColor="#fff0d0" stopOpacity="0.7" />
            <stop offset="0.5" stopColor="#fff0d0" stopOpacity="0.08" />
            <stop offset="1" stopColor="#fff0d0" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#b5d8cc" stopOpacity="0.06" />
            <stop offset="0.5" stopColor="#b5d8cc" stopOpacity="0.38" />
            <stop offset="1" stopColor="#b5d8cc" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff6e2" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff6e2" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff6e2" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-shadow`}>
            <stop stopColor="#000" stopOpacity="0.6" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id={`${id}-light`}
            gradientUnits="userSpaceOnUse"
            cx="270"
            cy="150"
            r="270"
          >
            <stop stopColor="#d4b483" stopOpacity="0.22" />
            <stop offset="0.55" stopColor="#d4b483" stopOpacity="0.07" />
            <stop offset="1" stopColor="#d4b483" stopOpacity="0" />
          </radialGradient>
          <mask
            id={`${id}-mask`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="540"
            height="440"
          >
            <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              {ribs.flatMap(({ left, right }) => [
                <path key={`${left}-mask`} d={left} />,
                <path key={`${right}-mask`} d={right} />,
              ])}
            </g>
          </mask>
        </defs>
        <rect className="rs-light" x="-120" y="-160" width="780" height="700" fill={`url(#${id}-light)`} />
        <ellipse className="rs-shadow" cx="270" cy="410" rx="205" ry="29" fill={`url(#${id}-shadow)`} />
        <g className="rs-ribs" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {ribs.map(({ left, right, width }, index) => (
            <g key={index} className="rs-rib" data-rib={index}>
              <path pathLength="1" d={left} stroke={`url(#${id}-brass)`} strokeWidth={width} />
              <path pathLength="1" d={right} stroke={`url(#${id}-brass)`} strokeWidth={width} />
              <path pathLength="1" d={left} stroke={`url(#${id}-edge)`} strokeWidth="0.55" />
              <path pathLength="1" d={right} stroke={`url(#${id}-edge)`} strokeWidth="0.55" />
            </g>
          ))}
        </g>
        <g mask={`url(#${id}-mask)`}>
          <rect
            className="rs-sheen"
            x="-120"
            y="60"
            width="140"
            height="360"
            fill={`url(#${id}-sheen)`}
            transform="skewX(-18)"
          />
        </g>
        <g className="rs-bridge">
          <path
            d="M176 310 L355 310 L365 328 L165 328 Z"
            fill={`url(#${id}-glass)`}
            stroke="#b5d8cc"
            strokeOpacity="0.45"
            strokeWidth="0.8"
          />
          <path d="M169 325 H361" stroke="#d4b483" strokeWidth="1.2" />
        </g>
        <g className="rs-signal">
          <circle
            className="rs-halo"
            cx="412"
            cy="107"
            r="23"
            fill="none"
            stroke="#b5d8cc"
            strokeOpacity="0.35"
            strokeWidth="0.9"
          />
          <circle
            className="rs-ripple"
            cx="412"
            cy="107"
            r="23"
            fill="none"
            stroke="#b5d8cc"
            strokeWidth="1.2"
          />
          <path
            className="rs-leader"
            pathLength="1"
            d="M392 143 L371 179"
            stroke="#b5d8cc"
            strokeWidth="0.7"
            strokeOpacity="0.5"
          />
          <circle className="rs-dot" cx="412" cy="107" r="7" fill="#b5d8cc" />
        </g>
        <path className="rs-floor" d="M70 417 H470" stroke="#d4b483" strokeOpacity="0.2" strokeWidth="0.6" />
      </svg>
      <span className="brand-kicker" aria-hidden="true">{t.kicker}</span>
      <ol className="brand-phases" aria-hidden="true">
        <li data-phase="0">{t.phaseSignals}</li>
        <li data-phase="1">{t.phaseEdit}</li>
        <li data-phase="2">{t.phaseResolve}</li>
        <li className="brand-progress"><i /></li>
      </ol>
      <p className="brand-caption">
        <span className="brand-line"><span>{t.captionLine1}</span></span>
        <span className="brand-line"><span>{t.captionLine2}</span></span>
        <small>{t.captionMeta}</small>
      </p>
      <button
        type="button"
        className="brand-replay"
        data-brand-replay
        aria-label={t.replay}
      >
        <svg className="icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
