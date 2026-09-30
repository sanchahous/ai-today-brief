# AH-1.3: докази контракту Night/Day

Summary: реалізація теми без спалаху в draft PR #378, перевірки й пакет для візуального підпису власника. Фінальний статус залежить від review, рішення щодо наявних QA-обмежень і merge.
Sources: `src/app/layout.tsx`; `src/app/manifest.ts`; `src/lib/theme.ts`; `src/components/theme-toggle.tsx`; `src/lib/i18n.ts`; `e2e/theme.spec.ts`; `e2e/a11y-layout-matrix.spec.ts`; `artifacts/_local/ah-1.3-seo-local-fresh.log`; `artifacts/_local/ah-1.3-tokens.log`; `artifacts/after-hours/qa/ah-1.3-review.html`; live git/PR checks 2026-09-30.
Last updated: 2026-09-30

---

## Контракт і реалізація

`localStorage.theme` і GA4 зберігають `light` / `dark`. Синхронний script у head
виставляє `.theme-light`, `data-theme` (`day` / `night`) і inline `color-scheme`
до body; збережене значення має пріоритет над системним. Невідоме значення або
заблокований storage використовує системну перевагу. Без JavaScript CSS і HTML
мають Night за замовчуванням. (source: `src/app/layout.tsx`; `src/lib/theme.ts`;
`src/app/globals.css`; `e2e/theme.spec.ts`)

Два `theme-color` meta зберігають значення токенів 2.0, а `media=all` вибирає
поточну тему; інша має `media=not all`. Це враховує збережену тему навіть проти OS.
Manifest використовує Night `bg` для splash і chrome, як статичний default.
Метадані не читають cookies/headers і не змінюють ISR. (source: `src/app/layout.tsx`;
`src/app/manifest.ts`; `src/lib/design-system/tokens.ts`; `src/lib/theme.ts`)

Кнопка має 44×44 px через `--touch-target-min`, назви EN/UK описують наступну
тему, sun/moon показує напрям перемикання. Подія `atb-theme-change` синхронізує
desktop і mobile кнопки; аналітика лишає `theme_toggle {to_theme}` та user property
`theme`, consent opt-out збережено. (source: `src/components/theme-toggle.tsx`;
`src/lib/theme.ts`; `src/lib/i18n.ts`; `src/lib/analytics-client.ts`; `e2e/theme.spec.ts`)

## Перевірки

- Draft [PR #378](https://github.com/sanchahous/ai-today-brief/pull/378), код `a58f29f`.
  [Vercel Preview](https://ai-today-brief-git-feat-ah-13-night-940161-sanchahous-projects.vercel.app/uk/news)
  готовий; Playwright CI **558 passed / 30 skipped**, Sonar scan та решта активних
  checks успішні на цьому code head. `pr:check`: **2032 unit-тести**, локальний
  pre-push Chromium **191 passed / 5 skipped**, theme/catalog/admin у трьох
  браузерах **159 passed / 15 skipped**. (source: GitHub runs
  [E2E](https://github.com/sanchahous/ai-today-brief/actions/runs/36720454290),
  [Sonar](https://github.com/sanchahous/ai-today-brief/actions/runs/36720454119);
  `artifacts/after-hours/qa/ah-1.3-validation.json`)
- SEO compare AH-0.4: **58 URL, 0 errors, 0 warnings** після оновлення локального
  build-cache. Початкові 8 помилок стосувалися порожнього кешованого home/news,
  зникли після мінімальної перебудови зі свіжими public reads; зміни SEO-коду не
  знадобилися. (source: `artifacts/_local/ah-1.3-seo-local.log`;
  `artifacts/_local/ah-1.3-seo-local-fresh.log`; `artifacts/_local/ah-1.3-build-fresh.log`)
- Authenticated Preview compare: **58 URL, 0 errors, 0 warnings**; повторні
  запити `/en/news` і `/uk/news` мають `x-vercel-cache: HIT`. Прямий unauthenticated
  compare потрапляв на Vercel login; для справжніх HTML застосовано тимчасову
  share-cookie лише в локальному QA wrapper, без змін production або доступу проєкту.
  (source: `artifacts/_local/ah-1.3-seo-preview-auth.log`;
  `scripts/seo-contract.ts`; `artifacts/after-hours/qa/ah-1.3-validation.json`)
- `tokens:check`: PASS, контраст WCAG AA, CSS drift і floor 12 px.
  Unit tests теми: 9 passed. (source: `artifacts/_local/ah-1.3-tokens.log`;
  `src/lib/theme.test.ts`; локальний Vitest 2026-09-30)
- E2E перевіряє перший body frame з заблокованими Next JS chunks, збережені dark/light
  проти OS, відсутнє/невідоме/заблоковане storage, reload, soft navigation,
  синхронність двох кнопок, analytics opt-out, manifest і no-JS.
  Матриця контролю: EN/UK × Night/Day × 360/390/768/1024/1440, reflow 320,
  browser font 32 px (200%, Chromium); axe WCAG 2.2 AA, клавіатура й touch floor.
  (source: `e2e/theme.spec.ts`)

## Межі QA

Публічні шаблони не перебудовуються в AH-1.3. За AH-0.5 вони лишаються у report,
а `/ds-catalog` — у gating. Матриця нового контролю перевіряється як gate;
результат не означає нуль legacy-порушень на всій сторінці за §0.1(5) епіку.
Повний report виконується окремо, його борг не приховується й потребує врахування
власником при підписі. (source: [епік](after-hours-redesign-epic.md) AH-0.5 і §0.1;
`e2e/fixtures/a11y-gating.json`; `e2e/theme.spec.ts`)

Повний report: **812 сценаріїв** на `main` і AH-1.3, однакові маршрути й build-cache.
Порушення target розміру саме кнопки теми: **464 → 0**. На 784 сценаріях без
live-search: overflow/text <12 px/missing alt **0 → 0**, axe **2460 → 2460**,
console **28 → 28**, H1 problems **0 → 0**, heading skips **308 → 308**.
Full-page targets **13870 → 11928**, axe **2496 → 2484**, H1 problems **17 → 23**.
Різниця H1/heading/axe зосереджена в 28 сценаріях live-search `q=mcp`;
`measure()` чекає видимий `main`, який може бути skeleton до появи H1. Це
пояснення race — висновок із коду й результатів, а не доведений gate live-search.
Повний zero-violation DoD §0.1(5) не виконано; потрібне явне рішення власника
щодо legacy scope перед merge. (source: `e2e/a11y-layout-matrix.spec.ts`;
`artifacts/after-hours/qa/ah-1.3-validation.json` і SHA-256 первинних report у ньому)

Без JS Night і server-rendered header читабельні; основний контент `/news`
у чинному locale Suspense shell лишається за skeleton без React reveal.
No-JS перевірка теми не заявляє працездатність усіх інтерактивів або всього контенту.
Це межа наявного шаблону, не нова можливість AH-1.3. (source: `src/app/[lang]/loading.tsx`;
`e2e/theme.spec.ts`; порівняння main/AH-1.3 у
`artifacts/after-hours/qa/ah-1.3-validation.json`, поле `noJs`)

Firefox віддає bounding width 43.999969 для computed 44 px; тест округлює до
сотих. Його повідомлення про відхилену cookie `__cf_bm` від image CDN виключене
лише з gate контролю, а повний report збирає console errors без цього фільтра.
(source: `e2e/theme.spec.ts`; `e2e/a11y-layout-matrix.spec.ts`;
`artifacts/_local/ah-1.3-theme-matrix-final.log`)

## Візуальний підпис

16 PNG до + 16 після: home/news, EN/UK, Night/Day, 1440/390 px.
До знято на production, після — на Vercel Preview `a58f29f`; також збережено
16 PNG локальної production-збірки. Галерея:
`artifacts/after-hours/qa/ah-1.3-review.html`; originals і manifests —
`artifacts/_local/ah-1-3-before/`, `artifacts/_local/ah-1-3-preview/`, `artifacts/_local/ah-1-3-after/`.
SHA-256: before `f87afdd085799fff1ab5c144e74fc6f4506df0fb745c9477d6d20b073fbac366`,
Preview `ac477d8e2a546f3d38b7789fc820fbc7da623c9eeaab0c191046fa4f5d7c9548`.
Потрібен візуальний підпис і merge PR; задача не позначається завершеною на main
до merge. (source: `scripts/capture-route-matrix.ts`; локальні manifests 2026-09-30;
[епік](after-hours-redesign-epic.md) §0.1)

## Related pages

- [Епік After Hours](after-hours-redesign-epic.md)
- [Передача виконання](after-hours-epic-handoff.md)
- [Now](../now.md)
