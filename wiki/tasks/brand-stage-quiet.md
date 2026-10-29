# Brand stage — без службових підписів

Summary: З брендової сцени головної прибрано kicker `THE RESOLVE`, фазові мітки «01 / Сигнали · 02 / Редагування · 03 / Розв’язка» і анімовану лінію прогресу; знак отримав звільнений простір.
Sources: запит власника 2026-10-29; `src/components/brand/brand-stage.tsx`; `src/lib/motion/brand-resolve.ts`; `src/app/globals.css`; [after-hours-tension](../product/after-hours-tension.md)
Last updated: 2026-10-29

---

Task: brand-stage-quiet

## Status

```verbatim
- **Brand stage без службових підписів (2026-10-29):** зі сцени The Resolve на головній прибрано kicker, три фазові мітки й лінію прогресу; знак піднято й збільшено на звільнене місце, `aria-label` описує знак замість кодової назви. 27 WAAPI-треків замість 31.
```

IN REVIEW (agent). PR — після `npm run pr:check`.

## Чому

Власник 2026-10-29: анімована лінія прогресу відволікає увагу від брендової анімації, а мітки «Сигнали / Редагування / Розв’язка» читачеві нічого не пояснюють. Сюжет «багато сигналів → один погляд» уже розповідають сам рух знака і підпис під ним; службова розмітка актів дублювала його мовою раскадровки.

## Changes

- `src/components/brand/brand-stage.tsx` — без `.brand-kicker` і `ol.brand-phases`.
- `src/lib/motion/brand-resolve.ts` — без треків `[data-phase]` і `.brand-progress i` (31 → 27).
- `src/lib/i18n.ts` — прибрано `kicker`, `phaseSignals`, `phaseEdit`, `phaseResolve`; новий `ariaLabel` EN/UK.
- `src/app/globals.css` — прибрано стилі kicker/phases/progress; SVG `inset` 76 → 8 px (≤47.5em: 72 → 4 px).
- `scripts/raw-design-values.baseline.json` — зменшений baseline сирих значень.
- `src/lib/motion/brand-resolve.test.ts` — 27 треків, жодного селектора `phase|progress`.
- `e2e/brand-resolve.spec.ts` — новий `aria-label`, у SSR немає `brand-phases` і `THE RESOLVE`.

## Checks

- `PORT=3101 npm run pr:check` — exit 0 (2026-10-29), включно з `build:ci`; lint — 0 errors, 4 старі warnings поза цим диффом.
- `npx playwright test e2e/brand-resolve.spec.ts --project=chromium` — 4/4.
- `scripts/raw-design-values.baseline.json` — `design:raw:prune` після видалення стилів.
- Browser preview 460×900 і 1280×900 (uk): верх сцени порожній, знак 215–216 px заввишки, 54 / 89 px від верху, 30 / 36 px до підпису; сцена доходить до `rest`.

## Next task

Немає.
