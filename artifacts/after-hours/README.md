# After Hours — AI Today Brief

Концепт редизайну: камерна редакційна атмосфера, латунь, тепле чорнило, кремовий текст і celadon-сигнал.

## Відкрити

З кореня репозиторію:

```powershell
node artifacts/after-hours/serve.mjs
```

Перегляд: [головна](http://127.0.0.1:4317/#/home), [карта макетів і дизайн-система](http://127.0.0.1:4317/#/system), [стани UI](http://127.0.0.1:4317/#/states).

Також можна відкрити `index.html` без сервера. Copy API може вимагати localhost. Всі шрифти й зображення локальні.

## Що передано

- Адаптивний HTML/CSS/JS прототип із desktop/mobile композиціями, EN/UK та Day/Night.
- Головна, News і стаття, архів дайджестів, Daily, Weekly, Concepts і detail, Guides і detail, Toolbox і робочі простори, Categories і хаб, About, Subscribe, Search, Saved, Advertise, trust/legal shell, 404.
- Живі навігація, пошук по demo-даних, фільтри, TOC, тема, мова, збереження в сесії, валідація email, local tool preview, copy.
- `tokens.css`, `tokens.json`, `assets/mark.svg`, локальні ліцензовані шрифти й оригінальний concept artwork.
- `screens/` — фактичні рендери макетів; `verification.json` — результати перевірки.
- [Специфікація й план реалізації](../../wiki/product/after-hours-redesign.md).

## Межі прототипу

Це завершений дизайн-концепт, не заміна production-коду. Контент і дати демонстраційні, позначені у preview strip. Один detail-шаблон може обслуговувати кілька карток. Категорії й довідник показують репрезентативний зріз, не повний каталог.

Підписка нічого не надсилає. Утиліти показують UI і локальне формування шаблонів, не копіюють production engine. Збережене живе до reload. Наявні політики відкриваються за зовнішніми посиланнями; демонстраційний legal shell не заміняє юридичних текстів.

Реалізація на наявному Next.js/React/Tailwind описана у специфікації. Прототипні hash routes й демонстраційні дані в production не переносити.

## Авторський образ

`assets/after-hours.png` створено built-in imagegen 2026-09-05. Оригінал скопійовано в workspace; це абстрактний brand art, не документальне зображення новини. Точний prompt: [image-prompt.txt](image-prompt.txt). Окремих платних API чи нових npm-залежностей не додано.
