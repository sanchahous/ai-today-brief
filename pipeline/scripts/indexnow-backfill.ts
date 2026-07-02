/**
 * One-shot IndexNow backfill: submit every URL currently in the live sitemap to
 * Bing/Yandex (and, via Bing, ChatGPT Search / Copilot). Use once after enabling
 * IndexNow to push the existing catalogue that predates the on-publish ping —
 * from then on `handlePublish` keeps new briefs fresh automatically.
 *
 *   INDEXNOW_KEY=… NEXT_PUBLIC_SITE_URL=https://aitodaybrief.com \
 *     npm run indexnow:backfill
 *
 * Reads the live `/sitemap.xml` (no DB access needed) and pings in one request.
 */
import { SITE_URL } from '@/lib/site';
import { indexNowConfigured, submitToIndexNow } from '@/lib/indexnow';

/** Pull the <loc> values out of a sitemap XML string. */
function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function main(): Promise<void> {
  if (!indexNowConfigured) {
    console.error('[indexnow:backfill] INDEXNOW_KEY is not set — nothing to do.');
    process.exit(1);
  }

  const sitemapUrl = `${SITE_URL}/sitemap.xml`;
  console.info(`[indexnow:backfill] fetching ${sitemapUrl}`);
  const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.error(`[indexnow:backfill] sitemap fetch failed: HTTP ${res.status}`);
    process.exit(1);
  }

  const urls = extractLocs(await res.text());
  console.info(`[indexnow:backfill] found ${urls.length} URL(s) — submitting`);

  const result = await submitToIndexNow(urls);
  console.info(
    `[indexnow:backfill] submitted=${result.submitted} ok=${result.ok} status=${result.status ?? '-'}`,
  );
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[indexnow:backfill] failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
