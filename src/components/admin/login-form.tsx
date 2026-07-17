'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage(error.message);
      setState('error');
      return;
    }
    setState('sent');
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Owner email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-[#47e4d3]"
          placeholder="owner@example.com"
        />
      </label>
      <button
        type="submit"
        disabled={state === 'sending' || state === 'sent'}
        className="min-h-12 rounded-xl bg-[#47e4d3] px-4 font-bold text-[#0a2321] transition hover:bg-[#70eee1] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'sending'
          ? 'Sending…'
          : state === 'sent'
            ? 'Check your inbox'
            : 'Send secure login link'}
      </button>
      {state === 'sent' ? (
        <p role="status" className="text-sm text-emerald-300">
          Login link sent. It works only for an existing allowlisted account.
        </p>
      ) : null}
      {state === 'error' ? (
        <p role="alert" className="text-sm text-red-300">
          {message}
        </p>
      ) : null}
    </form>
  );
}
