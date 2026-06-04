import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * On-publish ISR hook for the pipeline (or manual ops).
 * POST with `Authorization: Bearer <REVALIDATE_SECRET>` and JSON `{ "paths": ["/en", "/en/news"] }`.
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

  const paths =
    body &&
    typeof body === 'object' &&
    'paths' in body &&
    Array.isArray((body as { paths: unknown }).paths)
      ? (body as { paths: unknown[] }).paths.filter((p): p is string => typeof p === 'string')
      : ['/', '/en', '/uk', '/en/news', '/uk/news'];

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: paths.length, paths });
}
