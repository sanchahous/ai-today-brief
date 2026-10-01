# AH-2.2: дії й вибір — реалізація й докази

Summary: Button, IconButton, Pill, Chip, Tag, Badge і CategoryBadge зі спільним контрактом розмірів, фокуса та pending. Реалізація готова до окремого візуального review; повний legacy gating і G1 не закриті.
Sources: `src/components/ui/`; `src/lib/ui/action-styles.ts`; `src/app/ds-catalog/action-catalog.tsx`; `e2e/actions-selection.spec.ts`; `artifacts/after-hours/qa/ah-2.2-evidence.json`; повідомлення власника й GitHub checks 2026-10-01.
Last updated: 2026-10-01

---

## Стан і межі погодження

Власник явно підтвердив #386 словами «ПР закритий значить підтверджую 386» і дозволив наступні задачі за порядком агента. #386 змерджено в `c477b09`; CI, включно з [Playwright run 36826783157](https://github.com/sanchahous/ai-today-brief/actions/runs/36826783157), успішний. AH-2.2 почато окремою гілкою `feat/ah-2.2-actions-selection` від цього main після звірки відкритих PR і зайнятості. Це погодження #386; UK Home/Article/Weekly, заміна Preview CLS локальним доказом, H1/legacy QA та G1 лишаються відкритими. (source: повідомлення власника 2026-10-01; [PR #386](https://github.com/sanchahous/ai-today-brief/pull/386); `artifacts/_local/ah-2.2-main-pr386.json`; [AH-1.5 validation](after-hours-ah-1-5-validation.md))

## Реалізація

Button і IconButton мають primary / outline / ghost і сумісний secondary, розміри 36 / 44 / 52. Coarse pointer отримує ціль мінімум 44×44 навіть на широкому touchscreen. `pending` примусово вмикає native disabled та `aria-busy`; default type — button, refs збережені. ActionButton лишається сумісним alias. Hover діє лише для fine pointer з hover; фокус — токени 2 px / offset 3 px, переходи тільки кольору; spinner нерухомий у reduced motion. (source: `button.tsx`; `icon-button.tsx`; `actions.module.css`; `src/lib/ui/action-styles.ts`)

Pill — native toggle із `aria-pressed`; Chip має незалежні select/remove кнопки без вкладених buttons, локалізоване «Прибрати фільтр: …» і `Intl.NumberFormat(lang)` для count. Tag — native посилання через Next Link. Badge має шість двомовних статусів із текстом і символом; демонструється в каталозі без додавання непідтверджених статусів до production-контенту. CategoryBadge перенесено з `home/` у `ui/`, підтримує default / plain / dot, дев'ять token colours, невідому категорію й null. (source: `pill.tsx`; `chip.tsx`; `tag.tsx`; `badge.tsx`; `category-badge.tsx`; `src/components/category-presentation.test.ts`)

Мігрували news-feed/sidebar, header/theme toggle, hero/search preview, concept links і всі імпорти CategoryBadge. Наявні testid, URL та аналітичні handlers збережено; поля й механіку оверлеїв продовжать AH-2.3 / AH-2.4. Каталог містить EN/UK, усі button/icon розміри й стани, pending submit, pressed/disabled/pending Pills і Chips, removable/selectable Chip, Tags, усі Badge kinds і CategoryBadge variants. (source: diff гілки; `src/app/ds-catalog/action-catalog.tsx`; `scripts/e2e-affected.ts`)

## Перевірки

- Actions + наявні composite UI E2E: **181 passed, 14 skipped, 0 failed**, Chromium/Firefox/WebKit. Пропуски: 12 opt-in OS snapshots і два CDP zoom у рушіях без CDP. Перевірено scoped axe, Enter/Space, незалежне видалення Chip, repeated-submit guard, focus/hover токени, coarse targets, reduced motion, 320 reflow та 200% text у Chromium. Початкові WebKit axe збої під час colour transition збережено в логах; фінальний тест стабілізує transitions перед вимірюванням. (source: `artifacts/_local/ah-2.2-components-final.log`; `e2e/actions-selection.spec.ts`; `e2e/ui-components.spec.ts`)
- Unit suites — **17 passed**; композиція класів усіх варіантів/розмірів та CategoryBadge. Новий logic helper має **100% lines / branches / functions**, включений у LCOV scope і перевірку наявності LCOV. Повний `pr:check` — **2145 tests passed**, logic coverage 85.3% lines / 75.63% branches. (source: `artifacts/_local/ah-2.2-unit.log`; `ah-2.2-pr-check.log`; `coverage/lcov.info`; `src/lib/ui/action-styles.test.ts`; `vitest.config.ts`; `scripts/verify-logic-lcov.ts`)
- SEO compare — **58 URL, 0 errors / 0 warnings** проти чистого main `c477b09` на власному baseline server. Початковий cold snapshot відрізнявся robots для `/en/zzz-missing`; warmed baseline відтворює поточний noindex. Початкові результати не видалено. Маршрути, metadata, ISR і parser контракту не змінено. (source: `artifacts/_local/ah-2.2-seo-main-warm.json`; `ah-2.2-seo-verified.log`; `ah-2.2-seo-before.json`; [AH-1.5 SEO межі](after-hours-ah-1-5-validation.md#перевірки))
- Token gate — **222 пари**, 0 failures; raw ratchet — 30 colours / 4 z-index / 0 shadows / 0 sub-floor fonts. Нових dependencies чи globals tokens немає. Lint має 9 warnings у незмінених файлах. (source: `artifacts/_local/ah-2.2-tokens.log`; `ah-2.2-lint.log`; `scripts/raw-design-values.baseline.json`; git diff)

## Публічна матриця: legacy борг

Home / News / active filters / Category / Article, EN/UK, Night/Day, 320/360/390/768/1024/1440 і 200% text на 1280: **по 140 сценаріїв** на clean main і AH-2.2. Це report із незміненим `inspectPage`, а не нульовий full-page gating. (source: `artifacts/after-hours/qa/audit-ah-2.2.mjs`; `e2e/helpers/inspect-page.ts`; `artifacts/_local/ah-2.2-public-qa-main.json`; `ah-2.2-public-qa.json`)

| Лічильник | main c477b09 | AH-2.2 |
|---|---:|---:|
| Overflow / small text / H1 / console | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Small targets | 5527 | 5383 |
| Migrated controls <44 на coarse | 0 | 0 |
| Axe | 86 | 86 |
| Clipped | 752 | 752 |

Сирі лічильники не доводять причинність різниці. Axe та clipping лишаються legacy; scoped каталог і мігровані controls проходять, але DoD §0.1.5 для всіх public templates не виконано. G1, власницьке прийняття винятків і візуальний підпис нового PR не припускаються з цих прогонів. (source: ті самі reports; [епік DoD](after-hours-redesign-epic.md#01-definition-of-done--для-кожного-pr-епіку))

## Візуальний review

[Локальна галерея](../../artifacts/after-hours/qa/ah-2.2-review.html): **40 пар** before/after із реальних `.env.local` даних і **8 знімків** EN/UK каталогу, Night/Day, 390/1440. Before — чистий `c477b09`; обидві сторони — власні local dev servers. Consent fixture застосовано до фактичного local origin. PNG у git-ignored `artifacts/_local/ah-2-2-{before,after,catalog}`, SHA-256 у manifests і [evidence receipt](../../artifacts/after-hours/qa/ah-2.2-evidence.json). Окремий візуальний підпис очікується; merge агент не виконує. (source: `capture-ah-2.2.mjs`; `capture-catalog-ah-2.2.mjs`; before/after/catalog manifests; епік §0.1.10)

Наступна задача за порядком — **AH-2.3**, після звірки інтеграції AH-2.2; окрема гілка/PR. (source: повідомлення власника 2026-10-01; [епік §5.3](after-hours-redesign-epic.md#53-зведена-таблиця-задач))

## Related pages

- [after-hours-redesign-epic](after-hours-redesign-epic.md) — картка й AC
- [after-hours-epic-handoff](after-hours-epic-handoff.md) — актуальний порядок
- [design-system-tokens](../architecture/design-system-tokens.md) — token contract
