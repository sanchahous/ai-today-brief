import { NextResponse, type NextRequest } from 'next/server';
import { getSocialAdminSession } from '@/lib/admin-auth';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyOAuthState, type SocialOAuthProvider } from '@/lib/social/oauth-state';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

function redirectUri(provider: SocialOAuthProvider) {
  return new URL(`/api/oauth/${provider}/callback`, SITE_URL).toString();
}

function settingsRedirect(request: NextRequest, result: 'connected' | 'error', detail?: string) {
  const url = new URL('/admin/settings', request.url);
  url.searchParams.set('oauth', result);
  if (detail) url.searchParams.set('detail', detail.slice(0, 160));
  const response = NextResponse.redirect(url);
  response.cookies.set('social_oauth_nonce', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/api/oauth',
  });
  return response;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T;
  if (!response.ok)
    throw new Error(`OAuth HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function storeToken(
  channel: string,
  token: string,
  expiresIn: number,
  providerId?: string | null,
  refreshToken?: string | null,
) {
  const expiry = new Date(Date.now() + Math.max(300, expiresIn) * 1000).toISOString();
  const { error } = await getSupabaseAdmin().rpc('store_social_oauth_secret', {
    p_channel: channel,
    p_secret: JSON.stringify({
      access_token: token,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    }),
    p_expires_at: expiry,
    p_provider_account_id: providerId ?? null,
  });
  if (error) throw new Error(error.message);
}

async function connectLinkedIn(code: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.LINKEDIN_CLIENT_ID?.trim() ?? '',
    client_secret: process.env.LINKEDIN_CLIENT_SECRET?.trim() ?? '',
    redirect_uri: redirectUri('linkedin'),
  });
  const token = await readJson<TokenResponse>(
    await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20_000),
    }),
  );
  if (!token.access_token) throw new Error('LinkedIn returned no access token.');
  const { data: account } = await getSupabaseAdmin()
    .from('social_accounts')
    .select('provider_account_id')
    .eq('channel', 'linkedin')
    .maybeSingle();
  await storeToken(
    'linkedin',
    token.access_token,
    token.expires_in ?? 5_184_000,
    process.env.LINKEDIN_ORGANIZATION_URN?.trim() || account?.provider_account_id,
    token.refresh_token,
  );
}

async function connectThreads(code: string) {
  const appId = process.env.THREADS_APP_ID?.trim() ?? '';
  const appSecret = process.env.THREADS_APP_SECRET?.trim() ?? '';
  const short = await readJson<TokenResponse>(
    await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri('threads'),
        code,
      }),
      signal: AbortSignal.timeout(20_000),
    }),
  );
  if (!short.access_token) throw new Error('Threads returned no access token.');
  const longUrl = new URL('https://graph.threads.net/access_token');
  longUrl.searchParams.set('grant_type', 'th_exchange_token');
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('access_token', short.access_token);
  const token = await readJson<TokenResponse>(
    await fetch(longUrl, { signal: AbortSignal.timeout(20_000) }),
  );
  const accessToken = token.access_token ?? short.access_token;
  const meUrl = new URL('https://graph.threads.net/me');
  meUrl.searchParams.set('fields', 'id,username');
  meUrl.searchParams.set('access_token', accessToken);
  const me = await readJson<{ id?: string; username?: string }>(await fetch(meUrl));
  await storeToken('threads', accessToken, token.expires_in ?? 5_184_000, me.id, accessToken);
  if (me.username) {
    await getSupabaseAdmin()
      .from('social_accounts')
      .update({ handle: me.username })
      .eq('channel', 'threads');
  }
}

async function connectMeta(code: string) {
  const version = process.env.META_GRAPH_VERSION?.trim() || 'v24.0';
  const appId = process.env.META_APP_ID?.trim() ?? '';
  const appSecret = process.env.META_APP_SECRET?.trim() ?? '';
  const shortUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  shortUrl.searchParams.set('client_id', appId);
  shortUrl.searchParams.set('client_secret', appSecret);
  shortUrl.searchParams.set('redirect_uri', redirectUri('meta'));
  shortUrl.searchParams.set('code', code);
  const short = await readJson<TokenResponse>(
    await fetch(shortUrl, { signal: AbortSignal.timeout(20_000) }),
  );
  if (!short.access_token) throw new Error('Meta returned no access token.');
  const longUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  longUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longUrl.searchParams.set('client_id', appId);
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('fb_exchange_token', short.access_token);
  const long = await readJson<TokenResponse>(
    await fetch(longUrl, { signal: AbortSignal.timeout(20_000) }),
  );
  const userToken = long.access_token ?? short.access_token;
  const accountsUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  accountsUrl.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username}',
  );
  accountsUrl.searchParams.set('access_token', userToken);
  const pages = await readJson<{
    data?: Array<{
      id: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id: string; username?: string };
    }>;
  }>(await fetch(accountsUrl, { signal: AbortSignal.timeout(20_000) }));
  const preferred = process.env.FACEBOOK_PAGE_ID?.trim();
  const page = pages.data?.find((candidate) => candidate.id === preferred) ?? pages.data?.[0];
  if (!page?.access_token) throw new Error('No manageable Facebook Page was returned.');
  await storeToken('facebook', page.access_token, long.expires_in ?? 5_184_000, page.id, userToken);
  await getSupabaseAdmin()
    .from('social_accounts')
    .update({ handle: page.name ?? null })
    .eq('channel', 'facebook');
  if (page.instagram_business_account?.id) {
    await storeToken(
      'instagram',
      page.access_token,
      long.expires_in ?? 5_184_000,
      page.instagram_business_account.id,
      userToken,
    );
    await getSupabaseAdmin()
      .from('social_accounts')
      .update({ handle: page.instagram_business_account.username ?? null })
      .eq('channel', 'instagram');
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const session = await getSocialAdminSession();
  if (!session) return NextResponse.redirect(new URL('/admin/login', request.url));
  if (session.aal !== 'aal2') return NextResponse.redirect(new URL('/admin/mfa', request.url));
  const stateValue = request.nextUrl.searchParams.get('state') ?? '';
  const state = verifyOAuthState(stateValue, request.cookies.get('social_oauth_nonce')?.value);
  if (!state || state.provider !== provider)
    return settingsRedirect(request, 'error', 'Invalid or expired OAuth state.');
  const providerError =
    request.nextUrl.searchParams.get('error_description') ||
    request.nextUrl.searchParams.get('error');
  if (providerError) return settingsRedirect(request, 'error', providerError);
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return settingsRedirect(request, 'error', 'Authorization code is missing.');
  try {
    if (state.provider === 'linkedin') await connectLinkedIn(code);
    else if (state.provider === 'threads') await connectThreads(code);
    else await connectMeta(code);
    return settingsRedirect(request, 'connected');
  } catch (error) {
    return settingsRedirect(
      request,
      'error',
      error instanceof Error ? error.message : 'OAuth failed.',
    );
  }
}
