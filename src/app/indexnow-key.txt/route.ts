import { INDEXNOW_KEY } from '@/lib/indexnow';

export const revalidate = 86400;

/**
 * /indexnow-key.txt — serves the IndexNow key so Bing/Yandex can verify we own
 * the domain (referenced as `keyLocation` in the submission). 404 until
 * `INDEXNOW_KEY` is set, so the endpoint never leaks an empty body.
 */
export function GET() {
  if (!INDEXNOW_KEY) {
    return new Response('Not Found', { status: 404 });
  }
  return new Response(INDEXNOW_KEY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
