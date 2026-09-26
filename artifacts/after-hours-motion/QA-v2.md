# Tension v2 — перевірка

Дата: 2026-09-25. Авторитетний результат — живі прототипи, `route-audit-v2.json`, `verification-v2.json`, screenshots `screens/v2/`.

## Охоплення

26 маршрутів × 2 viewport = **52 перевірки рендеру**: desktop 1440×1000 і mobile 390×844. На кожному перевірено підключення v2, наявність h1, відсутність горизонтального переповнення й зламаних зображень, повернення WAAPI до 0. Збережено 52 повносторінкові JPEG; ширина самого зображення може відрізнятися від viewport на ширину scrollbar. Галерея: `gallery-v2.html`.

Маршрути: home, news, article, digests, daily, weekly, concepts, concept, guides, guide, tools, tool, categories, category, about, subscribe, search, saved, advertise, policy, 404, system, states, settings, instructions, motion.

## Дії

- Фільтр Agents & MCP: 2 news rows, `aria-pressed=true`, фокус збережено після render.
- Save → Saved → Reading list: 1 збережений матеріал.
- TOC → Context: поточний розділ отримує `aria-current=location`.
- Search dialog: MCP дає 2 результати; невідомий запит показує empty state; Escape закриває dialog.
- Weekly details відкривається й закривається.
- Prompt Optimizer формує цілісний результат, Copy стає доступною.
- settings.json: вибір edit → preview з Read/Edit; Copy доступна.
- AGENTS.md generator: обидва поля → локальна чернетка з введеним текстом.
- UI states: retry показує відновлення; валідний demo email показує підтвердження без відправлення.
- Motion off скасовує активні анімації й вимикає replay; стан зберігається при переході на головну.
- Перевірено збереження Motion off після reload, усі дев’ять кнопок жестів, перехід Tension → Signal → Tension у comparison, static mode в comparison → atlas.
- UK/Day на 390 px: меню відкривається, Escape закриває; Tab із брендового Replay переходить до наступного посилання з видимим focus. EN/Night та ширина 320 px також перевірені, без overflow.
- Галерея має 26 карток і 26 посилань на живі макети.
- Консоль під час перевірених сценаріїв: без зафіксованих error/warn.

### Article system — targeted recheck 2026-09-26

- Перевірено три повні deep-link стани: `analysis`, `technical`, `evidence`; кожен має один `h1`, власний title, активний format-card, 5–6 TOC-якорів і відповідно 3 / 4 / 5 source slots.
- У всіх трьох станах немає дубльованих `id`; переходи між форматами зберігають окремі shareable URL.
- На viewport 390×844 глобальний `scrollWidth` дорівнює 390 px. Широкі таблиці та code sample прокручуються лише у власних контейнерах.
- UK-версію evidence note перевірено на 390 px: локалізований заголовок, `lang=uk`, без глобального overflow.
- Desktop browser console після рендеру трьох варіантів: без error/warn. Повний 52-render audit 2026-09-25 не перегенеровувався; ця перевірка доповнює його новими article-станами.

## Performance

Брендова сцена — 16 SVG-ребер, перемичка й celadon-сигнал. Немає filter, canvas, WebGL, path morphing або постійного RAF-циклу. Максимум 32 одночасні WAAPI. Вимірювальний RAF запускається лише кнопкою в atlas, на 2,5 с.

Фактичний локальний замір: **151 frame samples, p95 16,8 мс, 0 інтервалів >34 мс, 24 peak WAAPI, 0 після завершення**. Viewport 1044×982, Codex Chromium, без CPU throttling. Це не CWV-score і не гарантія для слабкого телефона.

Спільний runtime + CSS + adapter: 43 328 байтів без стиснення, 13 474 байти gzip за локальним розрахунком; останній не означає, що preview-сервер уже віддає gzip. Точні розміри й SHA-256 — `verification-v2.json`. DOM головної містить лише raster-free brand scene і зображення mark.svg; старий PNG залишається на інших макетах.

## Звірка з ціллю

| Вимога | Доказ |
|---|---|
| Tension на всьому концепті | 26 маршрутів, 52 рендери в `route-audit-v2.json`; той самий runtime у базовому прототипі й comparison |
| Різноманітні, цілісні жести | 9 робочих прикладів; реальні сценарії списків, читання, форм, navigation, tools |
| Сильна брендова анімація головної | Editorial Fold; 16 латунних ребер → A + celadon; реальний render і Replay |
| Помірна вартість руху | SVG transform/opacity, скінченний цикл, cap 32, вимірювання кадрів і idle 0 |
| Передача у дизайн-систему | `tokens.json`, motion atlas, нова gallery, актуальні wiki/README |

`node --check` нових/змінених JS та `git diff --check` пройшли. `npm run wiki:check`: 0 errors, 6 helper tests pass, ті самі 22 попередження в наявних сторонніх wiki-сторінках.

## Межі

`prefers-reduced-motion` перевірено у реалізації CSS/JS; системна емуляція недоступна через поточний browser API. Ручний static mode перевірений наживо. Не виконувались physical touch, Safari/Firefox, screen-reader audit або GPU/CPU throttling. Нативна production-підписка й backend не входять до прототипу.

Результати попередньої ітерації: `QA.md`. Старі 22 wiki-lint warnings там перелічені; вони не виправлялися автоматично. Production build, push і PR не виконувалися; перед push потрібен `npm run pr:check`.
