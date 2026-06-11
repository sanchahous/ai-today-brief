/**
 * Stage 3.7 — Enrich (Phase 1 of the portal plan).
 *
 * For the top pool candidates, fetch the actual source page and extract:
 *   - the main article text (heuristic readability — dependency-free),
 *   - og:image (future hero image for the item page),
 *   - top Hacker News comments when the story has an HN discussion.
 *
 * The summarizer then writes from SOURCE MATERIAL instead of a bare headline —
 * the single biggest content-quality lever from the 2026-06 audit: headline-only
 * input produced vendor-fluff with zero numbers and a hallucination risk.
 *
 * Pure helpers (`extractMainText`, `extractOgImage`, `decodeEntities`,
 * `stripHtml`) are unit-tested; the network orchestration is covered by live
 * runs. Every fetch failure degrades to "no source material for this ref" —
 * the prompt tells the model to write conservatively in that case.
 */

import { logError, logEvent } from './log';
import type { PoolItem } from './select';
import { fetchWithRetry } from './sources/http';

/** Cap on extracted article text per candidate (chars, ~2k tokens). */
export const MAX_SOURCE_TEXT_CHARS = 8_000;
/** Cap on fetched HTML before extraction (chars). */
const MAX_HTML_CHARS = 600_000;
/** Lines shorter than this are nav/menu crumbs, not prose. */
const MIN_PROSE_LINE_CHARS = 40;
/** Top HN comments to attach per story. */
const HN_COMMENTS_LIMIT = 5;
/** Cap on each HN comment's text (chars). */
const MAX_COMMENT_CHARS = 600;

export interface HnComment {
  author: string;
  text: string;
  url: string;
}

export interface EnrichedSource {
  ref: number;
  url: string;
  /** Extracted main text, or null when fetch/extraction failed. */
  text: string | null;
  ogImage: string | null;
  comments: HnComment[];
}

// ─── Pure HTML helpers ───────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

/** Drop tags + collapse whitespace; block-level closers become line breaks. */
export function stripHtml(html: string): string {
  const text = html
    .replace(/<\/(p|div|section|article|li|h[1-6]|blockquote|pre|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

function removeNonContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|form|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
}

function largestBlock(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let best: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!best || m[1]!.length > best.length) best = m[1]!;
  }
  return best;
}

/**
 * Heuristic readability: prefer the largest `<article>`, then `<main>`, then
 * the whole `<body>`; strip tags; keep prose-length lines only; cap length.
 * Returns null when nothing prose-like survives (SPA shells, paywalls).
 */
export function extractMainText(html: string, maxChars = MAX_SOURCE_TEXT_CHARS): string | null {
  const cleaned = removeNonContent(html.slice(0, MAX_HTML_CHARS));
  const scope =
    largestBlock(cleaned, 'article') ??
    largestBlock(cleaned, 'main') ??
    largestBlock(cleaned, 'body') ??
    cleaned;

  const lines = stripHtml(scope)
    .split('\n')
    .filter((line) => line.length >= MIN_PROSE_LINE_CHARS);
  if (lines.length === 0) return null;

  const text = lines.join('\n\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/** `og:image` (or `twitter:image` fallback) from the page head. */
export function extractOgImage(html: string): string | null {
  const head = html.slice(0, 50_000);
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    const url = m?.[1] ? decodeEntities(m[1]).trim() : '';
    if (url.startsWith('http')) return url;
  }
  return null;
}

/** HN story id from an Algolia/HN discussion link, or null. */
export function hnStoryIdFromUrl(sourceUrl: string | undefined): string | null {
  if (!sourceUrl) return null;
  const m = sourceUrl.match(/news\.ycombinator\.com\/item\?id=(\d+)/);
  return m?.[1] ?? null;
}

// ─── Network orchestration ───────────────────────────────────────────────────
/* v8 ignore start -- live network; pure helpers above are unit-tested */

const FETCH_HEADERS = {
  'User-Agent': 'ai-today-brief/1.0 (daily AI/dev brief pipeline)',
  Accept: 'text/html,application/xhtml+xml',
};

async function fetchPage(
  url: string,
  retry: typeof fetchWithRetry,
): Promise<{ text: string | null; ogImage: string | null }> {
  const res = await retry(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) }, 2);
  if (!res?.ok) return { text: null, ogImage: null };
  const html = (await res.text()).slice(0, MAX_HTML_CHARS);
  return { text: extractMainText(html), ogImage: extractOgImage(html) };
}

async function fetchTopHnComments(
  storyId: string,
  retry: typeof fetchWithRetry,
): Promise<HnComment[]> {
  const url = `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=${HN_COMMENTS_LIMIT}`;
  const res = await retry(url, { signal: AbortSignal.timeout(10_000) }, 2);
  if (!res?.ok) return [];
  const json = (await res.json()) as { hits?: unknown[] };
  return ((json.hits ?? []) as Record<string, unknown>[])
    .map((hit) => {
      const text = stripHtml(String(hit.comment_text ?? ''))
        .replace(/\n+/g, ' ')
        .trim()
        .slice(0, MAX_COMMENT_CHARS);
      return {
        author: String(hit.author ?? 'anon'),
        text,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      };
    })
    .filter((c) => c.text.length > 0);
}

/**
 * Enrich the top `limit` pool candidates concurrently. `discussionUrlByUrl`
 * maps a candidate's article URL to its HN discussion link (from the fetch
 * stage), so community reactions attach to the right story.
 */
export async function enrichPool(
  pool: PoolItem[],
  discussionUrlByUrl: Map<string, string>,
  limit: number,
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<EnrichedSource[]> {
  const targets = pool.slice(0, limit);
  if (targets.length === 0) return [];
  const start = Date.now();

  const enriched = await Promise.all(
    targets.map(async (item): Promise<EnrichedSource> => {
      try {
        const storyId = hnStoryIdFromUrl(discussionUrlByUrl.get(item.url));
        const [page, comments] = await Promise.all([
          fetchPage(item.url, retry),
          storyId ? fetchTopHnComments(storyId, retry) : Promise.resolve([]),
        ]);
        return { ref: item.ref, url: item.url, text: page.text, ogImage: page.ogImage, comments };
      } catch (e) {
        logError('enrich', 'Candidate enrichment failed (non-fatal)', e, { url: item.url });
        return { ref: item.ref, url: item.url, text: null, ogImage: null, comments: [] };
      }
    }),
  );

  logEvent('info', 'enrich', 'Enrich stage complete', {
    targets: targets.length,
    with_text: enriched.filter((e) => e.text).length,
    with_image: enriched.filter((e) => e.ogImage).length,
    with_comments: enriched.filter((e) => e.comments.length > 0).length,
    duration_ms: Date.now() - start,
  });
  return enriched;
}
/* v8 ignore end */
