# Дизайн-система After Hours: архітектура токенів і governance (v2.1.0)

Summary: єдина канонічна специфікація токенів дизайн-системи After Hours v2.1.0 (міграція з 1.0.0 виконана 2026-09-29): трирівнева модель (Primitives → Semantics → Components), звіт доступності WCAG AA, правила міграції з legacy-палітри globals.css та політика версіонування.
Sources: `wiki/audits/2026-09-26-design-system-gap-plan.md`; `artifacts/after-hours/tokens.json`; `artifacts/after-hours/tokens.css`; `artifacts/after-hours/qa/token-contrast.json`; `src/app/globals.css`; `src/lib/design-system/tokens.ts`; `scripts/check-design-tokens.ts`; `e2e/focus-visible.spec.ts`; `e2e/helpers/viewports.ts`; `wiki/decisions/2026-09-29-design-tokens-2-0-migration.md`; розрахунок контрасту 2026-09-29.
Last updated: 2026-10-03

**Статус:** прийнято. Джерело істини для дизайн-токенів у кодовій базі (source: wiki/audits/2026-09-26-design-system-gap-plan.md).

---

## 1. Трирівнева архітектура токенів

Дизайн-система побудована на трирівневій ієрархії:

```text
Foundations (v1.0.0)
├── 1. Primitives (незмінні сирі значення)
│   ├── Colors (Night/Day scales, ink, paper, brass, mint, line, error)
│   ├── Spacing (4/8pt scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px)
│   ├── Radii (none, xs: 3px, sm: 4px, md: 8px, card: 14px, pill: 9999px)
│   ├── Typography (Inter, Fraunces, Georgia, Consolas)
│   └── Motion (fast: 160ms, standard: 320ms, entrance: 640ms)
├── 2. Semantic Tokens (ролі з підтримкою тем Night / Day)
│   ├── Surfaces: --bg, --bg-soft, --surface, --surface-2
│   ├── Content: --text, --muted, --faint
│   ├── Actions & Signals: --accent (brass), --on-accent, --signal (celadon)
│   └── Feedback: --error, --success, --border, --border-soft
└── 3. Component Tokens
    ├── Control sizes: sm (36px), md (44px), lg (52px)
    ├── Touch target minimum: ≥ 44×44px (WCAG 2.2 AA)
    └── Focus indicator: 2px solid var(--focus), offset 3px
```

## 2. Семантична палітра та контрастність WCAG 2.2 AA (v2.0.0)

`npm run tokens:check` (`scripts/check-design-tokens.ts`) — єдиний контраст-гейт (AH-1.2): 222 пари в обох темах. Текст ≥ 4,5:1: дев'ять текстових ролей × п'ять поверхонь; `text`, `muted`, `faint`, `accent` на `overlay`; дев'ять `--cat-*` на `bg`, `surface`, `raised`; `--art-*`, `--art-neutral`, `--art-text` на `--art-stage`; `on-accent` на `accent`, `accent-fill`, `accent-fill-hover`; `accent-hover` на трьох поверхнях; `on-velvet` на `velvet` і `velvet-deep`; `selection-text` на `selection-bg`; Night-`text`, `accent`, `signal` на `stage`. UI ≥ 3:1: `line-strong`, `focus`, `accent-fill` на `bg`, `surface`, `raised`; `accent` на `bg`, `surface`; `claret` на `velvet`. Звіт друкує найнижчі значення категорій (зараз Night 6,41:1, Day 5,22:1). Гейт також перевіряє синхронність `globals.css` з `tokens.ts`, реєстр токенів (§7) і відсутність розмірів шрифту < 12 px у `src/`. Будь-яка пара нижче порогу валить `tokens.test.ts`, тобто `pr:check`. Старого 8-парного гейта v1 немає.

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

### Категорії 2.1.0 (AH-1.4)

Додано дев'ять `--cat-*` із Night/Day jewel tones та незмінні `--art-*` для
темних банерів. 54 категорійні пари на bg/surface/raised ≥5.2238:1; CSS drift
контролює обидва сімейства. Mapping — `CategoryMeta.tokenKey`; DB color лише
fallback невідомих. Day color-mix overrides прибрано.
(source: `src/lib/design-system/tokens.ts`; `src/lib/category-meta.ts`;
[AH-1.4 validation](../product/after-hours-ah-1-4-validation.md))

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
3. **Changelog v2.1.0 (2026-09-30, minor):** category/art roles, 54 контрастні пари й drift; [докази AH-1.4](../product/after-hours-ah-1-4-validation.md).
4. **Продовження v2.1.0 (2026-09-30, AH-1.2):** єдиний контраст-гейт 2.0 (222 пари замість 158) і сім токенів прототипу, яких бракувало в коді: `--accent-hover`, `--accent-fill`, `--accent-fill-hover`, `--velvet-deep`, `--on-velvet`, `--selection-bg`, `--selection-text` (Night і Day; споживачі з'являться з компонентами фази 2 і 3). Візуально нічого не змінюється.
5. **Продовження v2.1.0 (2026-09-30, AH-1.6):** простір, форма, глибина, шари, рух, фокус і брейкпоінти D5 перенесені в `tokens.ts` і `globals.css` (реєстр — §7); `tokens:check` і `tokens.test.ts` тепер звіряють з `tokens.ts` усі не-кольорові токени й падають, якщо токен оголошено в `globals.css`, але не задокументовано в реєстрі. Змінилося: радіуси 3/4/8/14/pill (`--radius-sm` 3→4, `--radius-md` 6→8, `--radius-pill` 999→9999), тіні `--shadow-pop` (Night і Day), `--shadow-card` замінено на `--shadow-1`, фокус-офсет 2→3 px. Не змінилося навмисно: стандартні `sm/md/lg/xl` Tailwind. Значення `--header-h` оновлено в AH-3.3.
6. **Changelog v2.0.0 (2026-09-29, major):** токени 2.0.0 перенесені в `tokens.ts` і `globals.css`; повне Day-перевизначення; `--faint` виправлено (AA); шкала типографіки в `rem` із floor 12 px (`text-2xs`); ролі `stage/raised/overlay/line-strong/claret/velvet/focus/warning/success`; `zIndex`, `controlSize`; гейт `tokens:check` розширено (90 пар, drift, floor). Рішення: [ADR](../decisions/2026-09-29-design-tokens-2-0-migration.md).
7. **Changelog v1.0.0 (2026-09-26):**
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

Ratchet після AH-1.4: 30 кольорових входжень (було 42), 4 довільні z-index, 0 сирих тіней і шрифтів <12 px. (source: `npm run design:raw:prune`, `scripts/raw-design-values.baseline.json`, 2026-09-30)

## 7. Реєстр токенів (AH-1.6, M1-гейт)

Кожна змінна, оголошена в `:root`, у Day-блоці та в `@theme` блоках `src/app/globals.css`, має бути тут у зворотних лапках. Інакше `npm run tokens:check` і `tokens.test.ts` (тобто `pr:check`) падають зі списком відсутніх токенів. Значення в CSS звіряються з `src/lib/design-system/tokens.ts`. Реєстрації Tailwind виду `--color-<роль>: var(--<роль>)` покриваються цільовою змінною. Кольорові значення ролей — у §2 і в `SEMANTIC_TOKENS`; тут — назва, роль і використання.

### 7.1 Кольорові ролі

Обидві теми визначені для кожної ролі; Night — `:root`, Day — `.theme-light` / `html[data-theme='day']`. Tailwind: `bg-bg`, `text-muted`, `border-border` тощо (реєстрації `--color-*`).

| Токен | Роль і використання | Код-мапінг |
|---|---|---|
| `--bg` | фон сторінки | `SEMANTIC_TOKENS.<тема>.bg` |
| `--bg-soft` | заглиблений фон, підвал | `bgSoft` |
| `--stage` | завжди темна «сцена» (банери, hero) | `stage` |
| `--surface` | картки й панелі | `surface` |
| `--surface-2` | вторинна поверхня: чіпи, вставки | `surface2` |
| `--raised` | піднята поверхня: popover, toast | `raised` |
| `--overlay` | шар над raised: tooltip, меню | `overlay` |
| `--border` | декоративна лінія | `border` |
| `--border-soft` | м'який розділювач | `borderSoft` |
| `--line-strong` | межа елемента керування (≥ 3:1) | `lineStrong` |
| `--text` | основний текст | `text` |
| `--muted` | другорядний текст | `muted` |
| `--faint` | третинний текст (≥ 4.5:1) | `faint` |
| `--accent` | латунний акцент, посилання | `accent` |
| `--on-accent` | текст на заливці accent | `onAccent` |
| `--accent-hover` | hover кольору accent: текст і посилання (Night brass-300, Day brass-800) | `accentHover` |
| `--accent-fill` | заливка кнопки й акцентних плашок (дорівнює accent, окреме ім'я для компонентів AH-2.2) | `accentFill` |
| `--accent-fill-hover` | hover заливки accent | `accentFillHover` |
| `--signal` | целадон: статус, підказки | `signal` |
| `--claret` | бордо: увага, сповіщення | `claret` |
| `--velvet` | оксамитова заливка (тло claret-блоків) | `velvet` |
| `--velvet-deep` | глибший відтінок velvet: нижній шар, hover | `velvetDeep` |
| `--on-velvet` | текст на velvet і velvet-deep | `onVelvet` |
| `--selection-bg` | тло виділеного тексту (`::selection`) | `selectionBg` |
| `--selection-text` | текст виділення | `selectionText` |
| `--focus` | колір кільця фокуса | `focus` |
| `--error` | помилка | `error` |
| `--success` | успіх | `success` |
| `--warning` | попередження | `warning` |
| `--accent-rgb` | канали accent для `rgb(var(--accent-rgb) / α)` у градієнтах | не з `tokens.ts` |

### 7.1.1 Кольори категорій (AH-1.4)

Дев'ять відомих slug-ів мають semantic `--cat-*` для Night і Day; `--art-*` — незмінні відтінки для темних банерів без зображення (не перемикаються з темою). Значення в `PRIMITIVES.categoryPalette`; колір із БД лише резерв для невідомих категорій. Контраст `--cat-*` ≥ 4.5:1 на `--bg`, `--surface`, `--raised` обох тем перевіряє `tokens:check`.

| Токен | Роль і використання | Код-мапінг |
|---|---|---|
| `--cat-tools` | Tools & releases: текст, межі, точки | `catTools` |
| `--cat-tutorials` | Tutorials & guides | `catTutorials` |
| `--cat-cost` | Token & cost optimization | `catCost` |
| `--cat-agents` | Agents & MCP | `catAgents` |
| `--cat-vibe` | Vibe coding workflow | `catVibe` |
| `--cat-creative` | Creative AI | `catCreative` |
| `--cat-local` | Local LLMs | `catLocal` |
| `--cat-career` | Career & monetisation | `catCareer` |
| `--cat-models` | Models & research | `catModels` |
| `--art-tools` | відтінок банера Tools на темній сцені (однаковий у Night і Day) | `artTools` |
| `--art-tutorials` | відтінок банера Tutorials | `artTutorials` |
| `--art-cost` | відтінок банера Cost | `artCost` |
| `--art-agents` | відтінок банера Agents | `artAgents` |
| `--art-vibe` | відтінок банера Vibe | `artVibe` |
| `--art-creative` | відтінок банера Creative | `artCreative` |
| `--art-local` | відтінок банера Local | `artLocal` |
| `--art-career` | відтінок банера Career | `artCareer` |
| `--art-models` | відтінок банера Models | `artModels` |
| `--art-neutral` | нейтральний відтінок банера невідомої категорії | `artNeutral` |
| `--art-text` | текст на темному банері | `artText` |
| `--art-stage` | фон темної сцени банера | `artStage` |

### 7.2 Типографіка

AH-1.5 підключає локальні OFL subset-и через `next/font/local`; кирилиця Inter передує Latin fallback у стеку, щоб Arial не перехоплював українські літери. Display українською — повністю Georgia за D4, включно з Latin product names та italic. Шкала й UK-перевизначення під drift-гейтом. (source: `src/app/fonts.ts`; `src/app/globals.css`; `scripts/check-design-tokens.ts`; [ADR D3–D4](../decisions/2026-09-29-after-hours-rollout-and-foundations.md))

| Токен | Роль і використання | Значення |
|---|---|---|
| `--font-sans` | UI і читання (Inter Cyrillic → Inter Latin → системний запасний) | `PRIMITIVES.typography.fonts.sans` |
| `--font-serif` | сумісний Tailwind alias display | `var(--font-display)` |
| `--font-display` | Fraunces; Georgia для UK | `fonts.serif` / `fonts.ukDisplayFallback` |
| `--font-display-italic` | Fraunces italic без preload; Georgia для UK | `fonts.italic` / `fonts.ukDisplayFallback` |
| `--font-mono` | системний mono для мета й eyebrow | `fonts.mono` |
| `--font-ah-display` | family і метричний fallback, згенеровані Next | `displayFont.variable` |
| `--font-ah-display-italic` | family і метричний fallback, згенеровані Next | `displayItalicFont.variable` |
| `--font-ah-sans` | Inter Latin і Arial з корекцією метрик | `sansFont.variable` |
| `--font-ah-cyrillic` | Inter Cyrillic з unicode-range | `cyrillicFont.variable` |
| `--text-2xs` | 12 px — мінімум для мета і eyebrow; `text-2xs` | 0.75rem |
| `--text-2xs--line-height` | інтерліньяж `text-2xs` | 1.5 |
| `--text-xs` | 13 px — підписи | 0.8125rem |
| `--text-sm` | 14 px — вторинний текст | 0.875rem |
| `--text-md` | 16 px — UI | 1rem |
| `--text-base` | сумісний alias `text-base` | `var(--text-md)` |
| `--text-lg` | 18 px — читання | 1.125rem |
| `--text-xl` | 19–22 px — картки | `scale.xl` |
| `--text-2xl` | 22–28 px — H3 | `scale.2xl` |
| `--text-3xl` | 28–40 px — H2 | `scale.3xl` |
| `--text-4xl` | 36–58 px — H1 | `scale.4xl` |
| `--text-5xl` | 42–72 px — masthead | `scale.5xl` |
| `--leading-tight` | display | 1.06 |
| `--leading-heading` | заголовки | 1.14 |
| `--leading-body` | UI | 1.65 |
| `--leading-reading` | `.reading-copy`, MarkdownBody | 1.78 |
| `--tracking-display` | display / UK | −0.032em / −0.012em |
| `--tracking-heading` | заголовки / UK | −0.02em / −0.008em |
| `--tracking-meta` | довгий `.eyebrow-registry` у sentence case | 0.08em |
| `--tracking-eyebrow` | короткий `.eyebrow`, uppercase | 0.13em |
| `--measure` | максимальна міра `.reading-copy` | 68ch |

Значення таблиці походять із `PRIMITIVES.typography`, `CSS_THEME_TYPOGRAPHY`, `CSS_VARS_UK_TYPOGRAPHY` та CSS; декларації Next family задає `fonts.ts`. Кирилицю й OFL перевіряє `artifacts/after-hours/qa/check-ah-1.5-fonts.mjs`. (source: `src/lib/design-system/tokens.ts`; `src/app/fonts.ts`; `src/app/globals.css`)

### 7.3 Простір і ритм

Шкала 4/8. Tailwind-відступи (`p-4`, `gap-6`) лишаються з базового кроку Tailwind; `--space-*` — для власного CSS і збігу з прототипом. Реєстрації `--spacing-gutter`, `--spacing-section-y` дають `px-gutter`, `py-section-y`.

| Токен | Значення | Використання |
|---|---|---|
| `--space-1` | 4px | дрібні проміжки, іконка + текст |
| `--space-2` | 8px | щільні групи |
| `--space-3` | 12px | внутрішній відступ чіпа |
| `--space-4` | 16px | базовий відступ |
| `--space-5` | 20px | внутрішній відступ картки |
| `--space-6` | 24px | між блоками картки |
| `--space-8` | 32px | між групами |
| `--space-10` | 40px | верхня межа gutter |
| `--space-12` | 48px | нижня межа section-y |
| `--space-16` | 64px | великі розділи |
| `--space-20` | 80px | розділи сторінки |
| `--space-24` | 96px | найбільший крок |
| `--gutter` | clamp(16px, 4vw, 40px) | бічні поля сторінки |
| `--section-y` | clamp(48px, 7vw, 88px) | вертикальний ритм між секціями |

### 7.4 Форма

Радіуси 3 / 4 / 8 / 14 / pill. `rounded-lg` лишається власним 0.5rem (8px) Tailwind — 86 наявних використань не рухаються. Прототипне `--radius-lg` (14px) у коді — `--radius-card`.

| Токен | Значення | Tailwind і використання |
|---|---|---|
| `--radius-xs` | 3px | `rounded-xs`, прототипне `--radius`: дрібні мітки |
| `--radius-sm` | 4px | `rounded-sm`, бейджі; радіус кільця фокуса |
| `--radius-md` | 8px | `rounded-md`, поля й кнопки (було 6px) |
| `--radius-card` | 14px | `rounded-card`, картки |
| `--radius-pill` | 9999px | `rounded-pill`, чіпи |

### 7.5 Розміри й міри

| Токен | Значення | Використання |
|---|---|---|
| `--touch-target-min` | 44px | мінімальна зона натискання (WCAG 2.2 AA) |
| `--control-sm` | 36px | компактний контрол |
| `--control-md` | 44px | типовий контрол |
| `--control-lg` | 52px | великий контрол |
| `--icon-sm` | 16px | дрібна іконка |
| `--icon-md` | 20px | іконка контрола |
| `--max` | 1280px | ширина сторінки; `max-w-page` |
| `--max-wide` | 1440px | широка сторінка; `max-w-page-wide` |
| `--reading` | 42.5rem | міра читання (680px за замовчуванням); `max-w-reading` |
| `--header-h` | 76px (mobile) / 132px (desktop) | висота header і sticky-зсуви |

`--header-h` змінено на 76px для мобільних та 132px для десктопу в рамках AH-3.3. Значення прототипу (72px) записано як `PRIMITIVES.sizes.headerHPrototype`.

### 7.6 Глибина й ефекти

Кожен токен має окреме Day-значення: тепла тінь малої непрозорості й білий inset-відблиск. Класи: `.shadow-1` (= `.elevation-card`), `.shadow-2`, `.shadow-pop`.

| Токен | Роль | Night / Day |
|---|---|---|
| `--shadow-1` | картка у спокої (замінив `--shadow-card`) | `PRIMITIVES.shadows.<тема>.shadow1` |
| `--shadow-2` | піднята панель | `shadow2` |
| `--shadow-pop` | dropdown, popover, dialog | `pop` |
| `--stage-light` | плями світла на темній сцені, градієнт | `PRIMITIVES.effects.<тема>.stageLight` |
| `--sheen` | блиск при русі, градієнт | `sheen` |
| `--grain-opacity` | непрозорість зерна (0.07 Night, 0.05 Day) | `grainOpacity` |

Споживачі `--stage-light`, `--sheen`, `--grain-opacity` з'являться з hero й editorial-патернами (AH-5.x); до того токени лише зарезервовано.

### 7.7 Шари

Довільні `z-[…]` заборонені ratchet-ом (§6); використовувати `z-[var(--z-…)]`.

| Токен | Значення | Використання |
|---|---|---|
| `--z-base` | 1 | піднятий контент у власному контексті |
| `--z-sticky` | 30 | sticky header, панелі |
| `--z-dropdown` | 60 | dropdown, popover, tooltip |
| `--z-overlay` | 80 | підкладка модальних шарів |
| `--z-dialog` | 90 | запасний шар діалогу під toast |
| `--z-toast` | 100 | toast; банер згоди досі малює сирий `z-[100]` |
| `--z-modal` | 120 | модальна оболонка `OverlayDrawer`: над toast і банером згоди |

### 7.8 Рух (Tension v3)

Правило `prefers-reduced-motion: reduce` лишається: анімації скорочуються до 0.001ms, `.reveal` показується одразу. Наявні переходи з власними таймінгами (`.reveal`, `.card-hover`) не змінено — вони переходять на ці токени з компонентами фази 2 і рухом фази 6.

| Токен | Значення | Використання |
|---|---|---|
| `--duration-fast` | 160ms | hover, натискання |
| `--duration-standard` | 320ms | перехід стану, розкриття |
| `--duration-entrance` | 640ms | поява блоку |
| `--ease-standard` | cubic-bezier(0.18, 0.82, 0.26, 1) | прототипне `ease`; `ease-standard` |
| `--ease-soft` | cubic-bezier(0.65, 0, 0.35, 1) | прототипне `ease-in-out`; перейменовано, щоб Tailwind `ease-in-out` не змінився |
| `--ease-release` | cubic-bezier(0.2, 0.85, 0.25, 1.08) | легкий «відскок» при відпусканні |

### 7.9 Фокус і forced colors

Кільце фокуса: `--focus-width` 2px кольору `--focus` на відстані `--focus-offset` 3px (було 2px). Базове правило `:focus-visible` покриває посилання, кнопки, поля, `textarea`, `summary` і `[tabindex]`; примітиви `ui/` беруть відстань із токена (`outline-offset-(--focus-offset)`). У `@media (forced-colors: active)` кільце — системний колір `Highlight`, а поверхні, які тримались лише на тіні, отримують межу `CanvasText`.

| Токен | Значення | Використання |
|---|---|---|
| `--focus-width` | 2px | товщина кільця |
| `--focus-offset` | 3px | відстань кільця до елемента |

### 7.10 Брейкпоінти (D5, варіант A)

Значення прототипу в rem, щоб розкладка реагувала на збільшення шрифту в браузері. Tailwind будує з них `min-width` варіанти (`tablet:` від 60rem); `max-width` запити прототипу — `max-tablet:` (Tailwind порівнює строго «менше», тож межа відрізняється на 1px від прототипу). Стандартні `sm/md/lg/xl` не перевизначено до AH-7.3. Header і news-layout перемикаються на `tablet` (960px) з AH-3.3; решта discovery-шаблонів — в AH-4.3. Контракт для e2e — `e2e/helpers/viewports.ts` (`NAV_COMPACT_LAST` 959 / `NAV_WIDE_FIRST` 960).

| Токен | Значення | px за замовчуванням |
|---|---|---|
| `--breakpoint-compact` | 23.75rem | 380 |
| `--breakpoint-narrow` | 25rem | 400 |
| `--breakpoint-phone` | 47.5rem | 760 |
| `--breakpoint-tablet` | 60rem | 960 — перемикач header і news-layout з AH-3.3; решта discovery в AH-4.3 |
| `--breakpoint-laptop` | 68.75rem | 1100 |
| `--breakpoint-nav-compact` | 73.75rem | 1180 |
| `--breakpoint-desktop` | 80rem | 1280 |

(source: `src/app/globals.css`; `src/lib/design-system/tokens.ts`; `artifacts/after-hours/tokens.css`, `tokens.json`; [епік](../product/after-hours-redesign-epic.md) AH-1.6; [ADR D5](../decisions/2026-09-29-after-hours-rollout-and-foundations.md))

## Related pages

- [after-hours-redesign](../product/after-hours-redesign.md) — концепт, таблиця міграції 1.0 → 2.0.
- [ADR 2026-09-29: міграція токенів 2.0.0](../decisions/2026-09-29-design-tokens-2-0-migration.md)
- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md) — аудит розривів і порядок робіт.
- [news-discovery ADR](../decisions/2026-09-26-news-discovery-and-pagination-architecture.md)
