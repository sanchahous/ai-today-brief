import { buildRssFeed } from '@/lib/rss-feed';

export const revalidate = 1800;

/** English RSS feed — the primary edition. */
export async function GET() {
  const xml = await buildRssFeed('en');
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600',
    },
  });
}
