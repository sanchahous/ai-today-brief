# Дизайн-система After Hours: архітектура токенів і governance

Summary: єдина канонічна специфікація токенів дизайн-системи After Hours v1.0.0: трирівнева модель (Primitives → Semantics → Components), звіт доступності WCAG AA, правила міграції з legacy-палітри globals.css та політика версіонування.
Sources: `wiki/audits/2026-09-26-design-system-gap-plan.md`; `artifacts/after-hours/tokens.json`; `artifacts/after-hours/tokens.css`; `artifacts/after-hours/qa/token-contrast.json`; `src/app/globals.css`; `src/lib/design-system/tokens.ts`; `scripts/check-design-tokens.ts`; розрахунок контрасту 2026-09-28.
Last updated: 2026-09-28

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

## 2. Семантична палітра та контрастність WCAG 2.2 AA

Автоматичний аудит (`scripts/check-design-tokens.ts`) перевіряє всі ключові UI-пари:

| Токен | Night (#171918) | Day (#f0e9dc) | Контраст Night | Контраст Day | Рівень WCAG |
|---|---|---|---|---|---|
| `--text` | `#f0e9dc` | `#232820` | **14.63:1** | **12.46:1** | AAA |
| `--muted` | `#b9b7ac` | `#606358` | **8.78:1** | **5.08:1** | AA (текст) / AAA (великий) |
| `--accent` | `#d4b483` | `#72562e` | **8.96:1** | **5.64:1** | AA (текст) / 3:1+ (UI) |
| `--on-accent` | `#171918` | `#ffffff` | **8.96:1** | **6.80:1** | AA / AAA |
| `--signal` | `#b5d8cc` | `#2d6559` | **11.3:1** | **5.16:1** | AA / AAA |
| `--error` | `#efaaa0` | `#a13328` | **8.2:1** | **6.0:1** | AA |

Мінімальний розмір інтерактивної зони натискання: **44×44px** (неухильне правило для мобільних пристроїв).

## 3. Таблиця міграції Legacy → After Hours

| Legacy-значення у globals.css | Новий семантичний токен | Night значення | Day значення |
|---|---|---|---|
| `#0f0f0f` | `var(--bg)` | `#171918` | `#f0e9dc` |
| `#141414` | `var(--bg-soft)` | `#1c1f1d` | `#e9e1d1` |
| `#1a1a1a` | `var(--surface)` | `#202421` | `#e7dfd0` |
| `#202020` | `var(--surface-2)` | `#2b302c` | `#ddd4c4` |
| `#2a2a2a` | `var(--border)` | `#414640` | `#b4b0a3` |
| `#232323` | `var(--border-soft)`| `#2d332f` | `#cdc7ba` |
| `#e8e8e8` | `var(--text)` | `#f0e9dc` | `#232820` |
| `#a3a3a3` | `var(--muted)` | `#b9b7ac` | `#606358` |
| `#6a6a6a` | `var(--faint)` | `#78766c` | `#84877b` |
| `#f0c040` | `var(--accent)` | `#d4b483` | `#72562e` |

## 4. Governance і версіонування

1. **Джерело істини:**
   - Модуль `src/lib/design-system/tokens.ts` є програмним джерелом істини для TypeScript.
   - `src/app/globals.css` є CSS-джерелом істини через Tailwind v4 `@theme inline`.
2. **Версіонування:** SemVer.
   - Patch: виправлення контрастності або коригування відтінку в межах ±5% яскравості.
   - Minor: додавання нових токенів або компонентних ролей без ламання наявних інтерфейсів.
   - Major: перейменування чи видалення токенів, зміна шкали типографіки чи сітки.
3. **Changelog v1.0.0 (2026-09-26):**
   - Уніфікація токенів After Hours і чинного production.
   - Додано перевірку WCAG AA (`scripts/check-design-tokens.ts`).
   - Зафіксовано обов'язковий touch-target floor 44px.
   - Створено таблицю міграції legacy-палітри.

## 5. Пропозиція 2.0.0 (прототип After Hours v3, 2026-09-28)

Прототип `artifacts/after-hours/` отримав набір токенів **2.0.0-proposal** — за правилами §4 це major: змінено шкалу типографіки (rem, мінімум 12 px, fluid-заголовки), додано ролі (`claret`, `velvet`, `line-strong`, `overlay`, `stage`, `tint-*`), тіні з окремими Day-значеннями (`shadow-1/2/pop`), шкалу z-index і розміри контролів 36/44/52 px; Day-значення поверхонь переглянуто, брейкпоінти задано в `em`. Застарілі назви (`paper`, `ink`, `brass`, `mint`) лишаються аліасами. У `src/` ще **не** перенесено; таблиця v1.0.0 → 2.0 — у [after-hours-redesign §4](../product/after-hours-redesign.md). (source: `artifacts/after-hours/tokens.css`, `tokens.json`; `qa/token-contrast.json` — 160 пар, 0 провалів, 2026-09-28)

Знахідка для міграції: таблиця §2 не містить `--faint`, а саме він не проходить AA для звичайного тексту:

| Джерело | Пара | Контраст | AA 4,5:1 |
|---|---|---|---|
| `tokens.ts` v1.0.0, Night | `faint #78766c` на `bg #171918` | 3,88:1 | ні |
| `tokens.ts` v1.0.0, Day | `faint #84877b` на `bg #f0e9dc` | 3,03:1 | ні |
| live `globals.css`, dark | `--faint #6a6a6a` на `--bg #0f0f0f` / `--surface #1a1a1a` | 3,54:1 / 3,22:1 | ні |
| live `globals.css`, light | `--faint #5c5c5c` на `--bg #faf9f7` | 6,36:1 | так |
| 2.0.0-proposal | `faint #a3a197` (Night) / `#5a5e54` (Day) на bg | 6,82:1 / 5,44:1 | так |

`text-faint` / `var(--faint)` трапляється в `src/` близько 90 разів (дати, мета, підписи), тож на живому сайті в темній темі дрібні мета-тексти мають контраст нижче AA. Production-код цим оновленням не змінювався; виправлення — або в міграції на 2.0, або окремим patch (§4: корекція контрасту). (source: `src/app/globals.css`; `src/lib/design-system/tokens.ts`; `grep` по `src/` 2026-09-28; розрахунок WCAG relative luminance)

## Related pages

- [after-hours-redesign](../product/after-hours-redesign.md) — концепт, таблиця міграції 1.0 → 2.0.
- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md) — аудит розривів і порядок робіт.
- [news-discovery ADR](../decisions/2026-09-26-news-discovery-and-pagination-architecture.md)
