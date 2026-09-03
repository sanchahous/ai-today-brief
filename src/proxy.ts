import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, resolvePreferredLang } from '@/lib/preferred-lang';
import { resolveWeeklyPublicSlug } from '@/lib/weekly-digest/placeholder-slug';
import type { Lang } from '@/lib/site';

type WeeklyRow = { slug?: unknown };

function weeklyRestHeaders(key: string) {
  return {
    accept: 'application/json',
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function fetchWeeklyRows(
  origin: string,
  key: string,
  params: Array<[string, string]>,
): Promise<WeeklyRow[] | null> {
  try {
    const endpoint = new URL('/rest/v1/weekly_digests', origin);
    for (const [name, value] of params) endpoint.searchParams.set(name, value);
    const result = await fetch(endpoint, {
      headers: weeklyRestHeaders(key),
      cache: 'no-store',
    });
    if (!result.ok) return null;
    const rows: unknown = await result.json();
    return Array.isArray(rows) ? (rows as WeeklyRow[]) : null;
  } catch {
    return null;
  }
}

function firstSlug(rows: WeeklyRow[] | null): string | null {
  const slug = rows?.[0]?.slug;
  return typeof slug === 'string' && slug.length > 0 ? slug : null;
}

function weeklyLookup(origin: string, key: string) {
  return {
    async isPublished(slug: string): Promise<boolean | null> {
      const rows = await fetchWeeklyRows(origin, key, [
        ['select', 'id'],
        ['slug', `eq.${slug}`],
        ['status', 'eq.published'],
        ['limit', '1'],
      ]);
      if (!rows) return null;
      return rows.length > 0;
    },
    async publishedSlugForWeek(weekStart: string, isTest: boolean): Promise<string | null> {
      const rows = await fetchWeeklyRows(origin, key, [
        ['select', 'slug'],
        ['week_start', `eq.${weekStart}`],
        ['status', 'eq.published'],
        ['is_test', `eq.${isTest}`],
        ['limit', '1'],
      ]);
      return firstSlug(rows);
    },
  };
}

function weeklyStatusPage(lang: Lang, status: 404 | 503) {
  const isUk = lang === 'uk';
  const unavailable = status === 503;
  const title = unavailable
    ? isUk
      ? 'Дайджест тимчасово недоступний'
      : 'Digest temporarily unavailable'
    : isUk
      ? 'Дайджест не знайдено'
      : 'Digest not found';
  const message = unavailable
    ? isUk
      ? 'Не вдалося безпечно перевірити статус публікації. Спробуйте ще раз за кілька хвилин.'
      : 'We could not safely verify the publication status. Please try again in a few minutes.'
    : isUk
      ? 'Цей випуск ще не опублікований або такої адреси не існує.'
      : 'This issue is not published yet, or the address does not exist.';
  const back = isUk ? 'Переглянути опубліковані дайджести' : 'Browse published digests';
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} | AI Today Brief</title></head><body style="margin:0;background:#0b0f12;color:#f5f5f0;font-family:Arial,sans-serif"><main style="max-width:760px;margin:0 auto;padding:18vh 24px"><p style="color:#42e8d0;font-weight:700;letter-spacing:.12em">AI TODAY BRIEF</p><h1 style="font:700 clamp(36px,7vw,72px)/1.05 Georgia,serif;margin:24px 0">${title}</h1><p style="max-width:620px;color:#b9c0c5;font-size:20px;line-height:1.6">${message}</p><a href="/${lang}/digests" style="display:inline-block;margin-top:24px;color:#42e8d0;font-weight:700">${back}</a></main></body></html>`;
  const response = new NextResponse(html, {
    status,
    headers: {
      'cache-control': 'private, no-store, max-age=0',
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
  persistLangCookie(response, lang);
  return response;
}

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
  const weeklyMatch = pathname.match(/^\/(en|uk)\/weekly\/([^/]+)\/?$/);
  if (weeklyMatch) {
    const lang = weeklyMatch[1] as Lang;
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (origin && key) {
      const resolution = await resolveWeeklyPublicSlug(
        decodeURIComponent(weeklyMatch[2]),
        weeklyLookup(origin, key),
      );
      if (resolution.kind === 'missing') return weeklyStatusPage(lang, 404);
      if (resolution.kind === 'redirect') {
        const target = request.nextUrl.clone();
        target.pathname = `/${lang}/weekly/${resolution.slug}`;
        const redirected = NextResponse.redirect(target, 308);
        persistLangCookie(redirected, lang);
        return redirected;
      }
      // 'pass' includes lookup failure: ISR-cached HTML must still serve.
    }
  }
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
