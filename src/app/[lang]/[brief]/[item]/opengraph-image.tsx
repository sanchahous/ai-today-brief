import { ImageResponse } from 'next/og';
import { getBriefItem } from '@/lib/items';
import { isLang, SITE_NAME } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

/**
 * Branded share card for items without a usable source og:image (the page
 * metadata prefers the real source image when the pipeline captured one).
 */
export default async function OgImage({
  params,
}: {
  params: Promise<{ lang: string; brief: string; item: string }>;
}) {
  const { lang, brief, item } = await params;
  const detail = isLang(lang) ? await getBriefItem(brief, item, lang) : null;

  const title = detail?.title ?? SITE_NAME;
  const category = detail?.categoryName ?? 'AI';
  const color = detail?.categoryColor ?? '#f0c040';
  const date = detail?.briefDate ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0f0f0f',
          color: '#e8e8e8',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: color,
            }}
          />
          <div
            style={{
              fontSize: 28,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color,
              fontWeight: 700,
            }}
          >
            {category}
          </div>
        </div>

        <div
          style={{
            fontSize: title.length > 70 ? 52 : 64,
            lineHeight: 1.15,
            fontWeight: 700,
            maxWidth: 1020,
            display: 'block',
            lineClamp: 4,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #2a2a2a',
            paddingTop: 28,
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 700, color: '#f0c040' }}>{SITE_NAME}</div>
          <div style={{ fontSize: 26, color: '#9a9a9a' }}>{date}</div>
        </div>
      </div>
    ),
    size,
  );
}
