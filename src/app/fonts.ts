import localFont from 'next/font/local';

// Byte-identical prototype subsets and OFL licenses live in _fonts: Vercel excludes artifacts/.
// Only upright display and body faces preload.
export const displayFont = localFont({
  src: './_fonts/display.woff2',
  weight: '100 900',
  variable: '--font-ah-display',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

export const displayItalicFont = localFont({
  src: './_fonts/display-italic.woff2',
  weight: '100 900',
  style: 'italic',
  variable: '--font-ah-display-italic',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

export const sansFont = localFont({
  src: './_fonts/sans.woff2',
  weight: '100 900',
  variable: '--font-ah-sans',
  display: 'swap',
  adjustFontFallback: 'Arial',
});

export const cyrillicFont = localFont({
  src: './_fonts/sans-uk.woff2',
  weight: '100 900',
  variable: '--font-ah-cyrillic',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
