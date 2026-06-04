import { type NextRequest, NextResponse } from 'next/server';
import {
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  resolvePreferredLang,
} from '@/lib/preferred-lang';
import type { Lang } from '@/lib/site';

function persistLangCookie(response: NextResponse, lang: Lang): void {
  response.cookies.set(LANG_COOKIE, lang, {
    path: '/',
    maxAge: LANG_COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split('/')[1];

  const response =
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
      : NextResponse.next();

  if (segment === 'en' || segment === 'uk') {
    persistLangCookie(response, segment);
  }

  return response;
}

export const config = {
  matcher: ['/', '/en', '/uk', '/en/:path*', '/uk/:path*'],
};
