# After Hours — AI Today Brief

Концепт редизайну: камерна редакційна атмосфера, латунь, тепле чорнило, кремовий текст і celadon-сигнал.

**Оновлення 2026-09-25 — Tension v2.** Обрана мова руху працює в усіх 26 макетах, включно з новим [атласом руху](http://127.0.0.1:4317/#/motion). На головній — векторний **Editorial Fold**: латунні ребра збираються у брендову A. [Специфікація](../../wiki/product/after-hours-tension.md) · [нова галерея](../after-hours-motion/gallery-v2.html) · [QA v2](../after-hours-motion/QA-v2.md).

**Оновлення 2026-09-26 — повна система статей.** Маршрут `#/article` тепер показує три окремі production-like формати з власними deep-link станами: [редакційний аналіз](http://127.0.0.1:4318/after-hours/#/article?variant=analysis), [технічний гайд](http://127.0.0.1:4318/after-hours/#/article?variant=technical) та [evidence note](http://127.0.0.1:4318/after-hours/#/article?variant=evidence). Це не короткі варіації одного body: кожен формат має свій ритм, зміст, приклади, таблиці або схеми, редакційні врізки, TOC і реєстр джерел.

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

Це завершений дизайн-концепт, не заміна production-коду. Контент і дати демонстраційні, позначені у preview strip. Три article-стани показують різні редакційні задачі, але інші detail-шаблони все ще можуть обслуговувати кілька карток. Категорії й довідник показують репрезентативний зріз, не повний каталог.

Підписка нічого не надсилає. Утиліти показують UI і локальне формування шаблонів, не копіюють production engine. Збережене живе до reload. Наявні політики відкриваються за зовнішніми посиланнями; демонстраційний legal shell не заміняє юридичних текстів.

Реалізація на наявному Next.js/React/Tailwind описана у специфікації. Прототипні hash routes й демонстраційні дані в production не переносити.

## Авторський образ

`assets/after-hours.png` створено built-in imagegen 2026-09-05. Оригінал скопійовано в workspace; це абстрактний brand art, не документальне зображення новини. Точний prompt: [image-prompt.txt](image-prompt.txt). Окремих платних API чи нових npm-залежностей не додано.

На головній Tension v2 цей raster замінено локально побудованим SVG-знаком. Старе зображення не створюється в DOM головної; інші редакційні макети зберігають concept artwork.
