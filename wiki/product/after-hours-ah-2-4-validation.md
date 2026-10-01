# AH-2.4: оверлеї — реалізація й докази

Summary: Sheet-варіанти left, right і full у наявному Dialog, disclosure-меню з посиланнями і один focus trap в OverlayDrawer. Міграції header, filters, search і share лишаються наступним задачам. Окремий візуальний підпис очікується.
Sources: `src/components/ui/dialog.tsx`; `src/components/ui/overlay-drawer.tsx`; `src/components/ui/disclosure-nav.tsx`; `e2e/overlays.spec.ts`; `artifacts/after-hours/qa/ah-2.4-evidence.json`; `artifacts/after-hours/qa/capture-catalog-ah-2.4.mjs`; картка [AH-2.4](after-hours-redesign-epic.md#ah-24--оверлеї-dialog--sheet-drawer-menu-disclosure-popover)
Last updated: 2026-10-01

---

## Стан

Реалізовано на гілці `feat/ah-2.4-overlays` від `origin/main` `7f523e6` (merge #389). Номер PR вноситься після створення. Popover, DropdownMenu, Tooltip, Accordion і `use-dismissable` не дубльовано. (source: `git log origin/main -1`; картка AH-2.4)

#388 підписано власником і змерджено в `e75c438` о 09:45 UTC. Це не закриває UK Home/Article/Weekly, Preview CLS, H1/legacy AC AH-1.5 і G1. (source: повідомлення власника 2026-10-01; `gh pr view 388`)

## Реалізація

`Dialog` лишається оболонкою над `OverlayDrawer`. Нові варіанти: `center`, `left`, `right`, `full` (`full` мапиться на наявний `fullscreen`). Ліва панель — дзеркало правої: `w-[min(380px,92vw)]`. Поява панелі — opacity і зсув 4px за `--duration-fast` (160ms, менше за 240ms). У `prefers-reduced-motion` глобальне правило зводить animation-duration до 0.001ms. (source: `dialog.tsx`; `overlay.module.css`; `src/app/globals.css`)

Єдина модальна механіка фокуса й scroll lock — `OverlayDrawer` плюс `useFocusTrap` і `body-scroll-lock`. Header, мобільний пошук і drawer фільтрів уже викликають цей самий компонент; це сумісний варіант, не друга пастка. `DisclosureNav` немодальний: `useDismissable`, без `role="menu"` і без `aria-haspopup` (`true` оголошується як menu). Закриття Escape, бекдропом і кнопкою повертає фокус на тригер. Клік по бекдропу викликає `preventDefault` на mousedown, щоб фокус не лишався на документі. (source: `overlay-drawer.tsx`; `disclosure-nav.tsx`; `src/hooks/use-focus-trap.ts`)

Шар оболонки — `--z-modal: 120`, не довільний `z-[120]`. `--z-dialog` лишається 90 і стоїть нижче за toast. 120 потрібен, бо банер згоди досі малює сирий `z-[100]`, а модалі мають його покривати. Контраст-гейт лишається 222 пари: шар не є кольором. (source: `src/lib/design-system/tokens.ts`; `e2e/cookie-overlay.spec.ts`; [design-system-tokens §7.7](../architecture/design-system-tokens.md#77-шари))

## Споживачі, яких ця задача не мігрує

| Споживач | Файл | Наступна задача |
|---|---|---|
| Мобільне меню header | `src/components/site-header-chrome.tsx` | AH-3.3 |
| Desktop dropdown header, сирий `z-[70]` | `src/components/site-header-chrome.tsx` | AH-3.3 |
| Мобільний пошук | `src/components/search/mobile-search-modal.tsx` | AH-3.2 |
| Preview пошуку, сирий `z-[80]` | `src/components/search-preview-dropdown.tsx` | AH-3.2 |
| Drawer фільтрів News | `src/components/news/news-sidebar.tsx` | AH-4.3 |
| Share на картці, `role="menu"` | `src/components/post-card.tsx` | AH-4.3 |
| Share статті | `src/components/item-share-bar.tsx` | AH-4.3 для карткового патерну; сторінка статті лишається до свого шаблону |

(source: grep `OverlayDrawer` і share у `src/` 2026-10-01; картка AH-2.4)

## Перевірки

- `e2e/overlays.spec.ts` на каталозі проти `http://localhost:3107`: після `data-ready` з `useEffect` — Chromium 6 passed, Firefox і WebKit 12 passed (разом 18). Escape, бекдроп і кнопка закривають centre, left і right і повертають фокус. Tab не виходить із модалі. Повна панель закривається Escape і кнопкою та вкриває viewport. Відкрита модаль фіксує `body` і після закриття повертає `scrollY`. Disclosure не має `menu` / `menuitem`. Scoped axe секції на 390 для UK — 0. Обчислений z-index оболонки 120 без класу `z-[число]`. (source: прогін 2026-10-01; `e2e/overlays.spec.ts`)
- Сирий `z-[120]` прибрано з `overlay-drawer.tsx`. Ratchet після `design:raw:prune`: z-index 3 (було 4 у цій позиції). (source: `scripts/raw-design-values.baseline.json`; `npm run design:raw:prune` 2026-10-01)

## Візуальний review

[Локальна галерея](../../artifacts/after-hours/qa/ah-2.4-review.html): 8 знімків закритої секції і 6 відкритих станів. PNG у git-ignored `artifacts/_local/ah-2-4-catalog`. SHA-256 файлу manifest — `a45c383f77b8dad6a00eea533bad92dc8363af3c99a2f352237daf7671873f20`. Окремий підпис очікується. Публічний full-page report і G1 цією задачею не закриваються. (source: `capture-catalog-ah-2.4.mjs`; manifest 2026-10-01)

Наступна задача за нумерацією — **AH-2.5** після інтеграції цього PR. (source: [епік §5.3](after-hours-redesign-epic.md#53-зведена-таблиця-задач))

## Related pages

- [after-hours-redesign-epic](after-hours-redesign-epic.md) — картка й AC
- [after-hours-epic-handoff](after-hours-epic-handoff.md) — актуальний порядок
- [after-hours-ah-2-3-validation](after-hours-ah-2-3-validation.md) — попередня задача, підписана в #388
- [design-system-tokens](../architecture/design-system-tokens.md) — `--z-modal`
