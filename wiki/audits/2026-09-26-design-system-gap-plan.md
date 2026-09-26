# Аудит повноти концепції та дизайн-системи

Summary: After Hours є сильним візуальним напрямком і широким набором макетів, але ще не є завершеною функціональною дизайн-системою. Цей аудит фіксує розриви між концептом, production UI та продуктовою поведінкою і задає порядок допрацювання від контрактів до rollout.
Sources: скріншот власника 2026-09-26; browser live review `https://aitodaybrief.com/en/news` 2026-09-26; `wiki/product/after-hours-redesign.md`; `wiki/product/after-hours-tension.md`; `artifacts/after-hours/app.js`; `artifacts/after-hours/style.css`; `artifacts/after-hours/tokens.css`; `artifacts/after-hours/tokens.json`; `artifacts/after-hours/verification.json`; `src/app/[lang]/news/page.tsx`; `src/components/news/news-feed.tsx`; `src/components/news/news-sidebar.tsx`; `src/components/pagination.tsx`; `src/lib/news.ts`; `src/lib/news-filters.ts`; `src/app/globals.css`; `e2e/news-filters-drawer.spec.ts`; `e2e/news-sidebar.spec.ts`; none (design recommendations).
Last updated: 2026-09-26

---

## 1. Вердикт

**Візуальна концепція сформована; продуктова й компонентна система — ні.** After Hours уже задає впізнавану атмосферу, основну палітру, шрифти, responsive-композиції, motion-напрям і багато page-level макетів. Водночас ключові сценарії discovery — пошук, теги, фасети, сортування, URL-state, пагінація й мобільне керування — або не показані в концепті, або працюють у production за іншою логікою. (source: `artifacts/after-hours/`; browser live review 2026-09-26; `src/components/news/`)

Тому поточний статус слід називати так:

- **Visual direction:** достатньо зрілий для подальшого розвитку.
- **Page concepts:** широке покриття, але частина екранів демонстраційна.
- **Interaction model:** частковий і неузгоджений із production.
- **Component library:** не сформована як повна версійована система.
- **Production readiness:** відсутня до закриття P0/P1 нижче.

Це не вимога відмовитись від After Hours. Потрібно змінити порядок робіт: спершу функціональний контракт і foundations, потім компоненти та один production vertical slice, і лише після цього — повний візуальний rollout. (source: design recommendation)

## 2. Що вже добре і не потребує перезапуску

| Сфера | Що можна зберегти | Межа |
|---|---|---|
| Візуальна ідентичність | Тепле dark-first середовище, brass action, celadon signal, editorial serif + Inter | Потрібна повна semantic-token модель і перевірка всіх UI-пар, а не лише текстових пар |
| Editorial direction | Чітка відмінність daily, weekly, article, concept, guide, toolbox | Потрібно зафіксувати повторювані editorial patterns як компоненти |
| Responsive intent | Окремі desktop/mobile композиції та контроль overflow | Бракує поведінкових контрактів на проміжних breakpoint і при 200% zoom |
| Motion | Tension v2 має reduced-motion, finite animation і performance guards | Motion не має випереджати базові control/state contracts |
| Article system | Три повні production-like формати статей | Це ще не вирішує discovery, archive і component governance |
| Accessibility intent | Focus, Escape, touch target, contrast checks присутні в концепті | Перевірені окремі сценарії, а не повна матриця компонентів і станів |

(source: `wiki/product/after-hours-redesign.md`; `wiki/product/after-hours-tension.md`; `artifacts/after-hours/artifact-audit.json`)

## 3. Карта розривів

Пріоритети: **P0** — блокує коректний redesign; **P1** — обов’язково до широкого rollout; **P2** — після vertical slice; **P3** — покращення, яке не блокує запуск.

| ID | Пріоритет | Недопрацювання | Доказ / наслідок | Потрібний результат |
|---|---:|---|---|---|
| G01 | P0 | Немає єдиного статусу концепту | Wiki/README називають концепт завершеним, хоча News-макет має лише category chips і «End of demo selection» без sort/pagination | Перейменувати статус на visual concept + functional gap plan; не використовувати «production-ready» до acceptance gate |
| G02 | P0 | Концепт і production мають різні discovery-моделі | After Hours News: 5 category chips. Production: category/date/sort/sidebar/pagination. Немає canonical interaction contract | Одна специфікація Search/Filter/Sort/Pagination для concept, code і QA |
| G03 | P0 | Сортування має неправдиві назви | `Most discussed` сортує `rank` за спаданням, хоча comments вимкнені; `Relevance` поза full-text search теж означає лише внутрішній rank | Лишити тільки semantics, підкріплені даними; прибрати або перейменувати фіктивні режими |
| G04 | P0 | Pagination і URL-state не відновлюються | Live test: клік page 2 дав `?page=2`, але reload на тому самому URL показав перший item page 1. Filter/sort взагалі не змінили URL | Shareable/restorable state, коректні Back/Forward/reload, доступні links або чітко обраний cursor pattern |
| G05 | P0 | Обіцянка «every story» не відповідає data scope | `/news` завантажує максимум 100 items; search — максимум 80; клієнт ділить лише отриманий зріз по 12 | Явний total, server/cursor pagination або чесний label «Latest 100» до реалізації повного архіву |
| G06 | P0 | Немає taxonomy тегів | Є categories, `tools_mentioned`, concepts і «Hot topics», але Hot topics — navigation links, не filter facets; поняття category/topic/tool/entity змішані | Зафіксована taxonomy і facet rules: Category, Topic/Entity, Tool, Source, Date; зрозумілі назви для читача |
| G07 | P1 | Мобільні controls надто пізно з’являються | На 390×844 перший екран і наступний контент зайняті intro + Recent highlights; sort/filter стоять лише перед feed. Drawer обрізає category labels | Compact discovery toolbar до довгого summary; повні labels; filter count; clear; staged або instant semantics без суперечності |
| G08 | P1 | `Apply` не відповідає поведінці | У drawer checkbox змінює feed одразу, а `Apply` лише закриває overlay | Обрати один contract: staged draft + Apply/Cancel або instant apply + Done; задокументувати |
| G09 | P1 | Foundations неповні | After Hours tokens мають палітру, частковий spacing, один radius, 2 breakpoints і motion; немає повних type roles, elevation, border, control-size, icon, z-index, opacity й component tokens | Три рівні tokens: primitive → semantic → component, з Day/Night і usage rules |
| G10 | P1 | Дві паралельні палітри без migration map | Production `globals.css` використовує `#0f0f0f/#f0c040`; After Hours — `#171918/#d4b483`. Немає versioned mapping | Token migration table, deprecation policy й одна production source of truth |
| G11 | P1 | Компонентний каталог занадто вузький | У `src/components/ui/` лише `OverlayDrawer` і `Skeleton`; у concept contract лише 10 великих компонентів. Базові Select, Checkbox, Radio, Chip, Field, Menu, Pagination тощо не мають спільної API/state документації | Повний inventory primitives/composites/editorial patterns, variants і state matrix |
| G12 | P1 | Немає керування версіями дизайн-системи | `tokens.json` прямо позначений як custom JSON, не native Figma export; немає changelog, ownership, migration notes або deprecation rules | Versioned token/component package або чітка repo-convention з changelog і owner |
| G13 | P1 | Станова матриця неповна | `#/states` показує loading/error/empty/form validation, але не покриває всі controls, combined filters, partial data, stale data, offline, storage unavailable, copied, pagination boundary | State matrix на кожен component/pattern та executable examples |
| G14 | P1 | Functional QA перевіряє layout більше, ніж semantics | E2E покриває drawer, scroll, breakpoint і visibility; немає тестів reload/back/forward, combined filters, truthful sort, page bounds і result consistency | Interaction E2E suite, прив’язаний до functional contract |
| G15 | P2 | Візуальні значення живуть поза tokens | У `src/` є багато hardcoded hex/px; After Hours `style.css` теж містить локальні значення й patch overrides | Lint/report на raw values; дозволені винятки для category data/illustrations; решта — tokens |
| G16 | P2 | Немає єдиного dropdown/menu contract | Header categories, share menu, search preview, native sort select і mobile menu мають різні механіки | Спільні Menu/Popover/Combobox/Select contracts: placement, collision, keyboard, focus, dismissal |
| G17 | P2 | Editorial components не нормалізовані | StoryCard, DigestCard, SourceList, trust labels, callouts і related blocks повторюють локальні styles | Виділити editorial component family з контрольованими variants |
| G18 | P2 | Overinvestment у motion відносно core controls | Дев’ять motion gestures і окремий atlas вже описані детальніше, ніж filtering/pagination semantics | Заморозити нові motion-варіанти до проходження News vertical-slice gate |
| G19 | P2 | Немає usability evidence для головних задач | Концепт пропонує сценарії, але не має task-success даних | 5 moderated sessions + measurable tasks до широкого rollout |
| G20 | P3 | Немає зручної живої документації для dev/design review | Є system/states pages у прототипі, але немає component-level playground, props table і visual regression baseline | Storybook або еквівалентний внутрішній catalog без публічного production route |

(source: browser live review 2026-09-26; `artifacts/after-hours/app.js`; `artifacts/after-hours/tokens.json`; `src/lib/news-filters.ts`; `src/components/news/news-feed.tsx`; `src/lib/news.ts`; `src/components/ui/`; `e2e/news-filters-drawer.spec.ts`; `e2e/news-sidebar.spec.ts`; design analysis)

## 4. Цільовий контракт News discovery

Це перший vertical slice, на якому слід довести дизайн-систему. Якщо він не працює end-to-end, переносити нову палітру на всі 26 макетів зарано. (source: design recommendation)

### 4.1 Jobs to be done

1. **Огляд:** побачити найновіші важливі матеріали без налаштувань.
2. **Звуження:** знайти матеріали за category + topic/tool + period.
3. **Пошук:** знайти конкретний продукт, протокол, компанію або source.
4. **Порівняння:** змінити порядок видачі за чесною ознакою.
5. **Продовження:** перейти далі у великому архіві й повернутися в той самий стан.
6. **Поширення:** скопіювати URL відфільтрованої/пошукової видачі.

### 4.2 Інформаційна модель фільтрів

| Facet | Роль | Selection | Правило |
|---|---|---|---|
| Category | Стабільна редакційна рубрика | Multi-select OR | Завжди видима; count враховує інші facets |
| Topic / Entity | MCP, Claude Code, OpenAI тощо | Multi-select OR | Називати «Topics», а не змішувати з categories |
| Tool | Конкретний інструмент із `tools_mentioned` | Multi-select OR | Показувати лише якщо є нормалізований slug/name |
| Source | Первинне джерело / видання | Single або multi-select | P2, коли список не створює шуму |
| Period | Today / 7 days / 30 days / All | Single-select | Межі рахуються в одній зафіксованій timezone |
| Query | Full-text | String | Relevance доступний лише при непорожньому query |

Всередині одного facet значення працюють як OR; між різними facets — AND. Selected state завжди відображається active chips над results. Clear one і Clear all доступні з клавіатури. (source: design recommendation; існуюча facet-логіка `src/components/news/news-feed.tsx`)

### 4.3 Сортування

- **Newest** — default без query.
- **Oldest** — архівний сценарій.
- **Relevance** — показувати тільки при query; використовувати реальний full-text score.
- **Most engaged** — додавати лише після визначення формули та time window на основі `item_metrics`; не називати його «Most discussed» без comments/discussion data.

Кожна опція має одну backend/client semantics. Внутрішній `rank` окремого daily не є глобальною relevance або discussion metric. (source: `src/lib/news-filters.ts`; `supabase/migrations/014_search_facets_and_sort.sql`; `supabase/migrations/035_item_events.sql`; design recommendation)

### 4.4 Pagination і URL

Мінімальний user-visible state:

```text
?q=mcp&categories=agents-and-mcp&topics=claude-code&period=30d&sort=relevance&page=2
```

Правила:

- reload, Back/Forward і copied URL відновлюють ту саму видачу;
- change filter/sort скидає page до 1;
- невідома або завелика page нормалізується, а не лишає порожній екран;
- pagination controls — справжні links для станів, які мають URL;
- data layer не обмежує «весь архів» першими 80/100 items;
- реалізація зберігає cache contract `/news`: client URL-state для вже отриманого slice або окремий cached/read API з keyset cursor; runtime `searchParams` не повинен випадково зробити hub dynamic.

Остаточний технічний варіант слід зафіксувати коротким ADR до кодування. (source: `src/app/[lang]/news/page.tsx`; `src/components/news/news-feed.tsx`; `.cursor/rules/00-core.mdc`; browser live review 2026-09-26)

### 4.5 Responsive contract

- Discovery toolbar стоїть одразу перед feed і лишається зрозумілим після intro; на mobile користувач не має прокручувати великий editorial summary, щоб дізнатись про filters.
- Desktop: компактний toolbar + видимі selected chips; persistent sidebar — лише якщо він не ховає controls у внутрішньому scroll.
- Mobile/tablet: Sort + Filters поруч; button показує active count; drawer не обрізає назви.
- Якщо filter зміни staged — `Apply (N results)` + `Cancel`; якщо instant — `Done`, без неправдивого Apply.
- Sticky bottom action не перекриває останній control і safe-area.

(source: owner screenshot 2026-09-26; browser live review 390×844; design recommendation)

## 5. Цільова архітектура дизайн-системи

```text
Foundations
├─ primitive tokens
├─ semantic tokens (Day / Night)
└─ component tokens
   ├─ primitives
   ├─ composites
   ├─ editorial patterns
   └─ page templates
```

### 5.1 Foundations

| Набір | Мінімальне покриття |
|---|---|
| Color | primitive scales; bg/surface/raised/overlay; text primary/secondary/disabled; action; focus; border interactive/decorative; success/warning/error/info; category colors |
| Typography | family, weight, size, line-height, tracking; roles `display`, `h1–h6`, body, small, label, meta, mono; EN/UK fallback rules |
| Spacing | 4/8-based scale + semantic aliases для page/section/control/card |
| Sizing | control heights sm/md/lg, icon sizes, target minimum, container/read widths |
| Border/radius | widths, interactive/decorative roles, radii none/sm/md/card/pill |
| Elevation | card, sticky, dropdown, dialog, toast; Day/Night values |
| Motion | duration/easing + reduced-motion mapping; Tension gestures only as higher-level aliases |
| Layout | breakpoints, container widths, gutters, grid gaps, safe-area |
| Layering | z-index for base/sticky/dropdown/overlay/dialog/toast |
| State | hover, active, selected, focus, disabled, loading, invalid, read-only |

After Hours palette лишається кандидатом на semantic layer. Recorded text pairs проходять AA, але token catalog має також фіксувати interactive boundary, icon, selected і disabled pairs у двох темах. (source: `artifacts/after-hours/artifact-audit.json`; `artifacts/after-hours/tokens.css`; design recommendation)

### 5.2 Компонентний inventory

**Primitives:** `ActionButton`, `IconButton`, `LinkAction`, `TextInput`, `SearchInput`, `Select`, `Checkbox`, `Radio`, `Switch`, `Field`, `Label`, `Hint`, `ErrorText`, `Chip`, `Tag`, `Badge`, `Icon`, `Divider`, `Spinner`, `Skeleton`.

**Composites:** `Combobox`, `DropdownMenu`, `Popover`, `Tooltip`, `Tabs`, `Pagination`, `Accordion/Disclosure`, `Dialog`, `Drawer`, `Toast`, `ActiveFilterBar`, `FacetGroup`, `FilterPanel`, `SortControl`, `EmptyState`, `ErrorState`, `NewsletterForm`.

**Editorial patterns:** `StoryCard`, `StoryRow`, `DigestCard`, `CategoryBadge`, `Byline`, `TrustLabel`, `SourceList`, `Callout`, `ReadingLayout`, `TableOfContents`, `RelatedContent`, `EditorialHero`, `NoImageFallback`.

**Templates:** `ArchiveLayout`, `ReadingTemplate`, `HubTemplate`, `ToolWorkspaceTemplate`, `TrustPageTemplate`.

Для кожного: anatomy, props, variants, content limits, state matrix, keyboard contract, ARIA, responsive rules, tokens, EN/UK examples, test IDs лише там, де вони справді потрібні. (source: design recommendation)

### 5.3 State matrix

Не достатньо показати окрему сторінку `#/states`. Кожен interactive component повинен мати хоча б:

`default → hover → active → focus-visible → selected/expanded → disabled → loading → error/success`,

а data patterns — `loading → partial/stale → ready → empty → recoverable error → terminal error`. Для overlay окремо: open/close, outside click, Escape, scroll lock, focus trap, focus return. (source: `artifacts/after-hours/screens/states-desktop.png`; `src/components/ui/overlay-drawer.tsx`; design recommendation)

## 6. План робіт

### Milestone 0 — узгодити контракт, до будь-якого redesign rollout

1. Зафіксувати jobs-to-be-done і taxonomy News.
2. Вирішити sort semantics; одразу прибрати `Most discussed`, якщо немає discussion data.
3. Обрати pagination/URL/cache architecture та записати ADR.
4. Обрати staged або instant mobile filters.
5. Перемаркувати After Hours як visual concept + incomplete functional system.

**Gate:** один підписаний News interaction spec, однакова мова в concept, wiki і backlog. (source: design recommendation)

### Milestone 1 — foundations і governance

1. Створити token inventory current production ↔ After Hours.
2. Побудувати primitive/semantic/component layers у Tailwind v4 `@theme` + CSS variables.
3. Визначити version, changelog, owner, deprecation і migration rules.
4. Додати автоматичний contrast report для text, boundaries, focus, icons у Day/Night.
5. Запровадити report на raw color/size values; не auto-fix.

**Gate:** tokens мають ім’я, роль, тему, usage і code mapping; немає паралельних «майже однакових» джерел істини. (source: design recommendation; `.cursor/rules/00-core.mdc`)

### Milestone 2 — core component library

1. Реалізувати controls, field family, overlay/menu family і feedback states.
2. Нормалізувати розміри, focus, disabled, pending, selected і icon placement.
3. Зробити живий внутрішній catalog: Storybook лише після окремого обговорення нової dependency; прийнятна альтернатива — repo-local static catalog + Playwright snapshots.
4. Додати component tests і keyboard/a11y tests.

**Gate:** News vertical slice збирається без одноразових control styles. (source: design recommendation)

### Milestone 3 — News vertical slice

1. Перенести After Hours visual language на header + News, не на весь сайт.
2. Реалізувати Search/Facet/Sort/Active chips/Pagination за §4.
3. Додати mobile drawer contract, complete labels, result preview/count і clear.
4. Додати loading, no results, error, stale/partial data та zero-count facet behavior.
5. Зв’язати `Most engaged` лише з реальною metric formula або відкласти.

**Gate:** усі acceptance tasks проходять на real data EN/UK, Day/Night і 360/390/768/1024/1440. (source: design recommendation)

### Milestone 4 — editorial patterns і решта templates

1. Винести Story/Digest/Byline/Source/Reading/Trust patterns.
2. Перенести Home, article, Daily/Weekly, Concepts/Guides, Toolbox, trust pages хвилями.
3. На кожній хвилі видаляти legacy styles лише після parity review.
4. Підключити Tension v2 після того, як component states стабільні.

**Gate:** сторінки складаються з documented patterns, а не копій Tailwind/CSS recipes. (source: design recommendation)

### Milestone 5 — validation і staged rollout

1. Interaction E2E: combined filters, sort truth, page bounds, reload, Back/Forward, copied URL, empty/error, focus return.
2. Visual regression: обидві теми, EN/UK, довгі labels/headlines, image/no-image, 200% zoom, reduced motion.
3. Accessibility: keyboard, screen reader smoke, non-text contrast, touch target, live regions.
4. Performance: production-like preview; не заявляти CWV до вимірювання.
5. Usability: 5 сесій на задачах нижче; виправити blockers до rollout.

**Gate:** staged release, порівняння з baseline, rollback path. (source: design recommendation; `.cursor/rules/00-core.mdc`)

## 7. Acceptance tasks

Учасник без підказки має:

1. за ≤10 секунд показати, де filter і sort;
2. знайти матеріали Agents & MCP за останні 7 днів;
3. додати topic/tool і зрозуміти, як поєднались filters;
4. скинути один filter і потім Clear all;
5. перейти на page 2, відкрити story, повернутись у той самий state;
6. reload і copied URL мають показати той самий result set;
7. пояснити різницю Newest, Relevance і Most engaged;
8. виконати те саме keyboard-only на mobile drawer.

Decision criteria до тесту: ≥80% task completion без moderator rescue; 0 випадків, коли користувач вважає Hot topics активними filters, якщо вони є лише navigation; 0 втрат state після Back/Forward/reload. Це discovery targets, а не вже виміряні показники. (source: product-discovery recommendation)

## 8. Що не робити наступним

- Не переносити одразу всю палітру на 26 routes.
- Не додавати нові motion gestures до закриття Milestone 3.
- Не лишати controls, які виглядають робочими, але мають demo/fake semantics.
- Не називати rank «relevance» або «discussion» без відповідної metric.
- Не створювати ще один token file без migration map і owner.
- Не ховати основний discovery control лише в sidebar або нижче довгого summary.
- Не будувати всі можливі компоненти наперед: library росте з News vertical slice, потім editorial templates.

(source: design recommendation)

## 9. Definition of done для дизайн-системи v1

- Є одна versioned source of truth для tokens і themes.
- Є documented inventory компонентів, variants і states.
- News contract однаковий у design artifact, React і E2E.
- Filter/sort/pagination чесні, shareable і restorable.
- Category, Topic/Entity і Tool не змішані термінологічно.
- Day/Night, EN/UK, keyboard, 200% zoom і reduced-motion проходять acceptance suite.
- Visual regression і interaction regression входять до PR gate для змінених public surfaces.
- Legacy palette/styles мають план видалення, а не живуть паралельно безстроково.
- Usability blockers закриті на News vertical slice до rollout інших templates.

(source: design recommendation)

## Related pages

- [After Hours redesign](../product/after-hours-redesign.md)
- [After Hours Tension v2](../product/after-hours-tension.md)
- [Prototype to production](../architecture/prototype-to-production.md)
- [Responsive audit](../product/responsive-crossbrowser-audit.md)
- [Overview](../overview.md)
