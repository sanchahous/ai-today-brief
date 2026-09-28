# After Hours — AI Today Brief

Концепт редизайну: камерна редакційна атмосфера, латунь, тепле чорнило, кремовий текст і celadon-сигнал.

**Оновлення 2026-09-25 — Tension v2.** Обрана мова руху працює в усіх 26 макетах, включно з новим [атласом руху](http://127.0.0.1:4317/#/motion). На головній — векторний **Editorial Fold**: латунні ребра збираються у брендову A. [Специфікація](../../wiki/product/after-hours-tension.md) · [нова галерея](../after-hours-motion/gallery-v2.html) · [QA v2](../after-hours-motion/QA-v2.md).

**Оновлення 2026-09-26 — повна система статей.** Маршрут `#/article` тепер показує три окремі production-like формати з власними deep-link станами: [редакційний аналіз](http://127.0.0.1:4318/after-hours/#/article?variant=analysis), [технічний гайд](http://127.0.0.1:4318/after-hours/#/article?variant=technical) та [evidence note](http://127.0.0.1:4318/after-hours/#/article?variant=evidence). Це не короткі варіації одного body: кожен формат має свій ритм, зміст, приклади, таблиці або схеми, редакційні врізки, TOC і реєстр джерел.

**Оновлення 2026-09-26 (v3) — розширений Newsroom Discovery & Design System Showroom.**
На основі аудиту прогалин дизайн-системи та повної структури функціоналу в концепт додано:
- **Повноцінний Discovery Sidebar (`#/news`):**
  - **Сортування (4 варіанти):** Newest, Oldest, Relevance, Most discussed.
  - **9 Категорій:** чекбокси з кольоровими токенами, назвами та точними кількостями (Tools & releases: 33, Tutorials & guides: 4, Token & cost optimization: 6, Agents & MCP: 33, Vibe coding workflow: 7, Creative AI: 3, Local LLMs: 5, Career & monetisation: 0, Models & research: 9).
  - **Фільтр періоду (4 кнопки):** Today, Week, Month, All time.
  - **Популярні теми (теги):** `#MCP`, `#Cursor`, `#Claude Code`, `#RAG`, `#PromptCaching`, `#LocalModels`, `#TokenOptimization`, `#Benchmarks`.
  - **Кнопка скидання:** швидке очищення всіх фільтрів.
- **Головний тулбар новин:**
  - Поле пошуку з іконкою та швидким очищенням ✕.
  - Лічильник новин ("Stories found: X").
  - Стилізований випадаючий список сортування (`<select>` у фірмовому стилі After Hours).
  - Рядок активних фільтр-чіпів із можливістю видалення окремих фільтрів.
- **Картки новин із розкривним аналізом:**
  - Метадані (бейдж категорії, дата, час читання), заголовок, анотація, кнопки дій (Save, Share, Comments).
  - **Акордеон глибокого аналізу ("Expand analysis →"):** секція "Why it matters", список тез "Key takeaways", теги теми.
- **Доступна пагінація:** кнопки Previous, 1, 2, 3... Next із повною підтримкою ARIA та клавіатури.
- **Мобільний Drawer (< 1024px):** висувна панель фільтрів із кнопкою відкриття (мінімум 44px touch target) та кнопкою "Show results".
- **Шоурум дизайн-системи (`#/system`):**
  - Матриця токенів із бейджами WCAG AAA (14.6:1 текст, 8.9:1 латунь, 12.5:1 celadon).
  - Матриця кольорів усіх 9 категорій.
  - Інтерактивні форми: випадаючі списки, пошук, чекбокси, радіо, чіпи, візуалізатор правила 44px touch floor.
- **Шоурум станів UI (`#/states`):**
  - Скелетон картки з плавною анімацією shimmer.
  - Стан порожніх результатів пошуку з CTA повернення.
  - Стан відновлюваної помилки з інтерактивною кнопкою "Try again".
  - Стан валідації форми.

## Відкрити

З кореня репозиторію:

```powershell
node artifacts/after-hours/serve.mjs
```

Перегляд: [головна](http://127.0.0.1:4317/#/home), [карта макетів і дизайн-система](http://127.0.0.1:4317/#/system), [стани UI](http://127.0.0.1:4317/#/states).

Також можна відкрити `index.html` без сервера. Copy API може вимагати localhost. Всі шрифти й зображення локальні.

## Що передано

- Адаптивний HTML/CSS/JS прототип із desktop/mobile композиціями, EN/UK та Day/Night.
- Головна, News і три повні формати статті, архів дайджестів, Daily, Weekly, Concepts і detail, Guides і detail, Toolbox і робочі простори, Categories і хаб, About, Subscribe, Search, Saved, Advertise, trust/legal shell, 404.
- Живі навігація, пошук по demo-даних, фільтри, TOC, тема, мова, збереження в сесії, валідація email, local tool preview, copy.
- `tokens.css`, `tokens.json`, `assets/mark.svg`, локальні ліцензовані шрифти й оригінальний concept artwork.
- `screens/`, `gallery.html`, `verification.json` — архівні рендери й перевірки первинного візуального концепту. Поточні макети Tension v2: `../after-hours-motion/screens/v2/`, `gallery-v2.html`, `route-audit-v2.json`.
- `tension.js`, `tension.css`, `tension-init.js` — спільний motion-шар; параметри передані в `tokens.json`.
- [Специфікація й план реалізації](../../wiki/product/after-hours-redesign.md).

## Межі прототипу

> **Статус 2026-09-26:** за результатами [аудиту повноти дизайн-системи](../../wiki/audits/2026-09-26-design-system-gap-plan.md) After Hours класифіковано як visual concept + functional gap plan. Функціональні розриви (сортування, пагінація, taxonomy, token governance) фіксуються в [ADR 2026-09-26](../../wiki/decisions/2026-09-26-news-discovery-and-pagination-architecture.md) до повного rollout.

Це візуальний дизайн-концепт, не заміна production-коду. Контент і дати демонстраційні, позначені у preview strip. Три article-стани показують різні редакційні задачі, але інші detail-шаблони все ще можуть обслуговувати кілька карток. Категорії й довідник показують репрезентативний зріз, не повний каталог.

Підписка нічого не надсилає. Утиліти показують UI і локальне формування шаблонів, не копіюють production engine. Збережене живе до reload. Наявні політики відкриваються за зовнішніми посиланнями; демонстраційний legal shell не заміняє юридичних текстів.

Реалізація на наявному Next.js/React/Tailwind описана у специфікації. Прототипні hash routes й демонстраційні дані в production не переносити.

## Авторський образ

`assets/after-hours.png` створено built-in imagegen 2026-09-05. Оригінал скопійовано в workspace; це абстрактний brand art, не документальне зображення новини. Точний prompt: [image-prompt.txt](image-prompt.txt). Окремих платних API чи нових npm-залежностей не додано.

На головній Tension v2 цей raster замінено локально побудованим SVG-знаком. Старе зображення не створюється в DOM головної; інші редакційні макети зберігають concept artwork.
