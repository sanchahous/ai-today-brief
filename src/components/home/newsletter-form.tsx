'use client';

import { useState } from 'react';
import { ArrowRight } from '@/components/icons';

/**
 * Inline email capture. Visual placeholder for now — the real Beehiiv
 * double-opt-in subscribe runs server-side in P5; this does not yet send data.
 * Kept as a client island so the surrounding band stays a Server Component.
 */
export function NewsletterForm({
  placeholder,
  button,
  done,
}: {
  placeholder: string;
  button: string;
  done: string;
}) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <p role="status" className="text-accent text-sm font-semibold">
        {done}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) setSubmitted(true);
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
        className="rounded-pill bg-accent inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-black"
      >
        {button}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
