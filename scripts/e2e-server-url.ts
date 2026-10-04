/** Default local port for `next dev` / `next start` and Playwright `webServer`. */
export const DEFAULT_E2E_PORT = 3000;

/**
 * Port for the e2e / dev production server. `next start` and `next dev` honour `PORT`;
 * Playwright and `e2e:affected` read the same value so parallel worktrees do not reuse
 * each other's server via `reuseExistingServer`.
 */
export function resolveE2ePort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PORT?.trim();
  if (!raw) return DEFAULT_E2E_PORT;
  const port = Number.parseInt(raw, 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65_535) return DEFAULT_E2E_PORT;
  return port;
}

/**
 * Base URL Playwright and `e2e:affected` target. `E2E_BASE_URL` wins when set (external
 * server — Playwright skips `webServer`). Otherwise derive from `PORT` (default 3000).
 */
export function resolveE2eBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.E2E_BASE_URL?.trim();
  if (override) return override;
  return `http://127.0.0.1:${resolveE2ePort(env)}`;
}

/**
 * Site origin baked into metadata at build time (`NEXT_PUBLIC_SITE_URL`).
 * In CI e2e this matches the local server; locally it defaults to production.
 */
export function expectedSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : 'https://aitodaybrief.com';
  return base.replace(/\/$/, '');
}

export const CONSENT_STORAGE_KEY = 'atb-consent-v1';
export const CONSENT_STORAGE_VALUE =
  '{"analytics":false,"ads":false,"updatedAt":"2026-01-01T00:00:00.000Z"}';

/** Playwright storageState seeded before each test so the consent banner never intercepts clicks. */
export function consentStorageState(origin = resolveE2eBaseUrl()) {
  return {
    cookies: [] as [],
    origins: [
      {
        origin,
        localStorage: [{ name: CONSENT_STORAGE_KEY, value: CONSENT_STORAGE_VALUE }],
      },
    ],
  };
}
