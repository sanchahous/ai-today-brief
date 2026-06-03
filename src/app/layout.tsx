import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SITE_NAME, SITE_URL, SITE_TAGLINE, DEFAULT_LANG } from '@/lib/site';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
    <html
      lang={DEFAULT_LANG}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
