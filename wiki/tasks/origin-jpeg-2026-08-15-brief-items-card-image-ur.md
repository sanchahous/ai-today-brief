# origin-jpeg-2026-08-15-brief-items-card-image-ur

Summary: Статусний фрагмент origin-jpeg-2026-08-15-brief-items-card-image-ur. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: origin-jpeg-2026-08-15-brief-items-card-image-ur

## Status

### now.md

```verbatim
- **Origin JPEG новинних карток (2026-08-15).** Нові `brief_items.card_image_url`
  пишуться як `${slug}.jpg` 1280×720 q82 (`encodeCardOrigin`). Історичні PNG —
  `npx tsx scripts/backfill-card-images.ts --reencode-png` (спочатку `--dry-run`),
  без FLUX. Loader і модель новин без змін. Картинки дайджесту ручні.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [ops/vercel-image-quota](ops/vercel-image-quota.md),
  [marketing/card-images](marketing/card-images.md), `pipeline/card-image.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
