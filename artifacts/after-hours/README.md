# After Hours — AI Today Brief

Концепт редизайну: камерна редакційна атмосфера, латунь, тепле чорнило, кремовий текст, celadon-сигнал і третій, «оксамитовий» акцент (claret / velvet).

## Оновлення 2026-09-28 — After Hours v3

Прототип доведено до рівня, з якого можна переносити в production: кожен макет перевірено в Chromium, Firefox і WebKit, на 5 ширинах, у двох темах і двох мовах.

- **Палітра й світла тема.** Токени переписано у три шари: primitives → semantic → component (`tokens.css` 2.0.0-proposal — наступний major після production `tokens.ts` v1.0.0). Корінь багів світлої теми: вона не перевизначала `--paper`/`--ink`/`--brass`, а категорії мали жорстко задані неонові кольори. Тепер кожна роль має значення для Night і Day, категорії — окремі jewel-tone значення на тему (≥ 4,5:1), додано третій акцент claret/velvet, матеріальну глибину (тіні, зерно, світло сцени). Контраст-гейт: **160 пар, 0 провалів** (`qa/check-tokens.mjs`).
- **Типографіка.** rem-шкала з мінімумом 12 px (поважає розмір шрифту браузера); дрібні мітки-реєстри, як «01 / TECHNICAL FIELD GUIDE», збільшено й переведено в sentence case.
- **Макети.** Власну структуру отримали 04 Digests (календар + порівняння форматів + архів), 05 Daily brief (номер дня, «бриф за 30 секунд», ранковий монтаж із прогресом читання), 06 Weekly (обкладинка-платівка, action board, розділи), 07 Concepts (карта зв’язків, A–Z, фасети), 09 Guides (порівняльна матриця, бенчмарк, вибір за задачею), 11 Toolbox (три інструменти з живим прев’ю результату, принципи роботи, таблиця вибору), 13 Categories (мапа покриття пропорційно частці матеріалів).
- **Доступність.** WCAG 2.2 AA: контраст, цілі 44 px на сенсорних екранах, підписані поля, фокусовані області прокрутки, ролі таблиць, нативні `<dialog>`, `prefers-reduced-motion` і `forced-colors`.
- **SEO й schema.** Кожен маршрут показує контракт production-сторінки: title/description, canonical і hreflang (en/uk/x-default), Open Graph/Twitter, JSON-LD-граф (NewsArticle, TechArticle, CollectionPage + ItemList, FAQPage, VideoObject, DefinedTermSet, WebApplication, ProfilePage, AboutPage, BreadcrumbList, Organization, WebSite + SearchAction). Інспектор SEO відкривається з верхньої смуги прототипу.
- **Продуктивність.** Концепт-арт віддається через `<picture>` AVIF/WebP/JPEG з фіксованими розмірами: 1,8 МБ PNG → 13,5 КБ (800 px AVIF) / 32,5 КБ (1600 px AVIF). Preload шрифтів, тема застосовується до першого рендеру (без спалаху), один рендер при завантаженні.
- **Рух — Tension v3.** Дванадцять скінченних жестів (креслення ліній, відлік чисел, «акорд» знака, View Transitions між маршрутами тощо) з лімітом 32 одночасні анімації. На головній — брендова сцена **The Resolve** (3,4 с): розсіяні латунні сигнали → редагування в лінії знака A → хвиля резонансу й celadon-крапка поза тактом. Статична сцена є в розмітці одразу; анімація лише поверх.
- **Покриття продукту.** Маршрут `#/coverage` зіставляє функціонал production із макетами, щоб під час імплементації нічого не залишилось без дизайну. Додано профіль редактора (`#/author`); шапка отримала меню категорій і мобільне меню, з’явилася consent-картка; пошук, «Збережене» й шаблон статті доведено до паритету з production.

Посилання (сервер нижче): [головна](http://127.0.0.1:4318/after-hours/#/home) · [дизайн-система](http://127.0.0.1:4318/after-hours/#/system) · [покриття продукту](http://127.0.0.1:4318/after-hours/#/coverage) · [атлас руху](http://127.0.0.1:4318/after-hours/#/motion) · [The Resolve покадрово](http://127.0.0.1:4318/after-hours-motion/fold-review.html) · [галерея v3](gallery-v3.html) · [QA](QA.md).

## Відкрити

З кореня репозиторію:

```powershell
node artifacts/after-hours-motion/serve.mjs
```

Прототип: `http://127.0.0.1:4318/after-hours/`. Сервер віддає лише папки `after-hours` і `after-hours-motion`. Також працює `node artifacts/after-hours/serve.mjs` (порт 4317) або відкриття `index.html` без сервера (Copy API може вимагати localhost).

URL-контракт: `?theme=night|day&lang=en|uk&motion=off#/маршрут?параметри`, наприклад `?theme=day#/article?variant=technical`. Тема й мова зберігаються в `localStorage` (`atb-after-hours-prefs`); параметри URL мають пріоритет.

## Файли

| Файл | Роль |
|---|---|
| `index.html` | Оболонка: ранній скрипт теми/мови, preload шрифтів, діалог пошуку |
| `tokens.css` | Джерело правди токенів v3; `tokens.json` генерується з нього |
| `style.css` | Фундамент: reset, типографіка, шапка, навігація, картки, форми, стани |
| `pages.css` | Макети сторінок і адаптивні правила |
| `tension.css`, `tension.js` | Мова руху Tension v3 і сцена The Resolve (спільні з `../after-hours-motion`) |
| `app.js` | Ядро: налаштування, хелпери, іконки, маршрутизатор, шапка/футер, пошук, consent, дії |
| `data.js` | Демонстраційні дані (новини, випуски, концепти, гайди, категорії) |
| `home.js` · `articles.js` · `editions.js` · `knowledge.js` · `toolbox.js` · `pages.js` | Рендерери груп маршрутів |
| `seo.js` | SEO-контракт кожного маршруту та інспектор |
| `boot.js` | Завантажується останнім: атлас руху, підключення руху, перший рендер |
| `assets/` | Знак, ліцензовані шрифти, концепт-арт (PNG-майстер + AVIF/WebP/JPEG) |
| `qa/` | Гейт контрасту, експорт токенів, браузерний QA, зйомка галереї, звіти |
| `gallery-v3.html`, `screens-v3/` | Знімки всіх 28 маршрутів: desktop Night/Day, mobile Night |
| `screens/`, `gallery.html`, `verification.json` | Архів первинного статичного концепту (v1) |

## Перевірки

```powershell
node artifacts/after-hours/qa/check-tokens.mjs      # контраст токенів, exit 1 на провалі
node artifacts/after-hours/qa/export-tokens.mjs     # tokens.css → tokens.json
node artifacts/after-hours/audit.mjs                # контраст + хеші джерел + цілісність медіа
node artifacts/after-hours/qa/run-qa.mjs            # браузерний QA (потрібен сервер на 4318)
node artifacts/after-hours/qa/capture-gallery.mjs   # оновити screens-v3/ і gallery-v3.html
```

Параметри `run-qa.mjs`: `--browsers=chromium,firefox,webkit`, `--quick` (лише 1440 і 390), `--routes=home,news`, `--themes=night,day`, `--langs=en,uk`, `--motion=on` (без reduced motion, з очікуванням завершення анімацій), `--shots`, `--out=файл.json`. Результати й межі перевірки — у [QA.md](QA.md).

## Межі прототипу

Це дизайн-прототип, не production-код. Контент і дати демонстраційні, позначені у верхній смузі. Hash-маршрути й демо-дані в production не переносити. Підписка нічого не надсилає; утиліти показують UI й локальне формування шаблонів, а не production engine; «Збережене» живе до перезавантаження.

Production-токени (`src/lib/design-system/tokens.ts`, «After Hours v1.0.0») цим оновленням **не змінено**. Значення v3 — пропозиція: перенесення в `tokens.ts`, Tailwind і `scripts/check-design-tokens.ts` є окремим кроком імплементації з власною перевіркою. Реалізація на Next.js/React/Tailwind описана в [специфікації](../../wiki/product/after-hours-redesign.md).

## Історія

- **2026-09-26 — Newsroom Discovery і шоурум дизайн-системи.** Discovery-панель `#/news` (сортування, 9 категорій, період, теми, скидання, чипи активних фільтрів), пагінація, мобільний drawer, шоуруми `#/system` і `#/states`. Архітектура: [ADR 2026-09-26](../../wiki/decisions/2026-09-26-news-discovery-and-pagination-architecture.md); прогалини: [аудит дизайн-системи](../../wiki/audits/2026-09-26-design-system-gap-plan.md).
- **2026-09-26 — система статей.** Три повні формати `#/article`: редакційний аналіз, технічний гайд, evidence note — зі своїм ритмом, TOC, врізками й реєстром джерел.
- **2026-09-25 — Tension v2.** Мова руху для всіх макетів і брендовий Editorial Fold; архів: [галерея v2](../after-hours-motion/gallery-v2.html), [QA v2](../after-hours-motion/QA-v2.md).
- **2026-09-05 — первинний візуальний концепт** (`screens/`, `gallery.html`, `verification.json`).

## Авторський образ

`assets/after-hours.png` створено built-in imagegen 2026-09-05; це абстрактний brand art, не документальне зображення новини. Точний prompt: [image-prompt.txt](image-prompt.txt). PNG лишається майстер-файлом; сторінки віддають похідні AVIF/WebP/JPEG. На головній замість растра — векторна сцена The Resolve. Платних API чи нових npm-залежностей не додано.
