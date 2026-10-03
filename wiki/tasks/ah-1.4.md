# AH-1.4

Summary: Статусний фрагмент AH-1.4. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-1.4

## Status

### now.md

```verbatim
- **AH-1.4 реалізовано у [PR #382](https://github.com/sanchahous/ai-today-brief/pull/382); очікує окремого візуального підпису.**
  Дев'ять slug-ів мають tokenKey; Night/Day текст — `--cat-*`, темні банери —
  незмінні `--art-*`. DB color лише fallback невідомих; GLYPHS із прототипу
  перенесено з aria-hidden. 54 пари контрасту ≥5.2238:1; SEO local 58 URL,
  0 errors / warnings. Ratchet після prune: 30 кольорових входжень, 4 довільні
  z-index, 0 сирих тіней і шрифтів <12 px. Потрібен окремий візуальний підпис
  власника перед merge; наступна задача після інтеграції — AH-1.2.
  (source: [AH-1.4 validation](product/after-hours-ah-1-4-validation.md);
  `src/lib/category-meta.ts`; `src/components/icons.tsx`; `src/app/globals.css`)
```

### epic-5.3

```verbatim
| AH-1.4 | ✅ Кольори й гліфи категорій: змерджено в [PR #382](https://github.com/sanchahous/ai-today-brief/pull/382), `5af8d56` ([докази](after-hours-ah-1-4-validation.md)) | — | — | — | B5 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
