# AH-5.5

Summary: Статусний фрагмент AH-5.5. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-5.5

## Status

### epic-5.3

```verbatim
| AH-5.5 | Weekly | L | агент + власник | AH-5.1 | route `weekly` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

Update 2026-10-04:
- Implemented layout reordering in `page.tsx`.
- Updated `WeeklyHero` to include issue number, publication date, data facts, and 16:9 safe-frame (without cropping).
- Handled SleeveArt fallback and CTA updates (including video Watch CTA).
- Set layout order to: editorNote -> actionBoard -> video -> keyTakeaways -> stories -> metrics -> discuss -> faq -> nav.
- Tests passed via pr:check.
