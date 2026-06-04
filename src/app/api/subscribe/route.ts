import { NextResponse } from 'next/server';
import { LANGS, type Lang } from '@/lib/site';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/**
 * Newsletter subscribe — wires to Beehiiv when `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID` exist.
 * Until then returns 503 so the UI can show an honest message (no fake success).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email =
    body && typeof body === 'object' && 'email' in body && typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';
  const langRaw =
    body && typeof body === 'object' && 'lang' in body ? body.lang : 'en';
  const lang: Lang = isLang(langRaw) ? langRaw : 'en';
  const placement =
    body && typeof body === 'object' && 'placement' in body && typeof body.placement === 'string'
      ? body.placement.slice(0, 64)
      : 'site';

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();
  if (!apiKey || !publicationId) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: 'aitodaybrief',
        utm_medium: placement,
        utm_campaign: lang,
      }),
      signal: AbortSignal.timeout(12_000),
    },
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'provider_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
