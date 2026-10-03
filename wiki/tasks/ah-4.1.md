# AH-4.1

Summary: Статусний фрагмент AH-4.1. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-4.1

## Status

### now.md

```verbatim
- **AH-4.1 (Topics / Tool у discovery) — інтегровано через PR #380 (2026-09-30), main `3d0cb2b`.**
  `src/lib/topic-normalize.ts` зводить «Claude Code», «claude-code», «ClaudeCode» до одного slug і
  має мапу лише безсумнівних аліасів; `HomeItem.topics`; `topics=` в URL; OR усередині фасету,
  AND між фасетами; лічильники за іншими фасетами; правило D8 (≥ 2 матеріали, обрана тема завжди
  видима, без даних фасет порожній). Live-перевірка prod-БД: 905 айтемів, 2866 згадок, 1256
  унікальних ключів. У `news-feed` — лише застосування `topics` з URL і чіп зі зняттям; пікер у
  sidebar — AH-4.3. AH-1.4 у PR #382 — не дублювати.
  (source: `src/lib/topic-normalize.ts`, `src/lib/news-filters.ts`; SQL-перевірка 2026-09-30;
  [ADR §2.3](decisions/2026-09-26-news-discovery-and-pagination-architecture.md); `gh pr view 380` 2026-09-30)
```

### handoff

```verbatim
- **AH-4.1 — #380:** lib/URL/active Chip інтегровані, facet picker — AH-4.3. AH-5.16 знято D6; D1–D13 ухвалено. Частково виконані AH-2.3–2.6 мають картки із залишком. (source: [епік](after-hours-redesign-epic.md); повідомлення власника 2026-10-01)
```

### epic-5.3

```verbatim
| AH-4.1 | ✅ Taxonomy Topics / Tool: lib, URL і чіп активного фільтра ([PR #380](https://github.com/sanchahous/ai-today-brief/pull/380)); пікер фасету — AH-4.3 | — | — | D8 ✅ | G06, B7 (lib/URL) |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
