# ADR 2026-09-29 — міграція production-токенів на After Hours 2.0.0 перед епіком редизайну

Summary: рішення мігрувати `tokens.ts` і `globals.css` на токени 2.0.0 (а не верстати нові сторінки на 1.0.0), що закриває баг `--faint` і floor шрифтів; фіксує, що вже зроблено, що свідомо лишено поза міграцією.
Sources: `wiki/architecture/design-system-tokens.md` §5; `wiki/product/after-hours-redesign.md` §4; `artifacts/after-hours/tokens.css`; `src/lib/design-system/tokens.ts`; `src/app/globals.css`; `scripts/check-design-tokens.ts`; запит власника 2026-09-29; `npm run tokens:check` 2026-09-29.
Last updated: 2026-09-29

**Статус:** прийнято (власник рекомендував варіант A, 2026-09-29). Реалізовано в гілці `claude/redesign-epic-blockers-00e7df`.

---

## 1. Контекст

До цього рішення існували три розсинхронізовані палітри (source: [design-system-tokens](../architecture/design-system-tokens.md) §5):

| Джерело | Стан |
|---|---|
| `src/app/globals.css` (live) | legacy `#0f0f0f` / `#f0c040`; `tokens.ts` до нього **не підключений** — лише `scripts/check-design-tokens.ts` його читає |
| `src/lib/design-system/tokens.ts` v1.0.0 | After Hours v1, `--faint` не проходив AA (3,88:1 / 3,03:1) |
| `artifacts/after-hours/tokens.css` 2.0.0-proposal | повний Day, шкала типографіки, 160 пар контрасту без провалів |

Епік впровадження редизайну неможливо оцінити, доки не ясно, на яких токенах верстати.

## 2. Варіанти

- **A. Спершу мігрувати production на 2.0.0** (обрано). Нові сторінки одразу будуються на цільових токенах; баги світлої теми, `--faint` і floor шрифтів закриваються один раз; в епіку немає другого проходу «перефарбувати все».
- **B. Верстати на 1.0.0, повернутись до палітри пізніше.** Відкинуто: кожна нова сторінка потім потребувала б перефарбування; `--faint` лишався б зламаним у ~90 місцях довше.

## 3. Що змінено

1. `tokens.ts` → **2.0.0**: палітри Night/Day, нові ролі (`stage`, `raised`, `overlay`, `lineStrong`, `claret`, `velvet`, `focus`, `warning`), шкала типографіки в `rem` (`2xs`…`5xl`), `zIndex`, `controlSize` 36/44/52. Кожна роль визначена в обох темах — Day більше не успадковує Night.
2. `globals.css`: значення `:root` і `.theme-light` / `html[data-theme='day']` = дзеркало `SEMANTIC_TOKENS`; імена змінних збережені (`--bg`, `--surface`, `--surface-2`, `--border`, `--muted`, `--faint`, `--accent`), тому наявні компоненти не потребують змін. Додано `--raised`, `--overlay`, `--stage`, `--claret`, `--velvet`, `--line-strong`, `--focus`, `--warning`, `--success` і відповідні Tailwind-утиліти. Глобальний `:focus-visible` тепер `var(--focus)`.
3. **`--faint` виправлено**: Night `#a3a197` (≥ 4,5:1 на bg/bg-soft/surface/surface-2/raised), Day `#5a5e54`. Було `#6a6a6a` на `#0f0f0f` = 3,54:1 (source: [design-system-tokens](../architecture/design-system-tokens.md) §5).
4. **Floor шрифтів 12 px**: 74 використання `text-[9px|10px|11px|0.6–0.74rem]` замінено на `text-2xs` (`0.75rem`).
5. `npm run tokens:check` (входить у `pr:check` через unit-тести) тепер перевіряє: 90 пар контрасту (`text`, `muted`, `faint`, `accent`, `signal`, `claret`, `error`, `success`, `warning` на 5 поверхнях × 2 теми), UI-пари ≥ 3:1, **розсинхрон `globals.css` ↔ `tokens.ts`** і **будь-який розмір шрифту < 12 px** у `src/`.
6. Захардкоджені `#f0c040` / `#141414` у UI-компонентах (`concept-header`, `concepts-grid`, `top-of-week`, `cookie-consent`) → токени.

## 4. Свідомо поза міграцією (виняток, не борг без власника)

| Що | Чому | Хто закриває |
|---|---|---|
| `#f0c040` в OG-зображеннях (`opengraph-image.tsx`), PDF (`weekly-digest/pdf.ts`), `card/duotone.ts` `BRAND_SUN` | генератори зображень і PDF — окремий рендер поза CSS; зміна бренд-жовтого на латунь торкається всіх уже опублікованих соціальних карток | Не потрібно: власник 2026-09-29 лишив жовтий `#f0c040` як колір соціальних карток, OG і PDF |
| Категорійні кольори (`categoryColor` з БД) | дані, не токени; 2.0.0 має `--cat-*` для Night/Day, але БД тримає власні hex | Хвиля B: міграція даних категорій на `--cat-*` |
| `--surface-2` як сірий «утоплений» шар у Day | залишено ім'я для сумісності; значення тепер `#e6ddcc` (Day) / `#282d29` (Night) | видалити ім'я в 3.0.0 |

## 5. Наслідки

- **Видимий ефект:** увесь сайт змінює палітру з нейтрально-сірої+жовтої на теплу After Hours (Night `#171918`, brass `#d4b483`; Day — папір `#efe8da`). Це і є перший крок епіку, тож відбувається до сайзингу, а не всередині нього.
- Нові Day-значення поверхонь змінюють вигляд світлої теми (`--surface` більше не білий `#fff`, а `#f7f2e8`).
- Semver (governance §4): це **major**, 1.0.0 → 2.0.0; changelog — у [design-system-tokens](../architecture/design-system-tokens.md).
- Не перевірено: візуальний обхід усіх 26 маршрутів у двох темах (робить Хвиля A разом із visual regression, G13/G20). Перевірено: e2e chromium 111 passed, 3 failed через відсутні Supabase-credentials у worktree (не пов'язано зі змінами), `tokens:check` PASS, каталог `/ds-catalog` у Night і Day.

## 6. Виняток: usability-gate знято

Власник 2026-09-29 дозволив пропустити 5 usability-сесій (G19). Наслідок: gate «Usability» з Milestone 5 аудиту не виконується; замість нього — вимірювання після запуску. (source: рішення власника в чаті 2026-09-29)

## Related pages

- [design-system-tokens](../architecture/design-system-tokens.md)
- [after-hours-redesign](../product/after-hours-redesign.md)
- [after-hours-epic-readiness](../product/after-hours-epic-readiness.md)
- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md)
