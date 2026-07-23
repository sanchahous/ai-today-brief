import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getPublishedPdfArtifact } from '@/lib/digests';
import { isLang } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { lang: string; slug: string };

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { lang, slug } = await params;
  if (!isLang(lang)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const artifact = await getPublishedPdfArtifact(slug, lang);
  if (!artifact) {
    return new NextResponse('Not found', { status: 404 });
  }

  const db = getSupabaseAdmin() as unknown as SupabaseClient;
  const filename = `${slug.replace(/[^a-z0-9-]+/gi, '-')}-${lang}.pdf`;
  const { data, error } = await db.storage
    .from(artifact.bucket)
    .createSignedUrl(artifact.path, 60, { download: filename });

  if (error || !data?.signedUrl) {
    console.error('[weekly-digest] Failed to sign published PDF', {
      slug,
      lang,
      error: error?.message,
    });
    return new NextResponse('PDF is temporarily unavailable', { status: 503 });
  }

  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: data.signedUrl,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
