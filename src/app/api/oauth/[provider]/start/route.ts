import { NextResponse, type NextRequest } from 'next/server';
import { getSocialAdminSession } from '@/lib/admin-auth';
import { SITE_URL } from '@/lib/site';
import { createOAuthState, type SocialOAuthProvider } from '@/lib/social/oauth-state';

function isProvider(value: string): value is SocialOAuthProvider {
  return value === 'linkedin' || value === 'meta' || value === 'threads';
}

function redirectUri(provider: SocialOAuthProvider) {
  return new URL(`/api/oauth/${provider}/callback`, SITE_URL).toString();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const session = await getSocialAdminSession();
  if (!session) return NextResponse.redirect(new URL('/admin/login', request.url));
  if (session.aal !== 'aal2') return NextResponse.redirect(new URL('/admin/mfa', request.url));
  const { provider } = await context.params;
  if (!isProvider(provider))
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 });
  const { value: state, nonce } = createOAuthState(provider);
  let authorization: URL;
  if (provider === 'linkedin') {
    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
    if (!clientId)
      return NextResponse.json({ error: 'linkedin_oauth_unconfigured' }, { status: 503 });
    authorization = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authorization.searchParams.set('response_type', 'code');
    authorization.searchParams.set('client_id', clientId);
    authorization.searchParams.set('redirect_uri', redirectUri(provider));
    authorization.searchParams.set(
      'scope',
      process.env.LINKEDIN_OAUTH_SCOPES?.trim() || 'w_organization_social',
    );
  } else if (provider === 'threads') {
    const appId = process.env.THREADS_APP_ID?.trim();
    if (!appId) return NextResponse.json({ error: 'threads_oauth_unconfigured' }, { status: 503 });
    authorization = new URL('https://threads.net/oauth/authorize');
    authorization.searchParams.set('response_type', 'code');
    authorization.searchParams.set('client_id', appId);
    authorization.searchParams.set('redirect_uri', redirectUri(provider));
    authorization.searchParams.set(
      'scope',
      'threads_basic,threads_content_publish,threads_manage_insights',
    );
  } else {
    const appId = process.env.META_APP_ID?.trim();
    if (!appId) return NextResponse.json({ error: 'meta_oauth_unconfigured' }, { status: 503 });
    const version = process.env.META_GRAPH_VERSION?.trim() || 'v24.0';
    authorization = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
    authorization.searchParams.set('client_id', appId);
    authorization.searchParams.set('redirect_uri', redirectUri(provider));
    authorization.searchParams.set(
      'scope',
      'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management',
    );
  }
  authorization.searchParams.set('state', state);
  const response = NextResponse.redirect(authorization);
  response.cookies.set('social_oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/oauth',
  });
  return response;
}
