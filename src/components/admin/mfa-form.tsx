'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface FactorState {
  id: string;
  qrCode?: string;
  secret?: string;
}

export function MfaForm() {
  const [factor, setFactor] = useState<FactorState | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('Preparing authenticator…');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    async function prepare() {
      const supabase = getSupabaseBrowser();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const existing = factors?.totp.find((candidate) => candidate.status === 'verified');
      if (existing) {
        if (active) {
          setFactor({ id: existing.id });
          setMessage('Enter the current six-digit code.');
          setBusy(false);
        }
        return;
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'AI Today Brief CMS',
      });
      if (!active) return;
      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
      setFactor({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setMessage('Scan the code, then enter the six-digit number.');
      setBusy(false);
    }
    void prepare();
    return () => {
      active = false;
    };
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor) return;
    setBusy(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    window.location.assign('/admin');
  }

  return (
    <form onSubmit={verify} className="grid gap-4">
      {factor?.qrCode ? (
        // Supabase returns a local SVG data URI, not a remote image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={factor.qrCode}
          alt="TOTP setup QR code"
          className="mx-auto size-56 rounded-xl bg-white p-3"
        />
      ) : null}
      {factor?.secret ? (
        <details className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold">Can’t scan?</summary>
          <code className="mt-2 block break-all text-[#47e4d3]">{factor.secret}</code>
        </details>
      ) : null}
      <p role="status" className="text-sm text-slate-300">
        {message}
      </p>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Authenticator code
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 text-center text-xl tracking-[.35em] text-white outline-none focus:border-[#47e4d3]"
        />
      </label>
      <button
        disabled={busy || !factor || code.length !== 6}
        className="min-h-12 rounded-xl bg-[#47e4d3] px-4 font-bold text-[#0a2321] disabled:opacity-60"
      >
        Verify and continue
      </button>
    </form>
  );
}
