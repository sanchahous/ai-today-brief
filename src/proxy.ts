import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, resolvePreferredLang } from '@/lib/preferred-lang';
import type { Lang } from '@/lib/site';

function persistLangCookie(response: NextResponse, lang: Lang): void {
  response.cookies.set(LANG_COOKIE, lang, {
    path: '/',
    maxAge: LANG_COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

async function refreshSupabase(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (updates) => {
        for (const { name, value } of updates) request.cookies.set(name, value);
        for (const { name, value, options } of updates) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split('/')[1];
  let response =
    pathname === '/'
      ? NextResponse.redirect(
          new URL(
            `/${resolvePreferredLang({
              cookieLang: request.cookies.get(LANG_COOKIE)?.value,
              acceptLanguage: request.headers.get('accept-language'),
              country: request.headers.get('x-vercel-ip-country'),
            })}`,
            request.url,
          ),
        )
      : NextResponse.next({ request });

  if (segment === 'en' || segment === 'uk') persistLangCookie(response, segment);
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/oauth')
  ) {
    response = await refreshSupabase(request, response);
  }
  return response;
}

export const config = {
  matcher: [
    '/',
    '/en',
    '/uk',
    '/en/:path*',
    '/uk/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/api/oauth/:path*',
  ],
};
