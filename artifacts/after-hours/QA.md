# Межі перевірки й передача в розробку

Дизайн-концепт перевіряється через фактичний браузерний рендер і дії, а не лише наявність HTML-файлу. Результати: `verification.json`; контраст токенів, SHA-256 вихідних файлів і розміри експортованих зображень: `artifact-audit.json`.

## Перевірені сценарії

News category filter; Weekly-only archive; Concepts type filter; глобальний пошук; порожній пошук; Escape у пошуку; Save → reading list; local prompt template; невалідний email; демонстраційне підтвердження email; settings preview; AGENTS.md/CLAUDE.md preview; відкриття й закриття mobile menu; Day theme; українська локалізація.

Це UI-прототип. Success підписки явно повідомляє, що лист не надсилався. Немає live backend, production SEO-інтеграції чи виміряних CWV. Утиліти демонструють поведінку, а production engine залишається наявним. Не можна стверджувати повну WCAG-відповідність лише за контрастом палітри.

## Перегляд макетів

`gallery.html` показує всі сторінки попарно desktop/mobile. Повносторінкові зображення відкриваються в повному розмірі. Це статичні знімки концепції; інтерактивний прототип є авторитетним для фінальних focus-станів, меж полів і виправленої поведінки. На частині знімків видима рамка фокусу main, яку прибрано з фінального прототипу. Кольорові та мовні варіанти додано окремими знімками viewport.

## Перевірка wiki

`npm run wiki:check` пройшов: project-sync — 0 error / 0 warn, 6 helper tests pass, wiki-lint — 0 error / 7 попереджень у наявних сторонніх сторінках. Автоматично вони не виправлялись:

1. `wiki/analytics/ga4-gsc.md`: немає маркера джерела у великому тексті.
2. `wiki/architecture/mvp-dev-handoff.md`: застаріла дата.
3. `wiki/architecture/prototype-to-production.md`: застаріла дата.
4. `wiki/ops/services-portability.md`: застаріла дата.
5. `wiki/ops/supabase-audit-2026-08-20.md`: немає маркера джерела.
6. Та сама сторінка: немає запису в index.
7. `wiki/strategy/startup-plan.md`: застаріла дата.

Повний `pr:check` потрібен перед push/PR production-змін. У цьому завданні push, PR і production-реліз не виконувались; створено артефакти й дизайн-специфікацію.
