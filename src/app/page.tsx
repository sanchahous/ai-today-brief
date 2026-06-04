import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LANG_COOKIE, resolvePreferredLang } from '@/lib/preferred-lang';

/** Fallback if middleware is skipped; normally `/` redirects in middleware. */
export default async function RootIndex() {
  const cookieStore = await cookies();
  const h = await headers();
  const lang = resolvePreferredLang({
    cookieLang: cookieStore.get(LANG_COOKIE)?.value,
    acceptLanguage: h.get('accept-language'),
    country: h.get('x-vercel-ip-country'),
  });
  redirect(`/${lang}`);
}
