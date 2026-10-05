# AH-7.1

Summary: Повний acceptance-прогін After Hours v3 — автоматичні метрики 0 порушень, SEO 0 регресій (58 маршрутів), schema 0 відсутніх обов'язкових полів, 378 Chromium + 108 Firefox + 108 WebKit сценаріїв QA-матриці та 70 interaction E2E зелені.
Sources: [after-hours-redesign-epic §AH-7.1](../product/after-hours-redesign-epic.md); [after-hours-acceptance](../audits/2026-10-05-after-hours-acceptance.md); `e2e/a11y-layout-matrix.spec.ts`; `scripts/seo-contract.ts`; `e2e/fixtures/seo-contract.baseline.json`; [PR #436](https://github.com/sanchahous/ai-today-brief/pull/436)
Last updated: 2026-10-05

---

Task: ah-7.1

## Status

READY_FOR_OWNER_REVIEW. PR: [#436](https://github.com/sanchahous/ai-today-brief/pull/436).

### epic-5.3

```verbatim
| AH-7.1 | Повний acceptance-прогін | M | агент + власник | AH-6.2, AH-6.3 | G14 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405); прогін [PR #436](https://github.com/sanchahous/ai-today-brief/pull/436))

## Updates

- 2026-10-05: Виконано повний acceptance-прогін AH-7.1 (ATB-58, PR #436).
  - Створено звіт [2026-10-05-after-hours-acceptance.md](../audits/2026-10-05-after-hours-acceptance.md).
  - Оновлено baseline у `e2e/fixtures/seo-contract.baseline.json` для маршрутів 404 (`/en/zzz-missing`, `/uk/zzz-missing`), узгодивши його з чинним контрактом AH-5.15 (HTTP 404, noindex, follow, без canonical).
  - Відфільтровано стороннє повідомлення Firefox щодо відхиленої cookie `__cf_bm` від CDN у `e2e/a11y-layout-matrix.spec.ts`.
  - Усі автоматизовані метрики закриті без жодного блокера.
  - Наступна задача епіку — **AH-7.2 (CWV на production-like preview)**.

## AC evidence

| AC | Evidence |
|---|---|
| Автоматичні метрики — 0 порушень | `e2e/a11y-layout-matrix.spec.ts`: Chromium 378/378 passed (5 ширин × 2 теми × 2 мови + 200% zoom + reflow 320), Firefox quick 108/108 passed, WebKit quick 108/108 passed (1440 і 390). 0 axe WCAG 2.2 AA порушень, 0 horizontal overflow, 0 тексту < 12px, 0 touch-цілей < 44px, 0 console errors, рівно один H1. |
| SEO — 0 регресій | `npm run seo:contract -- --compare`: 58 маршрутів, 0 помилок, 18 попереджень (додавання schema на digests/tools за планом). 0 регресій status, canonical, robots, hreflang, OG, twitterCard. |
| Schema — 0 відсутніх обов'язкових полів | `parseJsonLd` / `inspectNode` перевірка 20+ типів schema.org на всіх 58 маршрутах — 0 дефектів. |
| Motion — прогін з рухом | `e2e/motion-runtime.spec.ts`, `brand-resolve.spec.ts`, `view-transitions.spec.ts` (43 passed в Chromium, Firefox, WebKit): 0 нескінченних анімацій, кадровий бюджет The Resolve, View Transitions opacity cross-fade. |
| Interaction E2E | `news-search`, `search-dialog-keyboard`, `news-feed-interaction`, `footer-newsletter`, `tools-workspace`, `not-found`: 70 passed. |
| Ручні чеклісти закриті, блокерів немає | Автоматизовані передумови підтверджено на 100%. Підготовлено структуровані чеклісти для власника (6 сценаріїв §6, screen readers NVDA/VoiceOver на 5 потоках, реальні iOS/Android пристрої). Блокерів немає (0). |
| Pre-PR gate (`pr:check`) | `npm run pr:check` — exit 0 на PORT=3100. |
