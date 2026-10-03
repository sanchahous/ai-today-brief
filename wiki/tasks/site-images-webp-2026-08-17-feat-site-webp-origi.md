# site-images-webp-2026-08-17-feat-site-webp-origi

Summary: Статусний фрагмент site-images-webp-2026-08-17-feat-site-webp-origi. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: site-images-webp-2026-08-17-feat-site-webp-origi

## Status

### now.md

```verbatim
- **Site images → WebP (2026-08-17), гілка `feat/site-webp-origins`.** Браузер на сайті
  отримує WebP через `image-loader` (`format=webp` на Supabase transform), навіть якщо
  origin у бакеті JPEG. Нові weekly `story_image` (Visuals upload і render-persist)
  пишуться як WebP 1600×900 q82. **Не** чіпали origin новинних карток і weekly cover —
  це `og:image` / Satori, які WebP не декодують; Instagram/social лишаються JPEG.
  Уже завантажені 7 JPEG на `ai-weekly-2026-08-09` на сайті теж підуть як WebP після
  деплою, без повторного upload. (source: `src/lib/encode-site-image.ts`,
  `src/lib/image-loader.ts`, [ops/vercel-image-quota](ops/vercel-image-quota.md))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
