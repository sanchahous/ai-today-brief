'use client';

import { useState } from 'react';
import { isEmailOtp } from '@/lib/admin-login';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export function LoginForm({ initialError = '' }: { initialError?: string }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'request' | 'code'>('request');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [isError, setIsError] = useState(Boolean(initialError));

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setIsError(false);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin/mfa`,
      },
    });
    if (error) {
      setMessage(error.message);
      setIsError(true);
      setBusy(false);
      return;
    }
    setPhase('code');
    setMessage('Enter the six-digit code from the newest email.');
    setBusy(false);
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEmailOtp(code)) return;
    setBusy(true);
    setMessage('');
    setIsError(false);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    if (error) {
      setMessage(error.message);
      setIsError(true);
      setBusy(false);
      return;
    }
    window.location.assign('/admin/mfa');
  }

  if (phase === 'code') {
    return (
      <form onSubmit={verifyCode} className="grid gap-4">
        <p className="text-sm leading-6 text-slate-300">
          We sent a login code to <strong className="text-white">{email}</strong>. Codes expire
          shortly; use only the newest email.
        </p>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Six-digit login code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 text-center text-xl tracking-[.35em] text-white outline-none focus:border-[#47e4d3]"
            placeholder="000000"
          />
        </label>
        <button
          disabled={busy || !isEmailOtp(code)}
          className="min-h-12 rounded-xl bg-[#47e4d3] px-4 font-bold text-[#0a2321] transition hover:bg-[#70eee1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Verifying…' : 'Verify and continue to MFA'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setPhase('request');
            setCode('');
            setMessage('');
            setIsError(false);
          }}
          className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-slate-300 disabled:opacity-60"
        >
          Change email or request a new code
        </button>
        {message ? (
          <p
            role={isError ? 'alert' : 'status'}
            className={isError ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}
          >
            {message}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="grid gap-4">
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
        disabled={busy}
        className="min-h-12 rounded-xl bg-[#47e4d3] px-4 font-bold text-[#0a2321] transition hover:bg-[#70eee1] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send secure login code'}
      </button>
      {message ? (
        <p
          role={isError ? 'alert' : 'status'}
          className={isError ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
