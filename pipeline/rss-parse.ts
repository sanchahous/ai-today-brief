/**
 * Minimal RSS/Atom parser (pure, unit-tested). No XML dependency — a regex pass
 * over `<item>`/`<entry>` blocks is enough for the handful of feeds we read, and
 * keeps the bundle dependency-free. Only items inside the rolling window survive.
 */

import type { FetchedArticle } from './sources/http';
import { rollingWindowCutoffMs } from './rolling-window';

function tagText(block: string, tag: string): string {
  const m = block.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i'),
  );
  return m?.[1]?.trim() ?? '';
}

export function parseRssFeedXml(
  xml: string,
  sourceName: string,
  sourceUrl: string,
  nowMs = Date.now(),
): FetchedArticle[] {
  const items: FetchedArticle[] = [];
  const cutoffMs = rollingWindowCutoffMs(nowMs);

  const parseBlock = (block: string): void => {
    const title = tagText(block, 'title');
    const link = tagText(block, 'link') || block.match(/href="([^"]+)"/)?.[1] || '';
    const pubDate =
      tagText(block, 'pubDate') || tagText(block, 'published') || tagText(block, 'updated');
    const ts = pubDate ? new Date(pubDate).getTime() : 0;
    if (!link || !title || Number.isNaN(ts) || ts < cutoffMs) return;
    items.push({
      source_name: sourceName,
      source_url: sourceUrl,
      title,
      url: link,
      published_at: new Date(ts).toISOString(),
      raw: { title, link, pubDate },
      hn_score: null,
      hn_comments: null,
      reddit_score: null,
      reddit_comments: null,
      inbrief_score: null,
    });
  };

  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) parseBlock(m[1]!);
  while ((m = entryRe.exec(xml)) !== null) parseBlock(m[1]!);
  return items;
}
