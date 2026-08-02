const SESSION_KEY = 'atb_digest_session_v1';
const ATTRIBUTION_KEY = 'atb_weekly_attribution_v1';
const ATTRIBUTION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

interface WeeklyAttribution {
  digestId: string;
  revisionId: string;
  locale: 'en' | 'uk';
  channel: string | null;
  hookAngle: string | null;
  sessionKey: string;
  expiresAt: number;
}

export function weeklyDigestSessionKey() {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, value);
  return value;
}

export function rememberWeeklyAttribution(
  input: Omit<WeeklyAttribution, 'sessionKey' | 'expiresAt'>,
) {
  try {
    localStorage.setItem(
      ATTRIBUTION_KEY,
      JSON.stringify({
        ...input,
        sessionKey: weeklyDigestSessionKey(),
        expiresAt: Date.now() + ATTRIBUTION_TTL_MS,
      } satisfies WeeklyAttribution),
    );
  } catch {
    // Browsers may block storage; the subscription itself must still succeed.
  }
}

function storedAttribution(): WeeklyAttribution | null {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(ATTRIBUTION_KEY) ?? 'null',
    ) as Partial<WeeklyAttribution> | null;
    if (
      !parsed ||
      typeof parsed.digestId !== 'string' ||
      typeof parsed.revisionId !== 'string' ||
      (parsed.locale !== 'en' && parsed.locale !== 'uk') ||
      typeof parsed.sessionKey !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Date.now()
    ) {
      localStorage.removeItem(ATTRIBUTION_KEY);
      return null;
    }
    return parsed as WeeklyAttribution;
  } catch {
    return null;
  }
}

export async function reportWeeklySignup() {
  const attribution = storedAttribution();
  if (!attribution) return;
  try {
    const response = await fetch('/api/weekly/engagement', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventType: 'signup_complete',
        digestId: attribution.digestId,
        revisionId: attribution.revisionId,
        locale: attribution.locale,
        channel: attribution.channel,
        hookAngle: attribution.hookAngle,
        sessionKey: attribution.sessionKey,
        pathname: location.pathname,
        referrerHost: document.referrer ? new URL(document.referrer).hostname : null,
      }),
    });
    if (response.ok) localStorage.removeItem(ATTRIBUTION_KEY);
  } catch {
    // Analytics is best-effort and never changes the subscription result.
  }
}
