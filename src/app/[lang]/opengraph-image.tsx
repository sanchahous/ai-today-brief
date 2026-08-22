import { ImageResponse } from 'next/og';
import { duotoneDataUri, paletteFromCategory } from '@/lib/card/duotone';
import { isLang, SITE_NAME } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

// Same edge-runtime constraint as the item card: fonts live in /public and are
// fetched over https because fetch(file://) and fs are unavailable on the edge.
const FONT = (file: string) =>
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aitodaybrief.com'}/fonts/${file}`).then(
    (r) => r.arrayBuffer(),
  );

const TAGLINE = {
  en: 'The daily AI-engineering brief — for builders.',
  uk: 'Щоденний бриф з AI-інженерії — для тих, хто будує.',
} as const;

/**
 * Default branded share card for every [lang] page that does not define its
 * own og:image (home, hubs, guides, tools, trust pages). Weekly digests keep
 * their real cover art because they set openGraph.images explicitly — Next only
 * falls back to this file when the segment metadata has no images of its own.
 */
export default async function OgImage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : 'en';
  const tagline = TAGLINE[lang];

  // Brand-teal duotone backdrop; deterministic seed so the composition is stable.
  const background = duotoneDataUri({
    seed: 'ai-today-brief-default',
    palette: paletteFromCategory('#47E4D3'),
  });

  const [interLatin, interCyr, fraunces] = await Promise.all([
    FONT('inter-latin-700.woff'),
    FONT('inter-cyrillic-700.woff'),
    FONT('fraunces-latin-600.woff'),
  ]);

  return new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', backgroundColor: '#0b0b0b' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={background}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background:
              'linear-gradient(180deg, rgba(11,11,11,0.5) 0%, rgba(11,11,11,0.1) 40%, rgba(11,11,11,0.78) 82%, rgba(11,11,11,0.95) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '56px 64px',
            color: '#ffffff',
            fontFamily: 'Inter',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {[6, 11, 15, 21].map((h) => (
              <div key={h} style={{ width: 4, height: h, borderRadius: 2, background: '#f0c040' }} />
            ))}
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: '#f0c040',
              }}
            >
              AI Today Brief
            </div>
          </div>

          <div
            style={{
              fontSize: lang === 'uk' ? 58 : 62,
              fontWeight: 600,
              lineHeight: 1.12,
              maxWidth: 1010,
              display: 'block',
              fontFamily: 'Fraunces',
            }}
          >
            {tagline}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: `2px solid rgba(255,255,255,0.2)`,
              paddingTop: 22,
            }}
          >
            <div style={{ fontSize: 23, color: '#c4cbd6' }}>aitodaybrief.com</div>
            <div style={{ fontSize: 23, color: '#c4cbd6' }}>EN + UK</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: interLatin, weight: 700, style: 'normal' },
        { name: 'Inter Cyrillic', data: interCyr, weight: 700, style: 'normal' },
        { name: 'Fraunces', data: fraunces, weight: 600, style: 'normal' },
      ],
    },
  );
}
