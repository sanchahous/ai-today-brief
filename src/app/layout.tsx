import type { Metadata } from 'next';
import './globals.css';
import { GoogleAnalytics } from '@/components/google-analytics';
import { analyticsConfigured } from '@/lib/analytics-config';
import { CONSENT_MODE_DEFAULTS_SCRIPT } from '@/lib/consent-mode-snippet';
import { SITE_NAME, SITE_URL, SITE_TAGLINE, DEFAULT_LANG } from '@/lib/site';
import { THEME_COLORS } from '@/lib/theme';
import { cyrillicFont, displayFont, displayItalicFont, sansFont } from './fonts';

/** Parser-blocking: apply the complete theme before body pixels or hydration. */
const CHROME_INIT_SCRIPT = `(function(){var t;try{t=localStorage.getItem('theme');}catch(e){/* Use system preference when storage is blocked. */}var light=t==='light'||(t!=='dark'&&t!=='light'&&window.matchMedia('(prefers-color-scheme: light)').matches);var root=document.documentElement;var name=light?'day':'night';root.classList.toggle('theme-light',light);root.dataset.theme=name;root.style.colorScheme=light?'light':'dark';document.querySelectorAll('meta[data-theme-color]').forEach(function(meta){meta.setAttribute('media',meta.getAttribute('data-theme-color')===name?'all':'not all');});var m=location.pathname.match(/^\\/(en|uk)(\\/|$)/);if(m)root.lang=m[1];})();`;

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
  // Meta Business domain verification — required before the Page/Instagram
  // publishing permissions can be granted to the social delivery app.
  verification: {
    other: { 'facebook-domain-verification': 'w17i9sshj5ihih4t4k5scomu7h6kek' },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_LANG}
      data-theme="night"
      suppressHydrationWarning
      className={`h-full ${displayFont.variable} ${displayItalicFont.variable} ${sansFont.variable} ${cyrillicFont.variable}`}
    >
      <head>
        {/* Select by the actual theme, including saved preferences that override the OS. */}
        <meta
          name="theme-color"
          content={THEME_COLORS.night}
          data-theme-color="night"
          media="all"
          suppressHydrationWarning
        />
        <meta
          name="theme-color"
          content={THEME_COLORS.day}
          data-theme-color="day"
          media="not all"
          suppressHydrationWarning
        />
        <script dangerouslySetInnerHTML={{ __html: CHROME_INIT_SCRIPT }} />
        {analyticsConfigured ? (
          <script dangerouslySetInnerHTML={{ __html: CONSENT_MODE_DEFAULTS_SCRIPT }} />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
