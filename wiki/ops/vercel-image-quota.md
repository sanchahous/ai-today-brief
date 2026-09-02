# Vercel image quota — інцидент 2026-08-14 і чому оптимізатор більше не використовується

Summary: 14 серпня всі зображення на сайті стали битими. Причина — вичерпана квота Vercel
Image Optimization, а не генерація. Оптимізатор Vercel замінено на власний loader, який
ресайзить наші картки через Supabase Storage.
Sources: live check `https://aitodaybrief.com/_next/image?…` 2026-08-14 (HTTP 402,
`X-Vercel-Error: OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`); `next.config.ts`;
`src/lib/image-loader.ts` (site delivery WebP, 2026-08-17); `pipeline/card-image.ts` origin JPEG 2026-08-15;
owner report 2026-08-14.
Last updated: 2026-08-17

---

## Симптом і хибний діагноз

Власник повідомив: «перестали генеруватись картинки для новин, скрізь биті картинки».
Природний висновок — зламався пайплайн генерації. **Він не ламався.**

Перевірка розділила два шари:

| Що перевірено | Результат |
|---|---|
| Файл у Supabase Storage (origin) | **HTTP 200**, 487 841 байт PNG ✅ |
| Той самий файл через `/_next/image` | **HTTP 402** ❌ |

```
X-Vercel-Error: OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED
```

Тобто зображення генерувались і зберігались нормально — їх просто перестав віддавати
оптимізатор Vercel після вичерпання квоти плану. Це другий випадок упирання в ліміти Hobby
після Fluid CPU 99.8% (див. [weekly-digest § Fluid CPU](../pipeline/weekly-digest.md)).

## Чому не `images.unoptimized: true`

Найшвидший фікс — вимкнути оптимізацію глобально. Він відновлює сайт, але віддає
**488 КБ PNG у слот 92 пікселі**. Це рівно та проблема ваги сторінки, через яку оптимізатор і
виглядає потрібним, і вона б'є по Core Web Vitals — при тому що органіка вже є вузьким місцем
(див. [audits/2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md)).

## Рішення: власний loader

`next.config.ts` → `images.loader: 'custom'` + `loaderFile: './src/lib/image-loader.ts'`.

Loader розрізняє два типи зображень, бо вони потребують різного:

1. **Наші картки в публічному бакеті Supabase.** Supabase Storage вміє ресайзити сам через
   `storage/v1/render/image/public/…?width=&quality=&format=webp`. Loader переписує шлях з
   `object/public` на `render/image/public`, додає ширину, яку просить Next, і просить **WebP**.
   Origin у бакеті може лишатись JPEG (новинні картки / weekly cover — OG і Satori не читають
   WebP); браузер на сайті все одно отримує WebP.
2. **Hero-зображення з `og:image` чужих видань.** Живуть на довільних хостах (саме тому в
   конфігу `remotePatterns: '**'`), трансформувати їх ми не можемо — проходять без змін.

Cache-buster `?v=<hash>` зі збереженого URL має вижити, тому запит перебудовується через `URL`,
а не конкатенацією другого `?`.

## Виміряний ефект

Перевірено наживо 2026-08-14 на реальній картці:

| Ширина | Через Supabase transform | Origin |
|---|---:|---:|
| 96 px | **13 252 байт** JPEG | 487 841 байт PNG |
| 184 px | **23 970 байт** JPEG | 487 841 байт PNG |
| 640 px | **55 563 байт** JPEG | 487 841 байт PNG |

У слоті 92 px це **у 37 разів менше** трафіку, ніж віддав би `unoptimized`, і нуль квоти Vercel.

## Origin JPEG (закрито 2026-08-15)

Нові картки новин пишуться як `${slug}.jpg` (`image/jpeg`, 1280×720, q82 mozjpeg)
через `encodeCardOrigin` у `pipeline/card-image.ts` — до upload, на всіх щаблях
драбини (FLUX / Pollinations / fallback). JPEG, не WebP, бо `opengraph-image.tsx`
(Satori) і OG-кrawlerи не декодують WebP. Ідемпотентний skip лишає вже збережені
`.png` (~488 КБ), поки не запустити `--reencode-png` (без FLUX):
`npx tsx scripts/backfill-card-images.ts --reencode-png`.
Модель новин без змін. Мініатюра і повне — як і раніше один файл.
(source: `pipeline/card-image.ts`, [marketing/card-images](../marketing/card-images.md))

## Site delivery WebP (2026-08-17)

Loader додає `format=webp` до кожного Supabase transform. Weekly `story_image`
(ручний upload і render-persist) пише origin як WebP 1600×900 q82
(`src/lib/encode-site-image.ts`). Cover, social/IG, thumbnail і новині картки
лишаються JPEG origin. Уже завантажені JPEG story-файли на сайті теж віддаються
як WebP через transform — переupload не обовʼязковий.
(source: `src/lib/image-loader.ts`, `src/lib/encode-site-image.ts`,
`src/app/admin/(cms)/weekly/actions.ts`)

## Що лишається відкритим

- **Квота Supabase.** Трансформації Storage теж мають ліміт за планом. Зараз працюють
  (HTTP 200), але якщо проєкт на Free — варто звірити ліміт до того, як він скінчиться так само
  раптово. `(needs verification)`
- **Hero-зображення видань** тепер віддаються без ресайзу. Для них трансформації немає взагалі;
  якщо це стане проблемою ваги — потрібен власний проксі-кеш, а не повернення до Vercel.

## Related pages

- [ops/supabase-egress-2026-09](supabase-egress-2026-09.md) — наступний 402: uncached REST JSON, не картинки
- [pipeline/weekly-digest](../pipeline/weekly-digest.md) — попереднє упирання в ліміти Hobby
- [marketing/card-images](../marketing/card-images.md) — як генеруються самі картки
- [audits/2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md) — чому вага сторінки має значення
