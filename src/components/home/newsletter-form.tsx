'use client';

import { useState } from 'react';
import { ArrowRight } from '@/components/icons';
import { trackEvent } from '@/lib/analytics-client';
import type { Lang } from '@/lib/site';

/**
 * Inline email capture → POST /api/subscribe (Beehiiv when env is set).
 * Kept as a client island so the surrounding band stays a Server Component.
 */
export function NewsletterForm({
  lang,
  placeholder,
  button,
  done,
  notConfigured,
  failed,
  placement = 'newsletter-band',
}: {
  lang: Lang;
  placeholder: string;
  button: string;
  done: string;
  notConfigured: string;
  failed: string;
  placement?: string;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'not_configured'>(
    'idle',
  );
  const [errorMsg, setErrorMsg] = useState('');

  if (status === 'done') {
    return (
      <p role="status" className="text-accent flex min-h-12 items-center text-sm font-semibold">
        {done}
      </p>
    );
  }

  if (status === 'not_configured') {
    return (
      <p role="status" className="text-muted flex min-h-12 items-center text-sm leading-relaxed">
        {notConfigured}
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const value = email.trim();
        if (!value) return;
        setStatus('loading');
        setErrorMsg('');
        try {
          const res = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: value, lang, placement }),
          });
          if (res.status === 503) {
            setStatus('not_configured');
            return;
          }
          if (!res.ok) {
            setStatus('error');
            setErrorMsg(failed);
            return;
          }
          setStatus('done');
          trackEvent('newsletter_subscribe', { placement, lang });
        } catch {
          setStatus('error');
          setErrorMsg(failed);
        }
      }}
      className="flex max-w-md flex-wrap gap-2"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="bg-bg border-border text-text rounded-pill focus-visible:border-accent flex-1 basis-56 border px-4 py-3 text-sm outline-none"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-pill bg-accent inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-on-accent disabled:opacity-70"
      >
        {button}
        <ArrowRight size={16} />
      </button>
      {status === 'error' && errorMsg ? (
        <p role="alert" className="text-muted w-full text-sm">
          {errorMsg}
        </p>
      ) : null}
    </form>
  );
}
