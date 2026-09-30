# AH-1.3: докази контракту Night/Day

Summary: реалізація теми без спалаху, перевірки й пакет для візуального підпису власника. Код готовий на гілці задачі; фінальний статус залежить від PR review і merge.
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

- SEO compare AH-0.4: **58 URL, 0 errors, 0 warnings** після оновлення локального
  build-cache. Початкові 8 помилок стосувалися порожнього кешованого home/news,
  зникли після мінімальної перебудови зі свіжими public reads; зміни SEO-коду не
  знадобилися. (source: `artifacts/_local/ah-1.3-seo-local.log`;
  `artifacts/_local/ah-1.3-seo-local-fresh.log`; `artifacts/_local/ah-1.3-build-fresh.log`)
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

Без JS Night і server-rendered header читабельні; основний контент `/news`
у чинному locale Suspense shell лишається за skeleton без React reveal.
No-JS перевірка теми не заявляє працездатність усіх інтерактивів або всього контенту.
Це межа наявного шаблону, не нова можливість AH-1.3. (source: `src/app/[lang]/loading.tsx`;
`e2e/theme.spec.ts`; локальний Chromium no-JS 2026-09-30)

Firefox віддає bounding width 43.999969 для computed 44 px; тест округлює до
сотих. Його повідомлення про відхилену cookie `__cf_bm` від image CDN виключене
лише з gate контролю, а повний report збирає console errors без цього фільтра.
(source: `e2e/theme.spec.ts`; `e2e/a11y-layout-matrix.spec.ts`;
`artifacts/_local/ah-1.3-theme-matrix-final.log`)

## Візуальний підпис

16 PNG до + 16 після: home/news, EN/UK, Night/Day, 1440/390 px.
До знято на production, після — у локальній production-збірці. Галерея:
`artifacts/after-hours/qa/ah-1.3-review.html`; originals і manifests —
`artifacts/_local/ah-1-3-before/`, `artifacts/_local/ah-1-3-after/`.
Потрібен візуальний підпис і merge PR; задача не позначається завершеною на main
до merge. (source: `scripts/capture-route-matrix.ts`; локальні manifests 2026-09-30;
[епік](after-hours-redesign-epic.md) §0.1)

## Related pages

- [Епік After Hours](after-hours-redesign-epic.md)
- [Передача виконання](after-hours-epic-handoff.md)
- [Now](../now.md)
