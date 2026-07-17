import 'server-only';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type SocialOAuthProvider = 'linkedin' | 'meta' | 'threads';

interface OAuthState {
  provider: SocialOAuthProvider;
  nonce: string;
  expiresAt: number;
}

function secret() {
  const value = process.env.OAUTH_STATE_SECRET?.trim() || process.env.SOCIAL_CRON_SECRET?.trim();
  if (!value) throw new Error('OAUTH_STATE_SECRET is not configured.');
  return value;
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createOAuthState(provider: SocialOAuthProvider) {
  const state: OAuthState = { provider, nonce: randomUUID(), expiresAt: Date.now() + 10 * 60_000 };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return { value: `${payload}.${signature(payload)}`, nonce: state.nonce };
}

export function verifyOAuthState(
  value: string,
  cookieNonce: string | undefined,
): OAuthState | null {
  const [payload, received] = value.split('.');
  if (!payload || !received || !cookieNonce) return null;
  const expected = signature(payload);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
    if (state.expiresAt < Date.now() || state.nonce !== cookieNonce) return null;
    if (!['linkedin', 'meta', 'threads'].includes(state.provider)) return null;
    return state;
  } catch {
    return null;
  }
}
