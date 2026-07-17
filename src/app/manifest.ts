import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Today Brief CMS',
    short_name: 'ATB CMS',
    description: 'Review, schedule, and monitor AI Today Brief social content.',
    start_url: '/admin',
    display: 'standalone',
    background_color: '#101418',
    theme_color: '#101418',
    orientation: 'portrait-primary',
    icons: [
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
