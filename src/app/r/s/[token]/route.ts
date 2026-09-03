import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withSocialClickToken } from '@/lib/social/tracked-url';

export const dynamic = 'force-dynamic';

/**
 * Legacy hop. New posts put `?s=` on the canonical page. Keep this 308 so
 * already-shared `/r/s/{token}` links still land on the live destination.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.redirect(new URL('/', SITE_URL), 302);
  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase
    .from('social_posts')
    .select('utm_url,url')
    .eq('tracking_token', token)
    .maybeSingle();
  const destination = post?.utm_url || post?.url;
  if (!destination) return NextResponse.redirect(new URL('/', SITE_URL), 302);
  return NextResponse.redirect(withSocialClickToken(destination, token), 308);
}
