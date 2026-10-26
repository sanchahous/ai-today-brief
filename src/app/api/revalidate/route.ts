import { NextResponse } from 'next/server';
import { revalidatePathsForPublish, revalidatePublicContentTag, revalidateSiteSurfaces } from '@/lib/revalidate-site';

/**
 * On-publish ISR hook for the pipeline (or manual ops).
 * POST with `Authorization: Bearer <REVALIDATE_SECRET>` and JSON `{ "paths": ["/en", "/en/news"] }`.
 * The shared site surfaces (home, news, category hubs, digests, feeds) are always
 * added. `{ "purgeAll": true }` additionally marks every public page stale — use
 * it only for changes that touch every page; it re-renders the whole catalog.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const paths = Array.isArray(record.paths)
    ? record.paths.filter((p): p is string => typeof p === 'string')
    : [];
  const purgeAll = record.purgeAll === true;

  if (purgeAll) revalidatePublicContentTag();
  revalidateSiteSurfaces(paths);
  const revalidatedPaths = revalidatePathsForPublish(paths);

  return NextResponse.json({
    revalidated: revalidatedPaths.length,
    paths: revalidatedPaths,
    purgedAll: purgeAll,
  });
}
