import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function deviceClass(userAgent: string | null): 'mobile' | 'desktop' | 'bot' | 'unknown' {
  if (!userAgent) return 'unknown';
  if (/bot|crawler|spider|preview|facebookexternalhit|telegrambot/i.test(userAgent)) return 'bot';
  if (/mobile|android|iphone|ipad/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function referrerHost(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname.slice(0, 255);
  } catch {
    return null;
  }
}

/**
 * Social crawlers do not render the destination behind a 302: Facebook's
 * scraper in particular resolves no Open Graph data through a `no-store`
 * redirect, which is why a shared tracked link renders as a bare domain with
 * no cover. They also must not count as clicks — before this split, crawler
 * previews were 34 of the 42 rows in `social_click_events`.
 */
function crawlerPreview(destination: string) {
  const safe = destination.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><link rel="canonical" href="${safe}"><meta property="og:url" content="${safe}"><meta http-equiv="refresh" content="0;url=${safe}"></head><body><a href="${safe}">Continue</a></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=600' } },
  );
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.redirect(new URL('/', SITE_URL), 302);
  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase
    .from('social_posts')
    .select('id,utm_url')
    .eq('tracking_token', token)
    .maybeSingle();
  if (!post?.utm_url) return NextResponse.redirect(new URL('/', SITE_URL), 302);

  if (deviceClass(request.headers.get('user-agent')) === 'bot') {
    return crawlerPreview(post.utm_url);
  }

  await supabase.from('social_click_events').insert({
    social_post_id: post.id,
    referrer_host: referrerHost(request.headers.get('referer')),
    device_class: deviceClass(request.headers.get('user-agent')),
  });
  const response = NextResponse.redirect(post.utm_url, {
    status: 302,
    headers: { 'cache-control': 'no-store, private' },
  });
  response.cookies.set('atb_social_post_id', post.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 86_400,
    path: '/',
  });
  return response;
}
