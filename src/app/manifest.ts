import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_TAGLINE, DEFAULT_LANG } from '@/lib/site';

/**
 * Public web-app manifest. This file is served at /manifest.webmanifest for the
 * whole site — it must describe the public product, not the admin CMS (the old
 * "ATB CMS" branding + start_url=/admin leaked internal tooling to every
 * visitor's browser install prompt).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE[DEFAULT_LANG]}`,
    short_name: SITE_NAME,
    description: SITE_TAGLINE[DEFAULT_LANG],
    start_url: `/${DEFAULT_LANG}`,
    display: 'standalone',
    background_color: '#0b0f12',
    theme_color: '#0b0f12',
    orientation: 'portrait-primary',
    icons: [
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
