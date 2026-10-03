# AH-0.1

Summary: Статусний фрагмент AH-0.1. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-0.1

## Status

### now.md

```verbatim
- **AH-0.1 виконано: статус розривів G01–G20 звірено з кодом (2026-09-29), PR
  [#372](https://github.com/sanchahous/ai-today-brief/pull/372).** Підсумок за кодом і живою перевіркою production:
  **6 done** (G01, G03, G04, G08, G10, G20), **10 partial** (G02, G05, G07, G09, G11–G16),
  **2 open** (G06, G17), G18 — policy, G19 — знято рішенням власника. Тобто закрито не 20 розривів,
  а 6; запис від 2026-09-28 нижче виправлено. Головний залишок — фасети Topics/Tool (G06),
  честний обсяг видачі замість зрізу 100/80 (G05), міграція header, пошуку й share на нові
  композити (G16), editorial-компоненти (G17). Побічна знахідка: скан шрифтів < 12 px по `src/`
  виконується лише вручну (`npm run tokens:check`), у `pr:check` потрапляють контраст і drift.
  Повна таблиця з доказами — [gap-plan §10](audits/2026-09-26-design-system-gap-plan.md#10-статус-на-2026-09-29-звірка-ah-01). Наступна задача — AH-0.3.
  (source: [gap-plan §10](audits/2026-09-26-design-system-gap-plan.md#10-статус-на-2026-09-29-звірка-ah-01); grep `src/` і `npm run tokens:check` 2026-09-29; headless Chromium на production `b3f1b3a` 2026-09-29)
```

### now.md

```verbatim
- **Дизайн-система After Hours: реалізація аудиту прогалин, перший етап (2026-09-28), змержено як #367, гілка `feat/design-system-gap-implementation`.**
  Первинний запис стверджував «закрито 20 розривів (G01–G20)»; звірка AH-0.1 2026-09-29 це спростувала — за кодом закрито 6, див. пункт вище і [open-questions](open-questions.md) #10.
  Реально закрито за планом `wiki/audits/2026-09-26-design-system-gap-plan.md` (G03, G04, G08; решта — частково).
  Ухвалено ADR [decisions/2026-09-26-news-discovery-and-pagination-architecture](decisions/2026-09-26-news-discovery-and-pagination-architecture.md).
  Впроваджено 3-рівневі токени `src/lib/design-system/tokens.ts`, лінтер `npm run tokens:check` з WCAG AA (текст 14.6:1),
  набір UI-примітивів `src/components/ui/` (touch floor ≥ 44px), чесну семантику та алгоритм сортування `src/lib/news-filters.ts`
  (relevance лише при пошуку, прибрано `discussed`), двосторонню синхронізацію URL-state без порушення edge-кешування ISR `/news`,
  мобільний drawer із повними назвами категорій (на проді 2026-09-29 обрізається лише trending-тема), а також E2E-набір `e2e/news-feed-interaction.spec.ts`.
  (source: `wiki/audits/2026-09-26-design-system-gap-plan.md`; `src/lib/design-system/tokens.ts`; `src/components/news/news-feed.tsx`)
```

### epic-5.3

```verbatim
| AH-0.1 | ✅ Звірити статус G01–G20 і вихідну точку ([#372](https://github.com/sanchahous/ai-today-brief/pull/372), [gap-plan §10](../audits/2026-09-26-design-system-gap-plan.md#10-статус-на-2026-09-29-звірка-ah-01)) | — | — | — | G01, конфлікт §2.3 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
