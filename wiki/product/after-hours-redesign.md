# After Hours — концепт редизайну AI Today Brief

Summary: візуальна дизайн-концепція видання: брендинг, адаптивні макети, UI/UX, рух, маршрути та план впровадження. Статус: visual direction і page concepts готові до подальшого проєктування, але функціональна дизайн-система та discovery-contract ще не завершені.
Sources: запит власника 2026-09-05 і уточнення про повноцінні різноманітні статті 2026-09-26; browser live review 2026-09-05 — https://aitodaybrief.com/en, /en/concepts, /en/guides, /en/tools, /en/about; browser review production article і локального прототипу 2026-09-26; `src/app/[lang]/page.tsx`, `src/app/[lang]/digests/page.tsx`, `src/app/[lang]/news/page.tsx`, `src/components/story-body.tsx`; `artifacts/after-hours/`; none (design proposals).
Last updated: 2026-09-26

---

## 1. Рішення

> **Статус 2026-09-26:** після аудиту concept↔production After Hours більше не вважається повністю готовою до реалізації дизайн-системою. Візуальний напрям зберігається; P0/P1 розриви у filtering, sort semantics, pagination/URL-state, taxonomy, tokens і component governance зафіксовані в [аудиті повноти дизайн-системи](../audits/2026-09-26-design-system-gap-plan.md). (source: owner feedback 2026-09-26; browser live review; design-system audit)

**After Hours** — назва візуального напрямку. Публічна назва залишається **AI Today Brief**. Тепле темне тло, латунні акценти, кремовий текст, спокійна serif-типографіка та вузькі моноширинні метадані створюють атмосферу камерного американського джазового клубу. Відчуття майбутнього передають точна геометрія, celadon-сигнал і технічна ясність. Це пропозиція за брифом власника, не твердження про поточний бренд. (source: запит власника 2026-09-05; design proposal)

Ключова фраза EN: **Tomorrow, in context.** UK: **Майбутнє. З контекстом.** Преміальність тут означає увагу до читача, редакційний відбір і якість виконання. Концепт не вводить paywall чи членство. Пріоритет brief-led продукту й dev-аудиторії спирається на [overview](../overview.md). (source: design proposal; [overview](../overview.md))

Матеріали для перегляду: [інтерактивний прототип](../../artifacts/after-hours/index.html), [інструкція запуску](../../artifacts/after-hours/README.md), [CSS tokens](../../artifacts/after-hours/tokens.css), [машинні tokens](../../artifacts/after-hours/tokens.json), [маніфест перевірки](../../artifacts/after-hours/verification.json). Зміст макетів демонстраційний, а не нові публікації. (source: `artifacts/after-hours/`)

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
| `about` | `/[lang]/about`, спільний профіль для `/author` | Маніфест → редакційний процес → реальний редактор → контакти/політики |
| `subscribe` | `/[lang]/subscribe` | Цінність → приклад випуску → email/мова/згода → підтвердження → керування підпискою |
| `search` | `/[lang]/news/search?q=…` | Єдине поле → результати з типами → empty/retry; пошук Concepts — окреме розширення даних |
| `saved` | Новий локальний drawer або `/[lang]/saved` з noindex | Порожній стан → локальний список → видалити запис; без облікових записів |
| `advertise` | `/[lang]/advertise` | Формати розміщення → перевірені audience facts → наявний канал запиту |
| `policy` | `/[lang]/editorial-policy`, `/ai-disclosure`, `/privacy`, `/terms` | Спільна читабельна оболонка, локалізований зміст, незмінені юридичні тексти |
| `404` | Наявний not-found | Коротке пояснення → головна/пошук; без тупика |
| `system`, `states` | Тільки артефакт, не публічні routes | Палітра, бренд, типографіка, каталог екранів і крайові стани |

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

| Роль | Night | Day | Правило |
|---|---|---|---|
| Background | `#171918` | `#F0E9DC` | Тепла низькоконтрастна основа |
| Surface | `#202421` | `#E7DFD0` | Робочі форми, врізки, weekly |
| Raised | `#2B302C` | `#DDD4C4` | Локальні підняті поверхні |
| Text | `#F0E9DC` | `#232820` | Основне читання |
| Muted | `#B9B7AC` | `#606358` | Метадані та пояснення |
| Action / brass | `#D4B483` | `#72562E` | Один помітний основний CTA на блок |
| Signal / celadon | `#B5D8CC` | `#2D6559` | Focus, позитивний стан, дрібний сигнал |
| Border | `#414640` | `#B4B0A3` | Декоративні роздільники, не єдиний індикатор поля |
| Error | `#EFAAA0` | `#A13328` | Текст помилки + пояснення; не лише колір |

Орієнтир пропорцій: 75% базової поверхні, 18% тексту/ілюстрацій, 6% латуні, 1% celadon. Це напрям для композиції, не буквальна піксельна квота. Контраст конкретних пар зафіксувати в verification.json; декоративні лінії не використовувати як єдину межу інтерактивного поля. (source: design proposal)

### Типографіка

- EN display: **Fraunces 400**, окремий italic для акцентів. Великі заголовки 42–76 px, line-height 1.1, tracking −0.035em.
- UK display: **Georgia**, локальний системний serif fallback. Fraunces у наявному пакеті не має кириличного subset; не змішувати латиницю й кирилицю різних display-шрифтів в одному українському headline. Для повністю однакових EN/UK бренд-літер окремим рішенням підібрати кириличну гарнітуру до production.
- UI/body: **Inter 400/500/600**, self-hosted Latin + Cyrillic. Читання 17 px desktop / 16 px mobile, line-height 1.85. Meta 11–12 px, тільки другорядна інформація.
- Mono: Consolas → Courier New. Дата, джерело, номер розділу. Не використовувати для великих абзаців.
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

**Оновлено 2026-09-25:** власник обрав і розвинув [Tension v2](after-hours-tension.md). Спільний прототип тепер містить дев’ять жестів та брендовий Editorial Fold; початкова таблиця нижче збережена як історія базового концепту. Актуальні параметри — `artifacts/after-hours/tokens.json` і `tension.js`. (source: запит власника 2026-09-25)

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

- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md) — аудит розривів і порядок допрацювання
- [overview](../overview.md)
- [now](../now.md)
- [card-images](../marketing/card-images.md)
- [weekly-digest](../pipeline/weekly-digest.md)
