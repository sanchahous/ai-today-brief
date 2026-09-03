import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isSocialTrackingToken } from '@/lib/social/tracked-url';

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

export async function POST(request: NextRequest) {
  let token = '';
  try {
    const body: unknown = JSON.parse(await request.text());
    if (body && typeof body === 'object' && 'token' in body && typeof body.token === 'string') {
      token = body.token;
    }
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!isSocialTrackingToken(token)) return new NextResponse(null, { status: 400 });
  if (deviceClass(request.headers.get('user-agent')) === 'bot') {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase
    .from('social_posts')
    .select('id')
    .eq('tracking_token', token)
    .maybeSingle();
  if (!post) return new NextResponse(null, { status: 204 });

  await supabase.from('social_click_events').insert({
    social_post_id: post.id,
    referrer_host: referrerHost(request.headers.get('referer')),
    device_class: deviceClass(request.headers.get('user-agent')),
  });
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set('atb_social_post_id', post.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 86_400,
    path: '/',
  });
  return response;
}
