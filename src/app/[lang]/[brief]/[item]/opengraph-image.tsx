import { ImageResponse } from 'next/og';
import { buildFactsVisual, type FactsVisual } from '@/lib/facts-visual';
import { getBriefItem } from '@/lib/items';
import { isLang, SITE_NAME } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

/** Facts strip for the share card: mini bars when comparable, chips otherwise. */
function FactsStrip({ visual, color }: { visual: FactsVisual; color: string }) {
  if (visual.kind === 'comparison') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 36 }}>
        {visual.items.slice(0, 3).map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', width: 230, fontSize: 22, color: '#9a9a9a' }}>
              {item.label.slice(0, 24)}
            </div>
            <div
              style={{
                display: 'flex',
                width: 560,
                height: 16,
                borderRadius: 9999,
                background: '#23262d',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: Math.round(Math.max(0.07, item.ratio) * 560),
                  height: 16,
                  borderRadius: 9999,
                  background: color,
                }}
              />
            </div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#e8e8e8' }}>
              {item.display.slice(0, 18)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
      {visual.items.slice(0, 3).map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '14px 22px',
            borderRadius: 14,
            border: '1px solid #2a2a2a',
            background: '#171a20',
          }}
        >
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color }}>
            {item.display.slice(0, 16)}
          </div>
          <div style={{ display: 'flex', fontSize: 19, color: '#9a9a9a' }}>
            {item.label.slice(0, 26)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Branded share card for items without a usable source og:image (the page
 * metadata prefers the real source image when the pipeline captured one).
 * When the item has a facts box, the card doubles as a data chart —
 * P12 iteration 2: shares carry numbers, not just a headline.
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
  const factsVisual = detail?.facts?.length ? buildFactsVisual(detail.facts) : null;

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

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: factsVisual ? 44 : title.length > 70 ? 52 : 64,
              lineHeight: 1.15,
              fontWeight: 700,
              maxWidth: 1020,
              display: 'block',
              lineClamp: factsVisual ? 3 : 4,
            }}
          >
            {title}
          </div>
          {factsVisual && <FactsStrip visual={factsVisual} color={color} />}
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
