# AH-6.3

Summary: View Transitions між маршрутами — cross-fade контенту в `<main>`, reduced motion вимикає анімацію, фокус після навігації на H1 або `main`.
Sources: [after-hours-redesign-epic §AH-6.3](../product/after-hours-redesign-epic.md); `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`; `artifacts/after-hours/tension.css`; [PR #434](https://github.com/sanchahous/ai-today-brief/pull/434)
Last updated: 2026-10-05 (T1-f2 repair)

---

Task: ah-6.3

## Status

### epic-5.3

```verbatim
| AH-6.3 | View Transitions | S | агент | AH-6.1 | переходи маршрутів |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405); реалізація [PR #434](https://github.com/sanchahous/ai-today-brief/pull/434))

## Updates

- 2026-10-05 (T1-f2): `pr:check` падав на lint — ESLint сканував згенеровані артефакти `playwright-report/trace/assets/*.js` після локального e2e; додано `playwright-report/**` і `test-results/**` до `globalIgnores` у `eslint.config.mjs` (аналог `.gitignore`).
- 2026-10-05 (T1-f1): Pre-push repair — `cookie-overlay` чекає стабільного hit-test після hydration (`expect.poll`); `header-layout` мокає `/api/search` і читає значення поля з DOM у `SearchDialog.submit`; `a11y-layout-matrix` ERR_NO_BUFFER_SPACE — environmental (retry), не регресія view transitions.
- 2026-10-05: Реалізовано AH-6.3 (ATB-56, PR #434).
  - `src/app/[lang]/template.tsx` — React `<ViewTransition default="route-crossfade">` на вміст маршруту (header/footer поза переходом).
  - `src/app/globals.css` — opacity cross-fade (`::view-transition-*`), `pointer-events: none` на overlay; reduced motion обнуляє тривалість.
  - `src/components/motion/route-focus-main.tsx` — фокус на H1 або `#main-content` після client navigation.
  - `src/app/[lang]/layout.tsx` — `tabIndex={-1}` на `<main>`, `RouteFocusMain`.
  - `e2e/view-transitions.spec.ts` — Chromium cross-fade spy, навігація без console errors (усі браузери), reduced motion + focus.
  - **Наступна задача епіку — AH-7.1 (acceptance-прогін).**

## AC evidence

| AC | Evidence |
|---|---|
| Chromium cross-fade | `e2e/view-transitions.spec.ts` — `startViewTransition` викликається при client nav |
| Firefox/WebKit без помилок | той самий spec — `navigation completes without console errors` на CI matrix |
| Reduced motion + focus | `e2e/view-transitions.spec.ts` — focus на main/H1; CSS `0.001ms` на `::view-transition-*` |
| CLS/INP | лише opacity cross-fade (без transform); `::view-transition { pointer-events: none }` — лабораторний прогін на AH-7.2 |
