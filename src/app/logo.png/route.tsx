import { ImageResponse } from 'next/og';
import { MARK_COLOR } from '@/lib/site';

export const dynamic = 'force-static';

const SIZE = 512;

/**
 * Square brand logo for schema.org publisher.logo (NewsArticle rich results
 * require one) — mirrors the header monogram so the mark stays consistent.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#14161a',
          borderRadius: 96,
        }}
      >
        <div
          style={{
            fontSize: 232,
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: -8,
            color: MARK_COLOR,
          }}
        >
          AT
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
