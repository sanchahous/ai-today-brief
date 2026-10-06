import type { ReactNode } from 'react';

export type NoticeTone = 'info' | 'warning' | 'error' | 'success';

const TONE_CLASS: Record<NoticeTone, string> = {
  info: 'border-line text-accent',
  warning: 'border-warning text-warning',
  error: 'border-error text-error',
  success: 'border-success text-success',
};

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (tone === 'warning') {
    return (
      <svg {...common}>
        <path d="M12 4 3 20h18L12 4z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (tone === 'error') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  if (tone === 'success') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export interface NoticeProps {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Icon plus text. Colour is a second signal; the words and the glyph carry the tone. */
export function Notice({ tone, title, children, className = '' }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`bg-surface flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${TONE_CLASS[tone]} ${className}`}
    >
      <span className="mt-0.5 shrink-0">
        <NoticeIcon tone={tone} />
      </span>
      <div className="min-w-0 text-text">
        {title ? <p className="m-0 font-medium">{title}</p> : null}
        <p className={`m-0 ${title ? 'text-muted mt-1' : ''}`}>{children}</p>
      </div>
    </div>
  );
}
