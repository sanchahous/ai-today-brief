/**
 * IndexNow — instant "please recrawl these URLs" ping.
 *
 * Google IGNORES IndexNow, so this does not help Google indexing directly. The
 * value is AEO/GEO: Bing, Yandex, Seznam and Naver honour it, and Bing's index
 * feeds ChatGPT Search + Copilot — the answer engines this dev audience uses and
 * that `robots.ts` already welcomes (OAI-SearchBot et al.). Faster Bing indexing
 * ⇒ faster citation in those engines. Fired on brief publish (telegram
 * `handlePublish`) and available as a one-shot backfill script.
 *
 * Single source of truth for the key = env `INDEXNOW_KEY`. The same value is
 * served at `/indexnow-key.txt` (app route) and referenced via `keyLocation`, so
 * the key never has to double as a filename.
 */
import { SITE_URL } from '@/lib/site';

/** Public IndexNow key — also the body of `/indexnow-key.txt`. Unset ⇒ pinging off. */
export const INDEXNOW_KEY = (process.env.INDEXNOW_KEY ?? '').trim();

export const indexNowConfigured = INDEXNOW_KEY.length > 0;

/** Aggregating endpoint — forwards one submission to every participating engine. */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** IndexNow caps a single submission at 10 000 URLs. */
export const INDEXNOW_MAX_URLS = 10_000;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/** Host of `siteUrl` — IndexNow requires every URL to share this host. '' if unparsable. */
export function siteHost(siteUrl: string = SITE_URL): string {
  try {
    return new URL(siteUrl).host;
  } catch {
    return '';
  }
}

/**
 * Keep only absolute same-host URLs, dedupe (order-preserving) and cap at the
 * IndexNow limit. Returns `[]` when nothing is submittable.
 */
export function sanitizeUrls(urls: readonly string[], siteUrl: string = SITE_URL): string[] {
  const host = siteHost(siteUrl);
  if (!host) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.host !== host) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= INDEXNOW_MAX_URLS) break;
  }
  return out;
}

/** Build the IndexNow request body, or `null` when there is no key / no valid URL. */
export function buildIndexNowPayload(
  urls: readonly string[],
  opts: { key?: string; siteUrl?: string } = {},
): IndexNowPayload | null {
  const key = (opts.key ?? INDEXNOW_KEY).trim();
  const siteUrl = opts.siteUrl ?? SITE_URL;
  if (!key) return null;
  const urlList = sanitizeUrls(urls, siteUrl);
  if (urlList.length === 0) return null;
  return {
    host: siteHost(siteUrl),
    key,
    keyLocation: `${siteUrl}/indexnow-key.txt`,
    urlList,
  };
}

export interface IndexNowResult {
  ok: boolean;
  /** True when the ping was a no-op (no key configured, or no submittable URLs). */
  skipped?: boolean;
  status?: number;
  submitted: number;
}

/**
 * Best-effort submit — NEVER throws. A failed ping must not break publish, so a
 * network error / non-2xx is logged and swallowed. `fetchImpl` is injectable for
 * tests.
 */
export async function submitToIndexNow(
  urls: readonly string[],
  opts: { key?: string; siteUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<IndexNowResult> {
  const payload = buildIndexNowPayload(urls, opts);
  if (!payload) return { ok: false, skipped: true, submitted: 0 };

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, status: res.status, submitted: payload.urlList.length };
  } catch (err) {
    console.error('[indexnow] submit failed:', err instanceof Error ? err.message : String(err));
    return { ok: false, submitted: 0 };
  }
}
