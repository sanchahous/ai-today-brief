# Дизайн-система After Hours: архітектура токенів і governance (v2.0.0)

Summary: єдина канонічна специфікація токенів дизайн-системи After Hours v2.0.0 (міграція з 1.0.0 виконана 2026-09-29): трирівнева модель (Primitives → Semantics → Components), звіт доступності WCAG AA, правила міграції з legacy-палітри globals.css та політика версіонування.
Sources: `wiki/audits/2026-09-26-design-system-gap-plan.md`; `artifacts/after-hours/tokens.json`; `artifacts/after-hours/tokens.css`; `artifacts/after-hours/qa/token-contrast.json`; `src/app/globals.css`; `src/lib/design-system/tokens.ts`; `scripts/check-design-tokens.ts`; `wiki/decisions/2026-09-29-design-tokens-2-0-migration.md`; розрахунок контрасту 2026-09-29.
Last updated: 2026-09-30

**Статус:** прийнято. Джерело істини для дизайн-токенів у кодовій базі (source: wiki/audits/2026-09-26-design-system-gap-plan.md).

---

## 1. Трирівнева архітектура токенів

Дизайн-система побудована на трирівневій ієрархії:

```text
Foundations (v1.0.0)
├── 1. Primitives (незмінні сирі значення)
│   ├── Colors (Night/Day scales, ink, paper, brass, mint, line, error)
│   ├── Spacing (4/8pt scale: 0, 4, 8, 12, 16, 24, 32, 48, 64, 96px)
│   ├── Radii (none, sm: 3px, md: 6px, card: 14px, pill: 9999px)
│   ├── Typography (Inter, Fraunces, Georgia, Consolas)
│   └── Motion (fast: 160ms, standard: 320ms, entrance: 640ms)
├── 2. Semantic Tokens (ролі з підтримкою тем Night / Day)
│   ├── Surfaces: --bg, --bg-soft, --surface, --surface-2
│   ├── Content: --text, --muted, --faint
│   ├── Actions & Signals: --accent (brass), --on-accent, --signal (celadon)
│   └── Feedback: --error, --success, --border, --border-soft
└── 3. Component Tokens
    ├── Control sizes: sm (32px), md (40px), lg (48px)
    ├── Touch target minimum: ≥ 44×44px (WCAG 2.2 AA)
    └── Focus indicator: 2px solid var(--accent), offset 2px
```

## 2. Семантична палітра та контрастність WCAG 2.2 AA (v2.0.0)

`npm run tokens:check` (`scripts/check-design-tokens.ts`) перевіряє 90 текстових пар (9 ролей × 5 поверхонь × 2 теми, мінімум 4,5:1), UI-пари `lineStrong` / `focus` / `accent` (≥ 3:1), синхронність `globals.css` з `tokens.ts` і відсутність розмірів шрифту < 12 px у `src/`.

| Роль | Night (bg `#171918`) | Day (bg `#efe8da`) | Контраст Night | Контраст Day |
|---|---|---|---|---|
| `--text` | `#f0e9dc` | `#1d211d` | 14,63:1 | 13,38:1 |
| `--muted` | `#b9b7ac` | `#4d5148` | 8,78:1 | 6,66:1 |
| `--faint` | `#a3a197` | `#5a5e54` | 6,82:1 | 5,44:1 |
| `--accent` | `#d4b483` | `#72562e` | 8,96:1 | 5,58:1 |
| `--on-accent` на accent | `#171918` | `#fdfaf4` | 8,96:1 | 6,53:1 |
| `--signal` | `#b5d8cc` | `#2d6559` | 11,49:1 | 5,53:1 |
| `--error` | `#ff9b8a` | `#b3261e` | 8,67:1 | 5,36:1 |

(Контраст на `bg`; для решти чотирьох поверхонь — повний вивід `npm run tokens:check`.) Нові ролі 2.0: `--stage`, `--raised`, `--overlay`, `--line-strong`, `--claret`, `--velvet`, `--focus`, `--warning`, `--success`. Мінімальна зона натискання: **44×44 px**; розміри контролів 36/44/52 px.

## 3. Таблиця міграції Legacy → After Hours

| Legacy-значення у globals.css | Новий семантичний токен | Night значення | Day значення |
|---|---|---|---|
| `#0f0f0f` | `var(--bg)` | `#171918` | `#efe8da` |
| `#141414` | `var(--bg-soft)` | `#131514` | `#e6ddcc` |
| `#1a1a1a` | `var(--surface)` | `#1f2321` | `#f7f2e8` |
| `#202020` | `var(--surface-2)` | `#282d29` | `#e6ddcc` |
| `#2a2a2a` | `var(--border)` | `#3b413c` | `#d6cebf` |
| `#232323` | `var(--border-soft)`| `#2d332f` | `#e2dacb` |
| `#e8e8e8` | `var(--text)` | `#f0e9dc` | `#1d211d` |
| `#a3a3a3` | `var(--muted)` | `#b9b7ac` | `#4d5148` |
| `#6a6a6a` | `var(--faint)` | `#a3a197` | `#5a5e54` |
| `#f0c040` | `var(--accent)` | `#d4b483` | `#72562e` |

Усі шість legacy-значень у `src/` UI-компонентах замінено; винятки (OG-зображення, PDF, duotone) — в [ADR 2026-09-29](../decisions/2026-09-29-design-tokens-2-0-migration.md) §4.

## 4. Governance і версіонування

1. **Джерело істини:**
   - Модуль `src/lib/design-system/tokens.ts` є програмним джерелом істини для TypeScript.
   - `src/app/globals.css` є CSS-джерелом істини через Tailwind v4 `@theme inline`.
2. **Версіонування:** SemVer.
   - Patch: виправлення контрастності або коригування відтінку в межах ±5% яскравості.
   - Minor: додавання нових токенів або компонентних ролей без ламання наявних інтерфейсів.
   - Major: перейменування чи видалення токенів, зміна шкали типографіки чи сітки.
3. **Changelog v2.0.0 (2026-09-29, major):** токени 2.0.0 перенесені в `tokens.ts` і `globals.css`; повне Day-перевизначення; `--faint` виправлено (AA); шкала типографіки в `rem` із floor 12 px (`text-2xs`); ролі `stage/raised/overlay/line-strong/claret/velvet/focus/warning/success`; `zIndex`, `controlSize`; гейт `tokens:check` розширено (90 пар, drift, floor). Рішення: [ADR](../decisions/2026-09-29-design-tokens-2-0-migration.md).
4. **Changelog v1.0.0 (2026-09-26):**
   - Уніфікація токенів After Hours і чинного production.
   - Додано перевірку WCAG AA (`scripts/check-design-tokens.ts`).
   - Зафіксовано обов'язковий touch-target floor 44px.
   - Створено таблицю міграції legacy-палітри.

## 5. Знахідка `--faint` і її виправлення

До 2026-09-29 `--faint` не проходив AA для звичайного тексту (source: розрахунок WCAG relative luminance 2026-09-28):

| Джерело | Пара | Контраст | AA 4,5:1 |
|---|---|---|---|
| `tokens.ts` v1.0.0, Night | `faint #78766c` на `bg #171918` | 3,88:1 | ні |
| `tokens.ts` v1.0.0, Day | `faint #84877b` на `bg #f0e9dc` | 3,03:1 | ні |
| live `globals.css`, dark (до виправлення) | `#6a6a6a` на `#0f0f0f` / `#1a1a1a` | 3,54:1 / 3,22:1 | ні |
| **v2.0.0 (зараз)** | `#a3a197` (Night) / `#5a5e54` (Day) на всіх 5 поверхнях | ≥ 4,5:1 | **так** |

`text-faint` / `var(--faint)` трапляється в `src/` 99 разів у 47 файлах; виправлення одним значенням токена покрило всі. Регресію блокує `tokens.test.ts` («keeps --faint above 4.5:1 on every surface») і `tokens:check`. (source: `grep` по `src/` 2026-09-29; `src/lib/design-system/tokens.test.ts`)

## 6. AH-1.7: ratchet сирих значень

`npm run design:raw:check` входить першим кроком у `npm run pr:check`.
Скрипт перевіряє `.ts`, `.tsx`, `.css` у `src/app/` і `src/components/`:
hex/rgb/hsl-літерали, довільні `z-[…]`, тіні та розміри тексту < 12 px.
Вивід містить `файл:рядок` і запропонований токен; пропозиція потребує звірки
ролі, автоматичного виправлення немає. (source: `scripts/report-raw-design-values.ts`, `package.json`)

Baseline — `scripts/raw-design-values.baseline.json`: ідентичність = файл +
тип + нормалізоване значення, з кількістю входжень. Переміщення рядків не
створює борг; нове значення, друга копія або перенесення в інший файл валять
перевірку. Після видалення сирих значень треба виконати
`npm run design:raw:prune` і закомітити зменшений baseline. `--prune` відмовляє
за наявності нових входжень; `--init` не перезаписує існуючий baseline.
(source: `scripts/report-raw-design-values.ts`; `src/lib/design-system/raw-design-values.test.ts`)

Винятки: Admin (поза межами епіку), тести, OG/Twitter `ImageResponse` маршрути,
`brand-mark.ts`, соціальні/PDF/card-рендери та конкретна SVG-ілюстрація
`not-found-illustration.tsx`. Декларації custom properties у канонічному
`src/app/globals.css` є визначеннями токенів; їхні споживачі перевіряються.
`z-[var(--z-…)]` і `shadow-[var(--shadow-…)]` дозволені. Звіт є лексичним
скануванням і не оцінює computed styles чи значення з БД; це задача QA-матриці.
(source: `scripts/report-raw-design-values.ts`; [епік](../product/after-hours-redesign-epic.md) AH-1.7)

Актуальний baseline після AH-1.3 і resolve #377 2026-09-30: **42** входження кольорів у **20** файлах, **4** довільні
z-index, **0** сирих тіней, **0** розмірів шрифту < 12 px у цій області.
Це нова область підрахунку hex/rgb/hsl з винятками, а не повтор старого
hex-only підрахунку B4. У кінці кожної фази результат `design:raw:report`
дописується до `wiki/log.md`; baseline зменшується в PR міграції споживачів.
(source: `npm run design:raw:prune` 2026-09-30; `scripts/raw-design-values.baseline.json`;
`src/app/manifest.ts` після [PR #378](https://github.com/sanchahous/ai-today-brief/pull/378))

## Related pages

- [after-hours-redesign](../product/after-hours-redesign.md) — концепт, таблиця міграції 1.0 → 2.0.
- [ADR 2026-09-29: міграція токенів 2.0.0](../decisions/2026-09-29-design-tokens-2-0-migration.md)
- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md) — аудит розривів і порядок робіт.
- [news-discovery ADR](../decisions/2026-09-26-news-discovery-and-pagination-architecture.md)
