# After Hours — концепт редизайну AI Today Brief

Summary: візуальна дизайн-концепція видання: брендинг, адаптивні макети, UI/UX, рух, маршрути та план впровадження. Статус 2026-09-28: прототип v3 пройшов браузерний QA (доступність, SEO-контракт, крос-браузерність, збільшений текст); production-впровадження дизайн-системи досі проходить gates з аудиту розривів.
Sources: запит власника 2026-09-05, уточнення про повноцінні різноманітні статті 2026-09-26 і запит на доопрацювання прототипів 2026-09-28; browser live review 2026-09-05 — https://aitodaybrief.com/en, /en/concepts, /en/guides, /en/tools, /en/about; browser review production article і локального прототипу 2026-09-26; `src/app/[lang]/page.tsx`, `src/app/[lang]/digests/page.tsx`, `src/app/[lang]/news/page.tsx`, `src/components/story-body.tsx`, `src/lib/design-system/tokens.ts`; `artifacts/after-hours/` (зокрема `qa/*.json`); none (design proposals).
Last updated: 2026-09-29

---

## 1. Рішення

> **Статус 2026-09-26:** після аудиту concept↔production After Hours більше не вважається повністю готовою до реалізації дизайн-системою. Візуальний напрям зберігається; P0/P1 розриви у filtering, sort semantics, pagination/URL-state, taxonomy, tokens і component governance зафіксовані в [аудиті повноти дизайн-системи](../audits/2026-09-26-design-system-gap-plan.md). (source: owner feedback 2026-09-26; browser live review; design-system audit)

> **Оновлення 2026-09-28 — прототип v3.** Власник попросив довести прототипи до production-рівня: виправити кольорові баги світлої теми, перевірити розміри шрифтів для людей з вадами зору, прибрати баги верстки, перевірити крос-браузерність, мобільні пристрої, accessibility, SEO, schema і performance, надати унікальну структуру макетам 04 Digests, 05 Daily, 06 Weekly, 07 Concepts, 09 Guides, 11 Toolbox, 13 Categories, посилити рух і брендову анімацію та перевірити покриття production-функціоналу. (source: запит власника 2026-09-28)
>
> Результат на рівні прототипу: токени 2.0.0-proposal у трьох шарах (наступний major після `tokens.ts` v1.0.0; міграція — §4), чесне сортування (G03), стан News у URL (G04), фасети з правилом OR/AND (G06), мобільний drawer з «Done (N)» (G08), маршрут `#/coverage` зі співставленням production-функцій і макетів. Браузерний QA: 560 сторінок Chromium і 336 сторінок Firefox/WebKit без порушень axe, переповнення, тексту менше 12 px і малих цілей; збільшений до 200% текст і reflow 320 px — 112 сторінок без втрат. Деталі — [QA](../../artifacts/after-hours/QA.md). (source: `artifacts/after-hours/qa/qa-v3-final-chromium.json`, `qa-v3-final-xbrowser.json`, `zoom-report.json`; `artifacts/after-hours/home.js`, `data.js`)
>
> Production-частину аудиту переносив PR #367 (токени `src/lib/design-system/tokens.ts` v1.0.0, UI-примітиви `src/components/ui/`, discovery `/news` з URL-state, E2E) — див. [now](../now.md) і [design-system-tokens](../architecture/design-system-tokens.md). Прототип v3 — наступна дизайн-ітерація поверх нього. **Оновлення 2026-09-29:** токени 2.0.0 перенесені в `tokens.ts` і `globals.css` ([ADR](../decisions/2026-09-29-design-tokens-2-0-migration.md)), додано Popover/DropdownMenu/Tooltip/Tabs/Accordion/Toast/Combobox; результатів usability-сесій (G19) досі немає — [протокол готовий](../research/2026-09-29-redesign-usability-sessions-protocol.md). Стан блокерів епіку — [epic readiness](after-hours-epic-readiness.md). (source: `git show f920671 --stat`; [аудит](../audits/2026-09-26-design-system-gap-plan.md); analysis)

**After Hours** — назва візуального напрямку. Публічна назва залишається **AI Today Brief**. Тепле темне тло, латунні акценти, кремовий текст, спокійна serif-типографіка та вузькі моноширинні метадані створюють атмосферу камерного американського джазового клубу. Відчуття майбутнього передають точна геометрія, celadon-сигнал і технічна ясність. Це пропозиція за брифом власника, не твердження про поточний бренд. (source: запит власника 2026-09-05; design proposal)

Ключова фраза EN: **Tomorrow, in context.** UK: **Майбутнє. З контекстом.** Преміальність тут означає увагу до читача, редакційний відбір і якість виконання. Концепт не вводить paywall чи членство. Пріоритет brief-led продукту й dev-аудиторії спирається на [overview](../overview.md). (source: design proposal; [overview](../overview.md))

Матеріали для перегляду: [інтерактивний прототип](../../artifacts/after-hours/index.html), [інструкція запуску](../../artifacts/after-hours/README.md), [галерея v3 — 28 маршрутів у двох темах](../../artifacts/after-hours/gallery-v3.html), [QA](../../artifacts/after-hours/QA.md), [CSS tokens](../../artifacts/after-hours/tokens.css), [машинні tokens](../../artifacts/after-hours/tokens.json) (генеруються з CSS), [аудит артефакту](../../artifacts/after-hours/artifact-audit.json). Архів первинного концепту: [маніфест перевірки v1](../../artifacts/after-hours/verification.json). Зміст макетів демонстраційний, а не нові публікації. (source: `artifacts/after-hours/`)

## 2. Що змінюється концептуально

| Спостереження | Дизайн-рішення | Як перевірити користь |
|---|---|---|
| На головній повторюється пошук у header і hero; перед редакційними новинами стоять великий вступ і категорії | Один глобальний пошук. Компактна обіцянка бренду → головна історія + daily | Перший осмислений перехід до історії; 5-секундний тест розуміння сторінки |
| Категорії отримують велику вагу до читання новин | Теми у другому рівні навігації та окремі хаби зі змістом | Чи знаходить читач новину за темою без повернення на головну |
| Архів daily/weekly має однакові картки з датами | Daily — дата й коротка добірка; Weekly — номер випуску, обкладинка, редакційна теза | Чи може користувач пояснити різницю форматів |
| Concepts — довгий перелік понять, продуктів, бібліотек і сервісів | Типові фільтри, алфавітний довідник, входи через запитання | Знайти MCP, зрозуміти визначення, перейти до практики |
| Guides містить два матеріали | Один великий рекомендований гайд + компактна бібліотека; без зайвих фільтрів | Обрати гайд і знайти висновок для власної роботи |
| Toolbox — три власні local-first утиліти | Майстерня з окремими робочими просторами вводу й результату | Заповнити форму, зрозуміти валідацію, скопіювати результат |
| About пояснює роль редактора і використання AI | Виразна редакційна позиція, схема відбору, профіль редактора, джерела й виправлення | Знайти відповідального редактора і політику |

Спостереження підтверджено оглядом наведених у Sources live-сторінок і відповідних route-файлів 2026-09-05; дизайн-рішення та способи перевірки — пропозиції, не виміряний ефект. Історичну слабку конверсію subscription-modal враховано через ненав’язливу inline-форму, але нова конверсія поки невідома. (source: browser live review 2026-09-05; `src/app/[lang]/digests/page.tsx`; [overview](../overview.md) §7; design proposal)

## 3. Інформаційна архітектура й маршрути

У таблиці `lang` — `en` або `uk`. Прототип має власні `#/…` для зручного перегляду. Їх **не переносити** до production: лишити Next App Router, наявні canonical, slug і redirect. Поточні форми маршрутів підтверджено файловою структурою `src/app/[lang]`. (source: `src/app/[lang]/`; design proposal)

| Макет | Production route / шаблон | Контент і порядок блоків |
|---|---|---|
| `home` | `/[lang]` | Brand promise → дата останнього випуску → lead + daily → актуальні теми → 3 новини → weekly → Concepts / Guides / Toolbox → newsletter |
| `news` | `/[lang]/news` | Назва → тематичні фільтри → хронологічні рядки → daily sidebar → пагінація |
| `article` | `/[lang]/news/[category]/[item]` | Спільна trust-оболонка + форматний body: редакційний аналіз, технічний гайд або evidence note → TOC → джерела/виправлення → related |
| `digests` | `/[lang]/digests` | Daily / Weekly / All → актуальні випуски → хронологічний архів |
| `daily` | `/[lang]/[brief]` | Дата й теза → короткий вступ → нумеровані матеріали → одна практична дія → архів/підписка |
| `weekly` | `/[lang]/weekly/[slug]` | Редакційна назва/cover → зміст → спільна теза → розділи → action board → джерела → інші випуски |
| `concepts` | `/[lang]/concepts` | Типові фільтри → алфавітний індекс → входи через практичні запитання |
| `concept` | `/[lang]/concepts/[slug]` | Коротке визначення → схема/пояснення → зв’язки → практика → FAQ → джерела/verification date |
| `guides` | `/[lang]/guides` | Рекомендоване порівняння → компактний перелік наявних гайдів |
| `guide` | `/[lang]/guides/[slug]` | Результат для читача → умови → таблиця/підхід → кроки → докази → changelog |
| `tools` | `/[lang]/tools` | Три утиліти з конкретними результатами й local-first поясненням |
| `tool` | `/[lang]/tools/prompt-optimizer` | Ввід → налаштування → перевірка → структурований результат → copy |
| `settings` | `/[lang]/tools/settings-builder` | Дозволи/hooks → валідація → settings.json → copy/export |
| `instructions` | `/[lang]/tools/claude-md-generator` | Контекст проєкту → правила → AGENTS.md / CLAUDE.md → copy/export |
| `categories` | Необов’язковий новий індекс; можна меню без нового URL | Повний перелік категорій із короткими описами; без вигаданих кількостей |
| `category` | `/[lang]/category/[slug]` | Опис теми → базові концепти → останні новини → релевантний гайд |
| `about` | `/[lang]/about` | Маніфест → редакційний процес → реальний редактор → контакти/політики |
| `author` | `/[lang]/author` | Профіль редактора (ProfilePage): роль і профілі в соцмережах → фокус висвітлення → стандарти → останні матеріали |
| `subscribe` | `/[lang]/subscribe` | Цінність → приклад випуску → email/мова/згода → підтвердження → керування підпискою |
| `search` | `/[lang]/news/search?q=…` | Єдине поле → результати з типами → empty/retry; пошук Concepts — окреме розширення даних |
| `saved` | Новий локальний drawer або `/[lang]/saved` з noindex | Порожній стан → локальний список → видалити запис; без облікових записів |
| `advertise` | `/[lang]/advertise` | Формати розміщення → перевірені audience facts → наявний канал запиту |
| `policy` | `/[lang]/editorial-policy`, `/ai-disclosure`, `/privacy`, `/terms` | Спільна читабельна оболонка, локалізований зміст, незмінені юридичні тексти |
| `404` | Наявний not-found | Коротке пояснення → головна/пошук; без тупика |
| `system`, `states`, `coverage`, `motion` | Тільки артефакт, не публічні routes | Палітра, бренд, типографіка, крайові стани, матриця покриття production, атлас руху |

### Система повноцінних статей

`#/article` має три окремі shareable стани, а не одну коротку заглушку: `?variant=analysis`, `?variant=technical`, `?variant=evidence`. Спільними лишаються breadcrumb, format switcher, headline/dek, byline, trust labels, sticky TOC, reading column, save/copy, related і newsletter. Вміст та ритм body змінюються відповідно до редакційної задачі. (source: уточнення власника 2026-09-26; `artifacts/after-hours/app.js`; design proposal)

| Формат | Повноцінні модулі прикладу | Редакційна задача |
|---|---|---|
| Editorial analysis | why it matters, hero/caption, takeaways, довга теза, цитата, 3-шарова модель, decision table, editor’s take, uncertainty, source ledger | Пояснити значення новини, її наслідки та межі впевненості |
| Technical field guide | practical answer, cache-flow схема, request anatomy, code sample, метрики, вимірювальна таблиця, use/wait, rollout, editor’s take, source ledger | Дати інженеру відтворюваний спосіб перевірити й упровадити підхід |
| Evidence note | claim, evidence frame, takeaways, claim/evidence/risk ledger, benchmark table, methodology note, transfer test, decision framework, paired quotes, source ledger | Відділити результат дослідження від ширших висновків і production-рішення |

Усі числа й твердження прикладів позначені як illustrative concept copy. У production вони мають походити з реального story payload і первинних джерел; URL-варіанти концепту не заміняють production slug або тип контенту. Інші detail-макети показують репрезентативний контент свого типу й можуть обслуговувати кілька карток. (source: `artifacts/after-hours/app.js`; `src/components/story-body.tsx`; design proposal)

## 4. Брендинг і візуальні правила

Усі значення цього розділу — запропоновані дизайн-специфікації. Авторитет для точних значень — [tokens.css](../../artifacts/after-hours/tokens.css) та [style.css](../../artifacts/after-hours/style.css). (source: design proposal; `artifacts/after-hours/`)

### Палітра

**2.0.0-proposal (прототип v3, 2026-09-28).** Токени мають три шари: primitives (`ink-*`, `paper-*`, `brass-*`, `celadon-*`, `claret-*`, `velvet-*`) → semantic roles для Night і Day → component tokens. Компоненти споживають лише semantic-ролі; кожна роль перевизначена в Day, тож світла тема більше не «успадковує» нічні значення. (source: `artifacts/after-hours/tokens.css`; `tokens.json`)

| Роль | Night 2.0 | Day 2.0 | Було в `tokens.ts` v1.0.0 (Night / Day) | Правило |
|---|---|---|---|---|
| bg | `#171918` | `#EFE8DA` | `#171918` / `#F0E9DC` | Тепла основа |
| surface | `#1F2321` | `#F7F2E8` | `#202421` / `#E7DFD0` | Картки й врізки; у Day світліші за тло («папір на столі») |
| raised | `#282D29` | `#FDFAF4` | `#2B302C` / `#DDD4C4` | Поповери, меню, підняті панелі |
| text | `#F0E9DC` | `#1D211D` | `#F0E9DC` / `#232820` | Основне читання |
| muted | `#B9B7AC` | `#4D5148` | `#B9B7AC` / `#606358` | Метадані, пояснення |
| faint | `#A3A197` | `#5A5E54` | `#78766C` / `#84877B` | Третинний текст; у v1.0.0 не проходив AA (3,88:1 / 3,03:1), у 2.0 — 6,82:1 / 5,44:1 |
| accent (brass) | `#D4B483` | `#72562E` | те саме | Один основний CTA на блок |
| signal (celadon) | `#B5D8CC` | `#2D6559` | `mint`, те саме | Focus, позитивний стан, «живий» сигнал |
| claret / velvet | `#E3919D` / `#431A24` | `#8E2A3F` / `#F3E1DC` | — (нове) | Третій акцент: тижневик, «бриф за 30 секунд», live-мітки |
| line / line-strong | `#3B413C` / `#737A73` | `#D6CEBF` / `#8C8577` | `line` `#414640` / `#B4B0A3` | `line` — декоративні роздільники; `line-strong` — межі полів і контролів (≥ 3:1: 4,00 / 3,00) |
| error | `#FF9B8A` | `#B3261E` | `#EFAAA0` / `#A13328` | Текст помилки + пояснення; не лише колір |

Категорії мають окремі значення для кожної теми (Night — світлі jewel tones, Day — глибокі, ≥ 4,5:1 на surface і bg) і незмінні «арт-кольори» для банерів на темній сцені; неонові значення v1 прибрано. Контраст-гейт `qa/check-tokens.mjs` перевіряє 160 пар текст/UI в обох темах — 0 провалів (найнижчий текст категорії: Night 6,41:1, Day 5,22:1). (source: `artifacts/after-hours/tokens.css`; `qa/token-contrast.json` 2026-09-28; розрахунок контрасту v1 з `src/lib/design-system/tokens.ts`)

Міграція в `tokens.ts`, `globals.css` і `scripts/check-design-tokens.ts` виконана 2026-09-29 (G10 з [аудиту](../audits/2026-09-26-design-system-gap-plan.md); [ADR](../decisions/2026-09-29-design-tokens-2-0-migration.md)); до неї `tokens.ts` був v1.0.0, а таблиця вище була відправною точкою. Значення production можуть відрізнятися від прототипу лише там, де це зафіксовано в ADR (`--surface-2`, `--border-soft`). Застарілі назви v2 (`paper`, `ink`, `brass`, `mint`) лишаються аліасами. (source: `src/lib/design-system/tokens.ts`; `tokens.json` — `deprecated`)

Орієнтир пропорцій: 75% базової поверхні, 18% тексту/ілюстрацій, 6% латуні, 1% celadon; claret — точково. Це напрям для композиції, не буквальна піксельна квота. Декоративні лінії не використовувати як єдину межу інтерактивного поля. (source: design proposal)

### Типографіка

- **Шкала 2.0 у rem** (поважає розмір шрифту, який читач задав у браузері): 12 · 13 · 14 · 16 · 18 px для мети, підписів, контролів, UI і читання; fluid `clamp()` для заголовків 19–22 (картки), 22–28 (h3), 28–40 (h2), 36–58 (h1), 42–72 px (masthead/обкладинка). **12 px — абсолютний мінімум**: у прототипі до v3 було 4 220 випадків дрібнішого тексту на 208 перевірених сторінках, у v3 — 0 на 560. (source: `artifacts/after-hours/tokens.css`; `qa/qa-baseline.json`, `qa/qa-v3-final-chromium.json`)
- EN display: **Fraunces 400**, окремий italic для акцентів; tracking −0.032em (h1–h2), −0.02em (h3).
- UK display: **Georgia**, локальний системний serif fallback, спокійніший tracking (−0.012em). Fraunces у наявному пакеті не має кириличного subset; не змішувати латиницю й кирилицю різних display-шрифтів в одному українському headline. Для повністю однакових EN/UK бренд-літер окремим рішенням підібрати кириличну гарнітуру до production.
- UI/body: **Inter 400/500/600**, self-hosted Latin + Cyrillic. Читання 18 px, line-height 1.78, міра 68ch; UI 16 px, line-height 1.65.
- Mono: системний стек `ui-monospace` → Cascadia/Consolas. Дата, джерело, номер розділу. Короткі eyebrow — капсом з трекінгом 0.13em; довгі мітки-реєстри (як формат статті «02 / Technical field guide») — у sentence case, щоб лишатися читабельними. Код ніколи не дрібніший за 12 px.
- Брейкпоінти в `em`, текстові міри в `rem`: коли читач збільшує шрифт браузера, макет переходить у компактну форму замість переповнення (перевірка: шрифт 32 px на 1280 px і reflow на 320 px — 112 сторінок без втрат). (source: `artifacts/after-hours/style.css`, `pages.css`; `qa/zoom-report.json`)
- H1 один на сторінку. Довгі headline не обрізати; card summary можна обмежити, але повна назва доступна.

Пакети шрифтів підтверджено `node_modules/@fontsource-variable/`; файли та ліцензії скопійовано в `artifacts/after-hours/assets/`. Решта — дизайн-рішення. (source: `node_modules/@fontsource-variable/`; design proposal)

### Знак та ілюстрації

Новий SVG-знак складається з вкладених A-ліній і зміщеної celadon-крапки. Clear space ≥ половини висоти знака; мінімальний розмір 24 px, favicon-версія — без дрібного wordmark. Не розтягувати, не додавати bevel/тінь, не фарбувати кожну категорію окремим яскравим кольором. Wordmark — AI Today Brief; descriptor — The Intelligence Edit. (source: design proposal; [mark.svg](../../artifacts/after-hours/assets/mark.svg))

Брендовий образ — латунна скульптура зі скляним краєм. Він передає атмосферу концепції та підписаний як concept art. Для production новин використовувати контекстні зображення, першоджерела або чесний типографічний fallback. Не робити одну абстрактну скульптуру обкладинкою всіх новин. Не накладати обов’язковий brass-фільтр на графіки, UI screenshots і логотипи джерел. (source: design proposal; [card-images](../marketing/card-images.md))

## 5. Сітка й адаптивність

| Параметр | Desktop ≥1101 | Tablet 761–1100 | Mobile ≤760 |
|---|---|---|---|
| Container | 1280 px max із внутрішніми відступами | fluid, 40 px поля | fluid, 20 px; 16 px на ≤370 |
| Основна сітка | 12 колонок, gap 24–32 | 8 колонок | 4 колонки |
| Lead | 2 внутрішні колонки + daily 310 px | вертикальний lead + rail 260 px | headline/dek/CTA → image → daily |
| Новини | текстова стрічка + sidebar 270 px | та сама логіка компактніше | sidebar після стрічки |
| Читання | TOC 170 + body 680 + tools 170 | TOC 140 + body | зміст inline, controls до тексту |
| Cards | 3 або 2 колонки | за контентом | одна колонка |
| Header | wordmark/actions + nav | скорочений descriptor | menu з усіма розділами та підпискою |
| Таблиці | повна ширина body | локальний скрол за потреби | власний scroll-container, не скрол усієї сторінки |

Перевірка мінімум 360, 390, 768, 1024 і 1440 px; довгі UK-назви й 200% text zoom. Автоматичне згортання sidebar не повинно ховати першоджерела. (source: design proposal)

У прототипі v3 межі задані в `em` (px у таблиці — значення за стандартного шрифту 16 px), тож при збільшеному шрифті браузера сторінка переходить до вужчої колонки таблиці. Перенести цей підхід і в production-брейкпоінти Tailwind. (source: `artifacts/after-hours/style.css`, `pages.css`; `qa/zoom-report.json`)

## 6. UI-компоненти та контракт поведінки

| Компонент / props | Варіанти / стани | UX і доступність |
|---|---|---|
| `EditorialHeader(lang, activeRoute, theme)` | desktop / mobile / menu-open | Wordmark → home; menu `aria-expanded`, закриття Escape, focus повертається на trigger |
| `Action(variant, disabled, pending)` | primary / outline / ghost; hover / focus / disabled | CTA ≥44 px, focus 2 px + offset 5; pending не дозволяє повторне надсилання |
| `StoryCard(item, layout)` | lead / row / standard / withoutImage | Власний permalink, category, реальний timestamp; missing-image не ламає сітку |
| `DigestCard(kind, date, cover)` | daily / weekly | Формат явним текстом; якщо немає нового випуску — дата останнього, не слово «сьогодні» |
| `FilterBar(options, selected)` | selected / hover / empty | Семантичні buttons з `aria-pressed`; тільки реальні варіанти, clear filter |
| `SearchDialog(query, results, status)` | idle / loading / results / empty / error | Cmd/Ctrl+K, focus trap, Escape, input label, `aria-live`; після переходу focus на H1/main |
| `Byline(editor, publishedAt, updatedAt)` | published / corrected | Не підміняти publishedAt поточною датою. Окремо дата фактчекінгу |
| `ReadingLayout(toc, content, actions)` | article / concept / guide / weekly | 60–75 символів у рядку; реальні якорі; джерела в самому body |
| `NewsletterForm(lang, status)` | empty / invalid / pending / confirm / subscribed / error | Явна згода; double opt-in за наявним backend; повторна адреса без розкриття чужої підписки |
| `LocalToolShell(input, result, errors)` | draft / invalid / ready / copied / export-error | Вхідні дані локальні; output не editable за замовчуванням; copy лише після валідного результату |
| `SavedList(entries)` | empty / populated / removed / storage-unavailable | Без обов’язкового акаунта; помилка storage пояснена; приватні введення утиліт не зберігати |
| `SourceList(sources, corrections)` | expanded / collapsed | Author, title, date, external URL. Не приховувати джерело тільки в tooltip |

Це цільові component contracts для реалізації. Прототип демонструє основні стани в `#/states`; backend pending/error та всі продукційні інваріанти перевіряються на етапі інтеграції. Наявні React-компоненти перелічені в плані нижче. (source: design proposal; `artifacts/after-hours/app.js`; `src/components/`)

### Ключові сценарії

1. **5 хвилин:** home → daily → повний контекст однієї новини → повернення до daily → кінець добірки. Завжди є відчуття завершення.
2. **20 хвилин:** home → weekly → зміст → окремий розділ → action board → related guide. Відео/PDF з’являються лише за наявності опублікованого asset.
3. **Навчання:** news → concept → guide → toolbox. Кожне посилання пояснює користь переходу.
4. **Практика:** toolbox → власна утиліта → валідація → preview → copy/export. Жодного неочікуваного API-виклику.
5. **Підписка:** прочитати зразок → email/мова/згода → pending → check inbox → confirmed. Помилка мережі лишає введені дані.
6. **Повернення:** article → Save → локальне збережене → той самий permalink. На першому етапі можна відкласти до другої хвилі.

Усе вище — запропоновані сценарії; ефективність потребує usability-перевірки. (source: design proposal)

## 7. Анімації

**Оновлено 2026-09-28:** актуальна мова руху — [Tension v3](after-hours-tension.md): дванадцять жестів, View Transitions між маршрутами і брендова сцена The Resolve (3,4 с) замість Editorial Fold v2. Початкова таблиця нижче збережена як історія базового концепту. Актуальні параметри — `artifacts/after-hours/tokens.json` і `tension.js`. (source: запит власника 2026-09-25 і 2026-09-28)

| Тригер | Що рухається | Duration / easing | Reduced motion |
|---|---|---|---|
| Hover CTA | колір, translateY −1 px | 140 ms / ease | тільки колір або миттєва зміна |
| Hover lead image | scale 1 → 1.025 у clipped контейнері | 800 ms / cubic-bezier(.2,.7,.2,1) | без scale |
| Page entrance | opacity 0→1, Y 8→0 px | 440 ms / той самий easing | без анімації |
| Menu/dialog | opacity, максимум Y 4 px | 240 ms | миттєво |
| Reading progress | вузька 2 px лінія | прямий зв’язок зі scroll | без інерції |
| Loading skeleton | градієнт тільки в loading | 1800 ms | статичний блок |
| Copy/save | текстове підтвердження | toast 2600 ms, live region | те саме без руху |

Не застосовувати scroll hijacking, нескінченний marquee, миготіння, autoplay audio, паралакс тексту, cursor-following spotlight. Рух не затримує доступність основного контенту; у Next production SSR-контент видимий до hydration. (source: design proposal)

## 8. Дані та SEO: що зберегти

- Залишити наявний publishing pipeline, human review, RLS і мови EN/UK. Редизайн не потребує нової бази чи провайдерів. (source: [overview](../overview.md); design proposal)
- Зберегти item URLs під category, daily slug, weekly thematic slug і legacy redirects. (source: `.cursor/rules/00-core.mdc`; `src/app/[lang]/`)
- `/news` зараз навмисно не читає runtime `searchParams`, щоб лишатися кешованим. Не перетворити redesign-фільтром увесь route на dynamic; query-пошук лишити `/news/search`. Client URL-state дозволений для фільтрування вже отриманих даних, додаткові сторінки отримувати контрольовано. (source: `src/app/[lang]/news/page.tsx`)
- `canonical`, hreflang, OG, RSS, sitemap, JSON-LD, byline і timestamps переносити без регресій. SEO-контент лишається server-rendered. (source: `.cursor/rules/00-core.mdc`; `src/app/[lang]/page.tsx`)
- У концепт-артефакті noindex, mock news, session-only save і локальний template-transform; це не джерело production-контенту. (source: `artifacts/after-hours/index.html`; `artifacts/after-hours/app.js`)
- За відсутності cover — типографічна обкладинка з датою/назвою. За відсутності lead — останній реальний daily або news-list. За нульової кількості матеріалів — пояснення й доречний alternate route; не вигадувати цифри. (source: design proposal)

## 9. План реалізації

> **Оновлення 2026-09-29:** виконувана декомпозиція перенесення в production — епік
> [after-hours-redesign-epic](after-hours-redesign-epic.md): 56 задач у 8 фазах із гейтами,
> acceptance criteria, рішеннями D1–D13 і вихідною точкою за станом коду 2026-09-29. Хвилі A–C
> нижче лишаються початковою оцінкою 2026-09-05; порядок робіт тепер задає епік. (source:
> [after-hours-redesign-epic](after-hours-redesign-epic.md))

Оцінки нижче — планувальні припущення для одного розробника з готовими даними, без переписування backend: **12–18 робочих днів**. Це не підтверджений графік. Релізні хвилі дозволяють показати головне раніше. (source: design estimate 2026-09-05)

### Хвиля A — основа й читання, 5–7 днів

1. **Tokens/fonts/brand**, 1–2 дні. Перенести semantic tokens в `src/app/globals.css` через Tailwind v4 `@theme`. Підключити self-hosted шрифти у root layout, `next/font/local` за актуальною локальною документацією. Новий знак, favicon, OG-шаблон; лишити назву видання. Перевірити EN/UK та Day/Night.
2. **Header/footer/search**, 1 день. `site-header.tsx`, `site-header-chrome.tsx`, `site-footer.tsx`, `header-search-field.tsx`, `search-preview-dropdown.tsx`. Один пошук, mobile disclosure, keyboard/focus, inline CTA.
3. **Home/news/article**, 3–4 дні. `home/home-hero.tsx`, `home/top-of-week.tsx`, `home/weekly-digest.tsx`, `news/news-feed.tsx`, `news/news-sidebar.tsx`, `post-card.tsx`, `story-body.tsx`, `byline.tsx`, `item-share-bar.tsx`. Переставити реальні дані й зберегти маршрути. Підготувати image aspect ratios і no-image fallback.

### Хвиля B — випуски й знання, 4–6 днів

4. **Daily/Weekly/archive**, 2–3 дні. `daily/daily-hero.tsx`, `brief-daily-sections.tsx`, `weekly/weekly-hero.tsx`, `weekly/weekly-toc.tsx`, `weekly/weekly-story.tsx`, `weekly/weekly-action-board.tsx`, `/digests/page.tsx`. Різні формати, реальна пагінація архіву, conditional video/PDF.
5. **Concepts/Guides/categories**, 2–3 дні. `concepts-grid.tsx`, `concept-header.tsx`, `concept-hub-body.tsx`, `category-header.tsx`, route-шаблони Guides. Повний інвентар тем з існуючих даних; у прототипі показана репрезентативна підмножина. Не запускати новий category-index URL, якщо достатньо меню.

### Хвиля C — утиліти, довіра й запуск, 3–5 днів

6. **Toolbox**, 1–2 дні. Новий `LocalToolShell`, окремі workspace-макети, наявні engines/validation/export з `src/components/tools/`. Прототипний template-transform не замінює алгоритм.
7. **Subscribe/About/trust/404**, 1 день. `newsletter-form.tsx`, `newsletter-band.tsx`, `trust-page-shell.tsx`, `legal-doc.tsx`, `not-found-*`. Підключити існуючий subscribe backend, зберегти policy text і контакти.
8. **QA + staged rollout**, 1–2 дні. Нижче — критерії приймання. Збережене та глобальний пошук evergreen-матеріалів можна винести в наступну ітерацію, не затримуючи основний redesign.

Назви файлів підтверджено інвентаризацією репозиторію 2026-09-05; послідовність і тривалість — пропозиції. Повний SSG локально без потреби не запускати через відомі egress-обмеження. (source: `src/components/`; [now](../now.md); design proposal)

### Критерії приймання production

- Усі публічні шаблони з route-таблиці реалізовані; типові й довгі EN/UK headline перевірені.
- Жодного page-level horizontal overflow на 360/390/768/1024/1440; таблиці скроляться локально.
- Keyboard-only: skip link, header, пошук, mobile menu, TOC, форми, copy/export; Escape закриває overlay, focus повертається.
- WCAG AA для тексту й інтерактивних меж; action targets ≥44×44 px. `prefers-reduced-motion` і 200% text zoom.
- Subscribe: invalid, pending, double submit, success, already-subscribed, backend/network error; ніякого неправдивого success.
- Toolbox: валідний і невалідний ввід, escape output, copy failure, export; нуль сторонніх запитів із приватним input.
- Real dates, no cover, empty archive, long source title, missing translation, no video/PDF, corrections, saved storage failure.
- SEO diff: canonical/hreflang/JSON-LD/redirect/RSS/sitemap; реальний HTML без JS; `/news` cache behavior збережений.
- Цілі проєкту: LCP ≤2.0 s, INP ≤200 ms, CLS ≤0.05. Перевірити на production-like preview, не заявляти їх до вимірювання.
- Перед push: `npm run pr:check` за чинним contract; update watched wiki pages/index/log. Feature branch + PR, не push до main.

Критерії — запропоновані acceptance gates з обов’язковими чинними інваріантами з `.cursor/rules/00-core.mdc`, `pr-gate.mdc` і [now](../now.md). Дизайн-прототип сам по собі не доводить production CWV, backend або SEO. (source: design proposal; `.cursor/rules/00-core.mdc`; `.cursor/rules/pr-gate.mdc`)

### Оцінка після запуску

Зняти baseline до релізу, потім порівняти однакові періоди та джерела трафіку: lead→article, home→daily, weekly completion, concept→guide→tool, confirmed subscriptions, повернення за 7 днів. На малій аудиторії спершу 5 якісних usability-сесій; не обіцяти статистично значущий A/B-тест без потрібної вибірки. Аналітика — лише чинний consent-gated механізм. (source: design proposal; [overview](../overview.md))

## Related pages

- [after-hours-epic-readiness](after-hours-epic-readiness.md) — статус блокерів епіку.
- [after-hours-redesign-epic](after-hours-redesign-epic.md) — епік реалізації: фази, сабтаски, acceptance criteria
- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md) — аудит розривів і порядок допрацювання
- [overview](../overview.md)
- [now](../now.md)
- [card-images](../marketing/card-images.md)
- [weekly-digest](../pipeline/weekly-digest.md)
