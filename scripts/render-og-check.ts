/**
 * Offline verification of the OG card's Satori render (the dev server OOMs in
 * this environment). Renders the exact opengraph-image.tsx layout via next/og
 * ImageResponse directly — same fonts, same overlay — for both the AI-image-bg
 * path and the duotone fallback, so we can eyeball Cyrillic + fonts + layout.
 *
 * Run: npx tsx scripts/render-og-check.ts
 */
import React from 'react';
import { ImageResponse } from 'next/og';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { duotoneDataUri, paletteFromCategory } from '../src/lib/card/duotone';

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs', 'marketing', 'card-samples');
const FONT_DIR = join(ROOT, 'src', 'app', '[lang]', '[brief]', '[item]', '_fonts');
const h = React.createElement;
const font = (p: string) => readFileSync(join(FONT_DIR, p));

function Card(props: {
  title: string;
  category: string;
  accent: string;
  dateLabel: string;
  background: string;
}) {
  const { title, category, accent, dateLabel, background } = props;
  return h(
    'div',
    { style: { position: 'relative', display: 'flex', width: '100%', height: '100%', backgroundColor: '#0b0b0b' } },
    h('img', { src: background, width: 1200, height: 630, style: { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' } }),
    h('div', { style: { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, background: 'linear-gradient(180deg, rgba(11,11,11,0.55) 0%, rgba(11,11,11,0.12) 24%, rgba(11,11,11,0.12) 42%, rgba(11,11,11,0.74) 80%, rgba(11,11,11,0.95) 100%)' } }),
    h(
      'div',
      { style: { position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '56px 64px', color: '#ffffff', fontFamily: 'Inter' } },
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 14 } },
          h('div', { style: { width: 16, height: 16, borderRadius: 9999, background: accent } }),
          h('div', { style: { fontSize: 24, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: accent } }, category),
        ),
        h('div', { style: { fontSize: 24, color: '#dcdcdc' } }, dateLabel),
      ),
      h('div', { style: { fontSize: 56, fontWeight: 700, lineHeight: 1.13, maxWidth: 1010, display: 'block', lineClamp: 3 } }, title),
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid rgba(255,255,255,0.2)', paddingTop: 22 } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'flex-end', gap: 16 } },
          h('div', { style: { display: 'flex', alignItems: 'baseline', fontSize: 31, fontWeight: 600, fontFamily: 'Fraunces', color: '#ffffff' } }, h('span', null, 'AI Today'), h('span', { style: { color: '#f0c040', marginLeft: 8 } }, 'Brief')),
          h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 3, paddingBottom: 6 } }, [6, 11, 15, 21].map((bar) => h('div', { key: bar, style: { width: 4, height: bar, borderRadius: 2, background: '#f0c040' } }))),
        ),
        h('div', { style: { fontSize: 23, color: '#c4cbd6' } }, 'aitodaybrief.com'),
      ),
    ),
  );
}

const fonts = [
  { name: 'Inter', data: font('inter-latin-700.woff'), weight: 700 as const, style: 'normal' as const },
  { name: 'Inter Cyrillic', data: font('inter-cyrillic-700.woff'), weight: 700 as const, style: 'normal' as const },
  { name: 'Fraunces', data: font('fraunces-latin-600.woff'), weight: 600 as const, style: 'normal' as const },
];

async function render(el: React.ReactElement, file: string) {
  const img = new ImageResponse(el, { width: 1200, height: 630, fonts });
  writeFileSync(join(OUT, file), Buffer.from(await img.arrayBuffer()));
  console.log('rendered', file);
}

async function main() {
  await render(
    Card({
      title: 'Ноам Шазір переходить до OpenAI після роботи в Google',
      category: 'Моделі',
      accent: '#5bc9f0',
      dateLabel: '17 червня 2026',
      background:
        'https://mdiqfatpqczwqghwttpm.supabase.co/storage/v1/object/public/card-images/noam-shazeer-joins-openai-after-leaving-google.png',
    }),
    'og-check-ai-image.png',
  );
  await render(
    Card({
      title: 'Критична вразливість у популярному AI-фреймворку — оновіться негайно',
      category: 'Безпека',
      accent: '#e8825a',
      dateLabel: '17 червня 2026',
      background: duotoneDataUri({ seed: 'og-check', palette: paletteFromCategory('#e8825a') }),
    }),
    'og-check-duotone.png',
  );
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
