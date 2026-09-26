# After Hours — Tension v2

Summary: обрана власником мова руху для всіх 26 макетів After Hours: дев’ять контекстних жестів і ключова брендова анімація The Editorial Fold.
Sources: запит власника 2026-09-25; `artifacts/after-hours/tension.js`, `tension.css`, `tension-init.js`, `tokens.json`; `artifacts/after-hours-motion/route-audit-v2.json`; browser review 2026-09-25.
Last updated: 2026-09-25

---

## Рішення та результат

Власник обрав **01 · Tension**, попросив урізноманітнити рух, поширити його на весь концепт та створити одну сильну брендову анімацію головної без зайвої ваги. Це замінює початкову рекомендацію Quiet Signal з [першого дослідження](after-hours-motion.md). (source: запит власника 2026-09-25)

Tension v2 підключено до спільного прототипу `artifacts/after-hours/index.html` і до режиму Tension панелі порівняння. Первинні 25 макетів зберігають свої дії; додано 26-й — **Motion atlas**. Production `src/` не змінювався. (source: `artifacts/after-hours/index.html`, `app.js`, `tension-init.js`; `artifacts/after-hours-motion/index.html`, `motion.js`)

Перегляд: [запуск](../../artifacts/after-hours/README.md), [галерея](../../artifacts/after-hours-motion/gallery-v2.html), [QA v2](../../artifacts/after-hours-motion/QA-v2.md). Статичні зображення показують композицію; рух оцінюється у живому прототипі. (source: `artifacts/after-hours-motion/build-v2-gallery.mjs`)

## The Editorial Fold

**Багато сигналів. Один погляд.** Після відгуку власника про незграбне складання брендова сцена допрацьована: 16 латунних ребер розкриваються з компактного складеного стану від спільної основи; зовнішні ведуть внутрішні. Зустрічні обертання прибрано. Скляна поперечина й celadon-крапка послідовно завершують A. Це авторська пластична інтерпретація складання, не фізична симуляція. (source: запит власника 2026-09-25; `artifacts/after-hours/tension.js` — `brandTracks`)

| Фаза | Рух | Таймінг |
|---|---|---|
| Розкриття | 16 вкладених ребер, спільна основа (270, 399), плавне прискорення й гальмування | 1420 мс на ребро; крок 10 мс; завершення 1570 мс |
| Зв’язок | Поперечина розкривається від власного центру | 1180–1780 мс |
| Ясність | Напрямна, крапка, потім тихий ореол | 1640–2200 мс; крапка 1740–2100 мс |
| Спокій | Повний статичний знак | 2200 мс; без циклу |
| Явний Replay | Готовий знак спочатку плавно складається | Додаткові 320 мс перед основними 2200 мс |

(source: `artifacts/after-hours/tension.js` — `brandTracks`, `playBrand`; `tokens.json`)

Брендова сцена має окремий монотонний easing `cubic-bezier(.32,0,.2,1)`, без відскоку пружини. Ребра отримали паралельні бокові лінії, дотичні заокруглення вершин і суцільний тонкий відблиск; градієнти мають унікальні ID для кожної сцени. Підпис відділено від ніжок знака. Усі треки мають спільний час старту; повторне натискання під час руху ігнорується; завершення визначається самими анімаціями, без окремого таймера. (source: `tension.js`; `tension.css`)

Сцена стартує при першому вході у viewport. Повтор — явною кнопкою ↻; reduced-motion показує фінальний знак. Вона займає місце головного artwork, зберігаючи редакційну ієрархію. SVG формується відразу: попередня PNG-ілюстрація розміром 1 806 682 байти не вставляється в DOM головної Tension. (source: `app.js` — `art`; `tension.js` — `observeEntrances`, `syncQuiet`; `assets/after-hours.png`)

Окремий [покадровий перегляд](../../artifacts/after-hours-motion/fold-review.html) зупиняє **ті самі WAAPI-треки**, що працюють на головній. Поточна перевірка й кадри: [Editorial Fold refined](../../artifacts/after-hours-motion/FOLD-REFINED.md). (source: `fold-review.js`; `tension.js` — `previewBrand`)

## Дев’ять жестів

| Жест | Застосування | Параметри |
|---|---|---|
| Поява з вагою | Вступ, картки, порожні стани | Spring 8 px / 640 мс |
| Редакційне розкриття | Обкладинки, toolbox, workbench | 5° perspective / 760 мс |
| Вирівнювання | News, довідникові рядки, результати пошуку | X −7 → 0 px / 440 мс |
| Натяг лінії | Дата, секції, акценти | Від центру / 620 мс; декоративний прохід 840 мс |
| Стиснення | CTA, chips, іконкові дії | Scale .975 → 1 / 480 мс |
| Фіксація фокусу | Поля, підкреслення, приклад в атласі | Рамка одразу; акцент до 300 мс |
| Розкриття результату | Вихід утиліт, toast | Цілісний блок 5 px / 520 мс |
| Підтвердження | Save, retry, demo submit | Scale .985 → 1 / 420 мс |
| Розкриття примітки | Details, search dialog, меню | До 4 px / 360 мс |

(source: `tension.js` — `gesture`, `dynamicStates`; `tension.css`; `tokens.json`)

Hover карток теж різниться: пластини зміщуються послідовно, кільце робить короткий поворот, кодовий знак вирівнюється по горизонталі. Лінія навігації рухається між пунктами; зміст статей позначає поточний розділ через `aria-current="location"`. Читальні абзаци не анімуються під час скролу. (source: `tension.js` — `pictureGesture`, `navMotion`, `setupReading`)

## Охоплення

| Родина | Макети | Поведінка |
|---|---|---|
| Головна | home | Editorial Fold, вступ, лінії, різні картки, newsletter |
| Потік і навігація | news, category, categories, concepts, guides, digests, saved, search | Рядки/обкладинки, filters, live search, empty states |
| Читання | article, daily, weekly, concept, guide, policy | Вступ/byline, callout, зміст, details, save/copy |
| Практика | tools, tool, settings, instructions | Панелі, focus полів, цілісний результат, Copy |
| Сервісні | about, subscribe, advertise, 404 | Вступ, CTA, форми, підтвердження |
| Дизайн-система | system, states, motion | Токени, retry, validation, живі приклади й diagnostics |

(source: `artifacts/after-hours-motion/route-audit-v2.json`; `app.js`; `workspaces.js`; `tension.js`)

## Фізика та обмеження

Пружина для контекстних жестів інтерфейсу: `m = 1`, `k = 240`, `c = 24`; `r(t) = exp(−12t) × [cos(√96 t) + 12/√96 × sin(√96 t)]`. Рух семплується у WAAPI keyframes. CSS-мікровідгуки використовують близький easing, не постійний solver. Токени: touch 160 мс, shift 320 мс, settle 640 мс. (source: `tension.js` — `spring`, `sampled`; `tension.css`; `tokens.json`)

- Ліміт **32 активні WAAPI-анімації**. При перевищенні декоративний рух пропускається, контент видимий.
- Кінцевий статичний стан — базовий CSS/SVG. Переривання не залишає прихованого тексту.
- `prefers-reduced-motion` має пріоритет; runtime-зміна скасовує рух. Ручний режим зберігається в URL і між макетами.
- Прихована вкладка скасовує активні анімації й вимірювання. Route change прибирає observers, listeners і таймери.
- Focus-outline одразу видимий. Немає typewriter, мерехтіння, паралаксу тексту, autoplay-звуку чи scroll hijacking.
- Немає canvas, WebGL, SVG filters або morphing path на кожному кадрі. Брендовий жест змінює transform/opacity SVG-груп.

(source: `tension.js`; `tension.css`; `tension-init.js`; `artifacts/after-hours-motion/motion.js`)

## Перевірка й передача

Після полірування: локальний замір основного розкриття — 141 кадр за 2,5 с, p95 інтервалу 18,4 мс, 0 інтервалів понад 34 мс; пік 22 WAAPI, після завершення 0. Це Codex Chromium на поточному комп’ютері, viewport 1440×1000, без CPU throttling — **не гарантія для всіх пристроїв і не CWV-score**. Попередній замір v2 залишається історичним. (source: browser diagnostic 2026-09-25; `artifacts/after-hours-motion/fold-verification.json`)

Маршрутний аудит усіх 26 макетів при viewport 1440×1000 і 390×844: v2 підключений, заголовки є, немає горизонтального переповнення/зламаних зображень у перевірених станах, WAAPI повертається до 0. Сценарії дій та межі — [QA v2](../../artifacts/after-hours-motion/QA-v2.md). (source: `route-audit-v2.json`; browser review 2026-09-25)

Масштабовано **дизайн-концепт і прототипи**. Перенесення до production Next.js — окремий етап: tokens/CSS до компонентів, малий client layer для scene/observer, збереження SSR-контенту та реальних API. Hash routes, demo submit і діагностичний atlas у продукт не переносити. (source: scope запиту власника; design handoff proposal)

## Related pages

- [after-hours-redesign](after-hours-redesign.md) — візуальна основа.
- [after-hours-motion](after-hours-motion.md) — історія трьох напрямів.
- [overview](../overview.md) — продукт і обмеження.
