import { SITE_NAME, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  return (
    <footer className="border-border-soft border-t">
      <div className="text-faint mx-auto max-w-[1160px] px-6 py-10 text-sm">
        <p className="text-text font-serif text-base font-semibold">{SITE_NAME}</p>
        <p className="mt-2 max-w-md">{t.footerTagline}</p>
        <p className="mt-6">
          © {new Date().getFullYear()} {SITE_NAME}. {t.rights}
        </p>
      </div>
    </footer>
  );
}
