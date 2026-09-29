# After Hours: готовність до епіку впровадження редизайну

Summary: статус чотирьох блокерів епіку «впровадити все відразу», що закрито у коді, що лишається за власником, і що є входом для сайзингу епіку.
Sources: запит власника 2026-09-29; `wiki/decisions/2026-09-29-design-tokens-2-0-migration.md`; `src/components/ui/`; `e2e/ui-components.spec.ts`; `wiki/research/2026-09-29-redesign-usability-sessions-protocol.md`; `npm run tokens:check` 2026-09-29; `wiki/product/after-hours-redesign.md` §9.
Last updated: 2026-09-29

---

> **Оновлення 2026-09-29:** повна декомпозиція, порядок робіт і сайзинг — у
> [епіку реалізації](after-hours-redesign-epic.md) (56 задач, 8 фаз, гейти й acceptance criteria;
> звірено з PR #369). Розділ 3 нижче лишається первинним входом за хвилями A–C; оцінку тепер задає
> епік — ≈ 56 днів разом із foundations, бібліотекою, QA-інструментами, рухом і заміною знака скрізь
> (assumption). Рішення D1–D13 — [ADR розкатки й foundations](../decisions/2026-09-29-after-hours-rollout-and-foundations.md).

## 1. Підсумок

Три блокери закриті кодом, четвертий (usability) знято рішенням власника (source: `npm run tokens:check`, vitest `src/lib/ui`, `e2e/ui-components.spec.ts` 2026-09-29); четвертий (usability-докази) має готовий протокол, але потребує людей. П'ятого блокера немає (власник підтвердив 2026-09-29: «нічого»).

| # | Блокер | Статус | Доказ |
|---|---|---|---|
| 1 | Токени 2.0 не в `tokens.ts` | ✅ **Закрито** — рішення [ADR](../decisions/2026-09-29-design-tokens-2-0-migration.md), міграція виконана | `tokens.ts` 2.0.0; `globals.css` дзеркало; `tokens:check` PASS |
| 2 | Немає Combobox / DropdownMenu / Popover / Tabs / Accordion / Toast | ✅ **Закрито**, +Tooltip | `src/components/ui/`; 14 unit-тестів логіки; 9 e2e (chromium) |
| 3 | Немає usability-доказів | ⏭ **Знято власником** — сесії пропущено свідомо (2026-09-29) | [ADR-виняток](../decisions/2026-09-29-design-tokens-2-0-migration.md); протокол лишено на майбутнє |
| 4 | `--faint` не проходить AA (~90 місць) | ✅ **Закрито** | Night `#a3a197`, Day `#5a5e54`; регресійний тест; гейт у `tokens:check` |

## 2. Що саме готове для епіку

**Токени:** одне джерело — `src/lib/design-system/tokens.ts` 2.0.0; CSS-дзеркало в `globals.css`; гейт (контраст 90 пар, drift, floor 12 px) у `npm run tokens:check` і в unit-тестах. Нові сторінки Хвилі A верстаються одразу на цільових токенах.

**Компоненти** (`src/components/ui/`, доступні через `@/components/ui`):

| Компонент | Контракт | Ключова поведінка |
|---|---|---|
| `Popover` | disclosure, non-modal `dialog` | Esc і клік поза → закрити; Esc повертає фокус на trigger; `aria-expanded/controls`; **flip** угору / в інший бік, коли не вміщується у viewport (`computePlacement`) |
| `Dialog` | modal, поверх `OverlayDrawer` | focus trap, Esc/backdrop/× закривають, повернення фокусу, scroll lock; title/description/footer |
| `DropdownMenu` | WAI-ARIA menu button | ↑/↓/Home/End, wrap, пропуск disabled, typeahead, Tab закриває |
| `Tooltip` | WCAG 1.4.13 | hover/focus, Esc закриває, `aria-describedby`; не показується на touch |
| `Tabs` | automatic activation | roving `tabindex`, ←/→/Home/End, пропуск disabled, панелі змонтовані (`hidden`) |
| `Accordion` | disclosure group | заголовок-кнопка `aria-expanded`, режими `single`/`multiple`, рівень заголовка налаштовується |
| `Toast` + `useToast` | live region | помилки `role=alert` ≥ 8 с, інші `status`; пауза на hover/focus; ≤ 3 одночасно; dedupe за ключем |
| `Combobox` | ARIA 1.2 list autocomplete | `aria-activedescendant`, регістронезалежний пошук (кирилиця: `й≠и`, `ї≠і`), порожній стан, оголошення кількості результатів |

(source: `src/components/ui/*.tsx`) Логіка (`src/lib/ui/`) винесена в чисті функції й покрита vitest без DOM; поведінку в браузері перевіряє `e2e/ui-components.spec.ts` на внутрішній сторінці `/ds-catalog` (**404 без `DS_CATALOG=1`**, не індексується; у Playwright увімкнено автоматично). Це закриває також G20 у мінімальній формі (жива документація без публічного маршруту).

**Перевірки доступності й візуальна база** (`e2e/ui-components.spec.ts`, chromium):

- **axe-core WCAG 2.2 AA** у Night і Day, у спокої й з відкритими menu/combobox/popover/dialog — 0 порушень (першим запуском знайшов `aria-label` без ролі на контейнері Toast; виправлено `role="region"`).
- **Дерево доступності** (`toMatchAriaSnapshot`) для Tabs, DropdownMenu, Combobox; Toast — live region.
- **Visual regression:** 4 базові знімки каталогу (Night/Day × desktop 1280/mobile 390) у `e2e/ui-components.spec.ts-snapshots/`. Запускається лише з `VISUAL=1`, бо знімки залежать від ОС: закомічені **win32**; для Linux/CI потрібно згенерувати окремі (`VISUAL=1 npx playwright test e2e/ui-components.spec.ts --project=chromium --update-snapshots` на Linux-раннері) — до цього CI ці 4 тести пропускає.

**Що з цього ще не покрито** (лишається, не приховуємо):

- Ручна перевірка **справжнім screen reader** (NVDA/VoiceOver): axe і дерево доступності — проксі, а не заміна. Входить у задачу T8 usability-протоколу.
- Combobox-listbox не перегортається (лише Popover); для довгих списків біля нижнього краю — перевірити в Хвилі A.
- Firefox/WebKit локально не запускали (CI matrix).
- Visual baseline лише для каталогу компонентів, не для сторінок; сторінковий baseline — Хвиля A разом з обходом 26 маршрутів.

## 3. Вхід для сайзингу епіку

Епік = [after-hours-redesign §9](after-hours-redesign.md) Хвилі A–C (12–18 робочих днів у припущенні одного розробника) **мінус** вже зроблене: «Tokens/fonts/brand» (Хвиля A, п.1) частково закрито — лишаються шрифти `next/font/local` для бренд-гарнітур, новий знак/favicon/OG-шаблон. Додаткові задачі, що з'явилися з цієї роботи:

1. ~~OG/PDF/duotone на brass~~ — знято: власник лишає жовтий `#f0c040` (2026-09-29).
2. Міграція категорійних кольорів з БД на `--cat-*` (Хвиля B).
3. Візуальний обхід 26 маршрутів × 2 теми × EN/UK після зміни палітри + visual-regression baseline.
4. Прибрати ім'я `--surface-2` у 3.0.0.

**Gate перед broad rollout:** usability-сесії пропущено за рішенням власника (2026-09-29) — gate знято. Ризик прийнято: T-задачі discovery (filter/sort/URL-state) не перевірені на людях; страхує лише автоматика (e2e `news-feed-interaction`, axe) і вимірювання після запуску ([after-hours-redesign «Оцінка після запуску»](after-hours-redesign.md)): lead→article, home→daily, повернення за 7 днів. Якщо метрики просядуть — повернутись до [протоколу](../research/2026-09-29-redesign-usability-sessions-protocol.md).

## 4. Відкриті питання власнику

1. ~~П'ятий блокер~~ — немає (підтверджено).
2. ~~Бренд-колір~~ — рішення власника 2026-09-29: **лишаємо жовтий `#f0c040`** для OG-карток, PDF і duotone. Задача «OG/PDF/duotone на brass» з Хвилі A знімається.
3. ~~5 usability-сесій~~ — пропущено власником, питання знято.

## Related pages

- [after-hours-redesign-epic](after-hours-redesign-epic.md) — декомпозиція й порядок робіт
- [after-hours-redesign](after-hours-redesign.md)
- [design-system-tokens](../architecture/design-system-tokens.md)
- [2026-09-29 ADR токенів 2.0](../decisions/2026-09-29-design-tokens-2-0-migration.md)
- [usability protocol](../research/2026-09-29-redesign-usability-sessions-protocol.md)
- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md)
