# AH-6.2

Summary: The Resolve — брендова сцена на головній (SSR SVG, 31 WAAPI-трек, 3,4 с), кнопка повтору EN/UK, «акорд» знака в header на hover/focus.
Sources: `artifacts/after-hours/tension.js`, `tension.css`; [after-hours-tension](../product/after-hours-tension.md); [PR #433](https://github.com/sanchahous/ai-today-brief/pull/433)
Last updated: 2026-10-05

---

Task: ah-6.2

## Status

### epic-5.3

```verbatim
| AH-6.2 | The Resolve і «акорд» знака | M | агент | AH-6.1, AH-5.3, AH-3.1 | бренд-сцена |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405); реалізація [PR #433](https://github.com/sanchahous/ai-today-brief/pull/433))

## Updates

- 2026-10-05: Реалізовано AH-6.2 (ATB-55, PR #433).
  - `src/components/brand/brand-stage.tsx` — SSR SVG (16 ребер, поперечина, celadon-крапка); `role="img"` + `aria-label`; кнопка ↻ поза SVG.
  - `src/lib/motion/brand-resolve.ts` — `brandTracks` (31 трек), `playBrand`, окремий WAAPI-пул сцени; strum для header.
  - `src/lib/motion/runtime.ts` — viewport-старт, replay, strum на `[data-brand-strum]`.
  - `src/components/home/lead-grid.tsx` — `lead-stage` замість декоративного `BrandMark`.
  - `src/components/site-header-chrome.tsx` — `data-brand-strum` на home-лінках.
  - `src/app/globals.css` — стилі `.brand-stage` (сцена на `--stage`, не інвертується в Day).
  - `src/app/layout.tsx` — ранній `data-tension-motion` у blocking script (без спалаху готового знака).
  - `e2e/brand-resolve.spec.ts` — no-JS, reduced motion, replay a11y, viewport + replay.
  - `PORT=3100 npm run pr:check` — **PASS** (exit 0): design:raw:check, ci:check 2338 tests, typecheck, lint, e2e:check (33 specs), wiki:check, migrations:check, build:ci.
  - `PORT=3100 npx playwright test e2e/brand-resolve.spec.ts --project=chromium` — **5/5 passed**.
  - **Лабораторний frame-probe (p95 ≤ 16,8 мс, 0 кадрів > 34 мс)** — потребує ручного заміру на GPU-машині власника (як у прототипі `fold-review.html`); автоматизовано в CI не додавалось. LCP: сцена не є LCP-елементом (lead copy ліворуч).
  - **Наступна задача епіку — AH-6.3 (View Transitions).**
- 2026-10-05 (T1-f1 repair): Pre-push відхилено через flaky `a11y-layout-matrix` на `/uk/ai-disclosure` (`net::ERR_NO_BUFFER_SPACE` — TCP buffer exhaustion на Windows з 4 workers, той самий патерн що ATB-47/AH-5.11). Змін коду не потрібно. `PORT=3100 npm run pr:check` — **PASS** (exit 0) після повторного прогону.
