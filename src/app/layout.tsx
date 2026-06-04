import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { GoogleAnalytics } from '@/components/google-analytics';
import { SITE_NAME, SITE_URL, SITE_TAGLINE, DEFAULT_LANG } from '@/lib/site';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE[DEFAULT_LANG]}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE[DEFAULT_LANG],
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, url: SITE_URL, type: 'website' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LANG} className={`${fraunces.variable} ${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
