/** Cookie consent (Consent Mode v2) — stored client-side only. */
export const CONSENT_STORAGE_KEY = 'atb-consent-v1';

export type ConsentState = {
  analytics: boolean;
  ads: boolean;
  updatedAt: string;
};

export function isConsentState(value: unknown): value is ConsentState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.analytics === 'boolean' &&
    typeof v.ads === 'boolean' &&
    typeof v.updatedAt === 'string'
  );
}

export function parseConsentJson(raw: string): ConsentState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isConsentState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
