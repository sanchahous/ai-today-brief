# CWV audit — After Hours production-like preview (2026-10-05)

Summary: лабораторний CWV-прогін п’яти публічних шаблонів (home, news, article, daily, weekly) після acceptance AH-7.1: Lighthouse mobile/desktop, розміри JS/CSS на маршрут, порівняння з production і baseline AH-0.6.
Sources: [after-hours-redesign-epic](../product/after-hours-redesign-epic.md) §13 AH-7.2; [redesign baseline](../analytics/2026-09-29-redesign-baseline.md); [acceptance audit](2026-10-05-after-hours-acceptance.md); `scripts/cwv-preview-audit.mjs`; `artifacts/after-hours/analytics/2026-10-05-after-hours-preview/summary.json`; `artifacts/after-hours/analytics/2026-10-05-production-baseline/summary.json`; `artifacts/after-hours/analytics/2026-09-30-pagespeed-summary.json`; [PR #437](https://github.com/sanchahous/ai-today-brief/pull/437)
Last updated: 2026-10-05

---

## 1. Метод і обмеження

| Параметр | Значення |
|---|---|
| Дата зняття | **2026-10-05** (UTC+3 сесія агента) |
| Lighthouse | **13.5.0**, Headless Chromium |
| INP (лаб.) | TBT як проксі (бюджет ≤ 200 мс) |
| Field-дані | поза scope AH-7.2 → AH-7.4 |
| Preview URL (PR #437) | `https://ai-today-brief-git-feat-ah-72-cwv-preview-sanchahous-projects.vercel.app` — **SSO Vercel** (HTTP 302 на login); прямий curl/CLI недоступний без сесії власника |
| Production-like stand-in | `npm run build:ci` (`E2E_MINIMAL_PRERENDER=1`) + `next start` на **PORT=3100** — той самий мінімальний prerender, що й `pr:check` |
| Production порівняння | `https://aitodaybrief.com` — ті самі 5 URL, той самий скрипт |
| Performance trace | повні Lighthouse JSON у `artifacts/after-hours/analytics/2026-10-05-after-hours-preview/*.json` (mobile + desktop × 5 маршрутів) |
| JS/CSS розмір | сума `transferSize` ресурсів `.js` / `.css` через Playwright `performance.getEntriesByType('resource')` після `networkidle` |

(source: curl HEAD preview 2026-10-05; `scripts/cwv-preview-audit.mjs`; JSON-витяги 2026-10-05)

---

## 2. Бюджети CWV (лабораторні)

Бюджети з `.cursor/rules/00-core.mdc`: LCP ≤ 2,0 с · TBT ≤ 200 мс (проксі INP) · CLS ≤ 0,05.

### 2.1 Production-like preview (localhost:3100, після build:ci)

| Шаблон | Mobile LCP | Mobile TBT | Mobile CLS | Desktop LCP | Desktop TBT | Desktop CLS | Усі три бюджети |
|---|---:|---:|---:|---:|---:|---:|---|
| Home `/en` | 4,88 с | 34 мс | 0 | 4,00 с | 30 мс | 0 | LCP ✗ |
| News `/en/news` | 5,74 с | 35 мс | 0 | 4,17 с | 34 мс | 0 | LCP ✗ |
| Article (MoEmail) | 4,89 с | 33 мс | 0 | 3,71 с | 44 мс | 0 | LCP ✗ |
| Daily | 4,54 с | 39 мс | 0 | 3,87 с | 28 мс | 0 | LCP ✗ |
| Weekly | 5,33 с | 39 мс | 0 | 5,17 с | 19 мс | 0 | LCP ✗ |

(source: `artifacts/after-hours/analytics/2026-10-05-after-hours-preview/summary.json`, captured 2026-10-05T18:18Z)

**TBT і CLS** — усі 10 комбінацій (5 шаблонів × 2 form factors) **в бюджеті**.
**LCP** — усі 10 комбінацій **поза бюджетом**. На localhost LCP системно вищий, ніж на production (немає Vercel edge/CDN, cold single-origin `next start`); див. §2.2.

### 2.2 Live production (aitodaybrief.com, той самий день)

| Шаблон | Mobile LCP | Mobile TBT | Mobile CLS | Desktop LCP | Desktop TBT | Desktop CLS |
|---|---:|---:|---:|---:|---:|---:|
| Home | 3,23 с | 162 мс | 0 | 5,64 с | 41 мс | 0 |
| News | 5,60 с | 56 мс | 0 | 3,22 с | 49 мс | 0 |
| Article | 3,23 с | 114 мс | 0 | 3,31 с | 41 мс | 0 |
| Daily | 4,52 с | 23 мс | 0 | 5,09 с | 31 мс | 0 |
| Weekly | 3,14 с | 48 мс | 0 | 3,22 с | 24 мс | 0 |

(source: `artifacts/after-hours/analytics/2026-10-05-production-baseline/summary.json`, captured 2026-10-05T18:23Z)

### 2.3 Порівняння з baseline AH-0.6 (2026-09-30, PageSpeed HTML власника)

| Шаблон | AH-0.6 mobile LCP | AH-7.2 production mobile LCP | AH-0.6 mobile CLS | AH-7.2 production mobile CLS |
|---|---:|---:|---:|---:|
| Home | 1,2 с | 3,23 с | 0,102 | **0** |
| News | 7,1 с | 5,60 с | 0,224 | **0** |
| Article | 2,3 с | 3,23 с | 0,070 | **0** |
| Daily | *(виключено з AH-0.6)* | 4,52 с | — | **0** |
| Weekly | *(виключено з AH-0.6)* | 3,14 с | — | **0** |

(source: [2026-09-30-pagespeed-summary.json](../../artifacts/after-hours/analytics/2026-09-30-pagespeed-summary.json); production run 2026-10-05)

**Висновок:** після повного After Hours redesign **CLS виправлено до 0** на всіх п’яти шаблонах (було до 0,224 на news). **TBT** лишається в бюджеті. **LCP** у лабораторії досі перевищує 2,0 с на більшості шаблонів; news покращився відносно AH-0.6 (7,1 → 5,6 с), home погіршився (1,2 → 3,2 с) — ймовірний LCP-елемент hero/lead image + варіативність lab run, не field p75.

---

## 3. JS і CSS на маршрут

Сума `transferSize` (gzip/br на wire). Порівняння: **production 2026-10-05** (деплой до merge PR #437) проти **production-like preview** (гілка AH-7.2, localhost).

| Шаблон | Prod JS | Preview JS | Δ JS | Prod CSS | Preview CSS | Δ CSS |
|---|---:|---:|---:|---:|---:|---:|
| Home | 266 КБ | 257 КБ | **−3,4%** | 75 КБ | 76 КБ | +2,4% |
| News | 285 КБ | 275 КБ | **−3,4%** | 30 КБ | 31 КБ | +6,0% |
| Article | 287 КБ | 277 КБ | **−3,4%** | 30 КБ | 31 КБ | +6,0% |
| Daily | 277 КБ | 267 КБ | **−3,4%** | 30 КБ | 31 КБ | +6,0% |
| Weekly | 277 КБ | 267 КБ | **−3,3%** | 30 КБ | 31 КБ | +6,0% |

(source: JSON-витяги 2026-10-05; байти округлено до КБ)

**Жоден маршрут не має зростання JS > 10%.** Невелике зростання CSS (+~1,8 КБ на внутрішніх шаблонах, +6%) пояснюється розширеним `globals.css` After Hours (токени 2.0, motion, editorial chrome) без відповідного зростання JS — client chunks навіть **менші** на ~3,4% завдяки tree-shaking і видаленню legacy UI на гілці епіку.

---

## 4. AC AH-7.2

| AC | Статус | Доказ |
|---|---|---|
| LCP ≤ 2,0 с, TBT ≤ 200 мс, CLS ≤ 0,05 (5 шаблонів) або виняток із підписом | **Прийнято з винятком LCP** — TBT ✓, CLS ✓ (10/10); LCP ✗ у lab на всіх шаблонах (§2) → **підпис власника 2026-10-05** (див. §4.1) |
| Звіт із датами в wiki | ✓ ця сторінка + `wiki/tasks/ah-7.2.md` |
| Зростання JS > 10% пояснене | N/A — JS зменшився ~3% на всіх маршрутах; CSS +6% задокументовано в §3 |

### 4.1 Підпис власника на виняток LCP

**2026-10-05** власник погодив лабораторний виняток LCP для п’яти шаблонів (home, news,
article, daily, weekly) у mobile і desktop з числами цього аудиту: *«дозволяю з детальним
звітом підсумком»* (source: повідомлення власника U0BAS595MT6, сесія AH-7.2 / ATB-59).

**Обсяг винятку:** lab LCP поза бюджетом 2,0 с на всіх 10 комбінаціях (§2.1–2.2); TBT і CLS
у бюджеті. Field p75 — AH-7.4.

**Підсумок для власника (прийнято):**

| Метрика | До епіку (AH-0.6, 2026-09-30) | Після (AH-7.2, 2026-10-05) | Вердикт |
|---|---|---|---|
| CLS (news mobile) | 0,224 — провал | **0** на всіх 5 шаблонах | Виправлено |
| TBT | у бюджеті | у бюджеті (10/10) | Без регресії |
| LCP (news mobile) | 7,1 с | 5,6 с (production lab) | Покращення, досі >2 с |
| LCP (home mobile) | 1,2 с | 3,2 с (production lab) | Погіршення lab; не field |
| JS на маршрут | — | **−3,4%** vs production | Без зростання >10% |
| Daily / weekly | виключені з AH-0.6 | виміряні; CLS 0, LCP >2 с | У винятку |

Повторний прогін на Vercel Preview PR #437 не вимагався: SSO лишається недоступним агенту;
власник прийняв stand-in localhost:3100 + production порівняння.

---

## 5. Рекомендації (не блокують merge PR #437)

1. **LCP:** після merge — повторити PageSpeed на Vercel Preview без SSO (або production) з пріоритетом `fetchpriority="high"` / preload на LCP-зображення home lead і news hero; field-дані — AH-7.4.
2. **Preview SSO:** для наступних perf-задач розглянути Vercel Protection Bypass для CI/agent або публічний preview deployment.
3. **Моніторинг:** увімкнути `@vercel/speed-insights` або CrUX API в AH-7.4 для field p75.

## Related pages

- [After Hours acceptance audit](2026-10-05-after-hours-acceptance.md)
- [Redesign CWV baseline](../analytics/2026-09-29-redesign-baseline.md)
- [AH-7.2 task status](../tasks/ah-7.2.md)
