# AH-7.2

Summary: CWV-аудит п’яти шаблонів завершено; TBT і CLS у бюджеті, LCP прийнято з лабораторним винятком за підписом власника 2026-10-05.
Sources: [аудит CWV](../audits/2026-10-05-after-hours-cwv-preview.md); `scripts/cwv-preview-audit.mjs`; `artifacts/after-hours/analytics/2026-10-05-after-hours-preview/summary.json`; повідомлення власника U0BAS595MT6 2026-10-05; [PR #437](https://github.com/sanchahous/ai-today-brief/pull/437)
Last updated: 2026-10-05

---

Task: ah-7.2

## Status

DONE. PR: [#437](https://github.com/sanchahous/ai-today-brief/pull/437). Власник підписав виняток LCP 2026-10-05.

### epic-5.3

```verbatim
| AH-7.2 | CWV на production-like preview | S | агент | AH-7.1 | бюджети CWV |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405); прогін [PR #437](https://github.com/sanchahous/ai-today-brief/pull/437))

## Updates

- 2026-10-05: Виконано CWV-аудит AH-7.2 (ATB-59, PR #437).
  - Додано `scripts/cwv-preview-audit.mjs` (Lighthouse 13.5.0 mobile/desktop + JS/CSS transferSize).
  - Production-like stand-in: `FORCE_SSG_BUILD=1 npm run build:ci` + `PORT=3100 next start` (Vercel Preview PR #437 за SSO недоступний агенту).
  - Паралельний прогін на live `aitodaybrief.com` для порівняння bundle і lab метрик.
  - Звіт: [2026-10-05-after-hours-cwv-preview.md](../audits/2026-10-05-after-hours-cwv-preview.md).
  - Артефакти: `artifacts/after-hours/analytics/2026-10-05-after-hours-preview/`, `2026-10-05-production-baseline/`.
  - **TBT і CLS** — усі 10 комбінацій у бюджеті; **CLS** покращено vs AH-0.6 (news 0,224 → 0).
  - **LCP** — lab поза бюджетом; **власник погодив виняток** 2026-10-05 («дозволяю з детальним звітом підсумком»).
  - **JS** — зменшення ~3,4% на всіх маршрутах vs production; зростання >10% немає.
  - Наступна задача епіку — **AH-7.3 (прибирання legacy)**.

## AC evidence

| AC | Evidence |
|---|---|
| TBT ≤ 200 мс (проксі INP) | `summary.json` preview + production: 10/10 pass (source: `artifacts/after-hours/analytics/2026-10-05-after-hours-preview/summary.json`, 2026-10-05) |
| CLS ≤ 0,05 | 10/10 pass; news mobile 0,224 (AH-0.6) → 0 (source: [2026-09-30-pagespeed-summary.json](../../artifacts/after-hours/analytics/2026-09-30-pagespeed-summary.json)) |
| LCP ≤ 2,0 с або виняток із підписом | Lab LCP ✗ 10/10; **виняток підписано власником 2026-10-05** (source: [аудит §4.1](../audits/2026-10-05-after-hours-cwv-preview.md#41-підпис-власника-на-виняток-lcp); U0BAS595MT6) |
| Звіт із датами | [wiki/audits/2026-10-05-after-hours-cwv-preview.md](../audits/2026-10-05-after-hours-cwv-preview.md) |
| JS зростання > 10% | N/A: −3,4% JS на всіх маршрутах vs production (source: `summary.json` 2026-10-05) |
| Pre-PR gate (`pr:check`) | `npm run pr:check` — exit 0 (2026-10-05) |
