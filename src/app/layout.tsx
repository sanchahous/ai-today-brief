import type { Metadata } from 'next';
import './globals.css';
import { GoogleAnalytics } from '@/components/google-analytics';
import { GoogleTagManager } from '@/components/google-tag-manager';
import { tagsConfigured } from '@/lib/analytics-config';
import { CONSENT_MODE_DEFAULTS_SCRIPT } from '@/lib/consent-mode-snippet';
import { SITE_NAME, SITE_URL, SITE_TAGLINE, DEFAULT_LANG } from '@/lib/site';

/** Runs before paint — theme class + document lang from URL (no flicker). */
const CHROME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var light=t==='light'||(!t&&window.matchMedia('(prefers-color-scheme: light)').matches);if(light)document.documentElement.classList.add('theme-light');}catch(e){}var m=location.pathname.match(/^\\/(en|uk)(\\/|$)/);if(m)document.documentElement.lang=m[1];})();`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE[DEFAULT_LANG]}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE[DEFAULT_LANG],
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, url: SITE_URL, type: 'website' },
  // Google Discover eligibility requires large image previews.
  robots: { 'max-image-preview': 'large' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LANG} suppressHydrationWarning className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: CHROME_INIT_SCRIPT }} />
        {tagsConfigured ? (
          <script dangerouslySetInnerHTML={{ __html: CONSENT_MODE_DEFAULTS_SCRIPT }} />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <GoogleTagManager />
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
