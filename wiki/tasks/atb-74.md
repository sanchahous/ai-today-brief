# ATB-74

Summary: ATB-56 (View Transitions, AH-6.3) не закрилась за три кола, бо один лічильник виправлень ділять два різні гейти, а останній пуш після третього виправлення вже не повернули автору.
Sources: живий стан Orchestra Hub 2026-10-05 (item ATB-56, run R1005-689bd8f0, events 1634/1665/1675/1686); гілка `feat/ah-6.3-view-transitions` у worktree `E:\wt\ai-today-brief\R1005-689bd8f0` (локально `caeef22`, `origin` лишився на `d7705be`); `.githooks/pre-push`; `package.json` (`pr:check`, `e2e:check`); `scripts/e2e-affected.ts`; `eslint.config.mjs`; `playwright.config.ts`; `E:\cloud-orc\orc\conductor.py`, `quality.py`, `config.py`
Last updated: 2026-10-05

---

Task: atb-74

## Status

```verbatim
ATB-74 · діагноз: три кола View Transitions згоріли на двох гейтах; код лишився лише локально
```

Діагноз закрито в цьому файлі. `PORT=3100 npm run pr:check` — exit 0 (2026-10-05): 2338 тестів, typecheck, lint, wiki:check, build:ci пропущено (немає змін сайту). Сама ATB-56 лишається `blocked` на стадії пуша: шість комітів роботи є лише локально, у віддалену гілку вони не потрапили. Спільні списки не змінювались. (source: Orchestra Hub item ATB-56, 2026-10-05; `git status` worktree R1005-689bd8f0)

## Що відбулось за три кола

Лічильник `rounds.qa` після зупинки дорівнює 4. Ліміт `qa_rounds` — 3. Четверте спрацювання того самого лічильника вже не ставить виправлення, а блокує задачу. (source: `E:\cloud-orc\orc\config.py`; `conductor.py` `_rework`; item ATB-56 `rounds`)

| Прохід | Гейт | Що впало | Коло |
|---|---|---|---|
| Після першої роботи | `git push` → pre-push, увесь chromium-набір | 3 падіння, 875 пройшли за 4,8 хв: `ERR_NO_BUFFER_SPACE` на `/uk/about` (той самий Windows-флейк, що в AH-6.2), cookie-банер віддав `HTML` замість банера, пошук у шапці на 1160px лишився на `/uk/news` | 1 → виправлення пошуку й банера |
| Після першого виправлення | `npm run pr:check` оркестратора, 2 хв 15 с | ESLint прочитав `playwright-report/trace/assets/*.js`, які щойно записав pre-push | 2 → `playwright-report/**` і `test-results/**` у `globalIgnores` |
| Після другого виправлення | знову pre-push | 3 інші падіння, 880 пройшли за 4,5 хв: пошук на 1100px, 8 WAAPI-анімацій при reduced motion, `e.target?.closest is not a function` | 3 → ці три правки; автор перевірив лише названі спеки |
| Після третього виправлення | знову pre-push | новий розсип: сцена бренду, сайдбар (`maxHeight` = NaN), поле листа на 320 і 390, далі в обрізаному хвості mobile-search і news-search; пройшло 868. Коло вже не видається | зупинка |

У кожному відхиленому пуші є ще `[WebServer] The destination stream closed early`. Воно було і в перших двох пушах, де сцена бренду й футер проходили, тож само по собі четвертий розсип не пояснює. (source: events `problem_detail` 1634, 1665, 1675, 1686)

## Механізм, а не разовий збій

Причина в обох місцях. Оркестратор вирішує, що задача більше не має спроби. Зміна в шаблоні маршруту вирішує, що кожна спроба пуша — це майже весь набір тестів, і що остання «полагоджена» версія сама створює нову хвилю падінь.

### Два гейти, один лічильник

Автору наказано здавати `npm run pr:check`. У цьому скрипті крок e2e — це `e2e:check`, тобто `e2e-affected.ts --check`: перевірка карти покриття, без Playwright. (source: `package.json`; шапка `scripts/e2e-affected.ts`)

Пуш запускає `.githooks/pre-push` → `npm run e2e:affected`. Зміна `src/app/[lang]/layout.tsx`, `src/app/layout.tsx` або `src/app/globals.css` входить у список BROAD і запускає **усі** chromium-спеки. Локально це 4 воркери (`workers` без `CI`). (source: `.githooks/pre-push`; `scripts/e2e-affected.ts` масив `BROAD`; `playwright.config.ts`)

AH-6.3 чіпає саме ці файли, плюс `template.tsx`. Зелений `pr:check` не означає, що пуш пройде. Кожне таке падіння пуша списується з того самого `qa`, що й падіння `pr:check`. (source: `conductor.py` `_stage_pushing` кличе `_rework(..., "checks", ...)`; ліміти `checks` і `ci` ділять `qa_rounds`)

Три кола на задачі з широким layout — це три зрізи одного великого набору, не три спроби довести одну помилку. `failure_key` хешує текст лога. Інші назви спек — інший ключ, тож `same_failure_rounds` (2) тут не спрацьовує і «ту саму» повну прогонку не впізнає. На момент блокування `failure.times` = 1. (source: `conductor.py` `failure_key`; item ATB-56 `options.failure`)

`failure_evidence` лишає перші 4 збіги `Error:` і останні 1000 символів, у стелі 4500. Автор бачить жменю падінь, лагодить їх і перевіряє лише їх. Наступний повний прогін приносить іншу жменю. Так бюджет не сходиться. (source: `E:\cloud-orc\orc\quality.py` `failure_evidence`; звіти кіл 1 і 3, де автор прямо пише про цільові спеки)

### Коло, яке оркестратор створює собі сам

Pre-push пише `playwright-report/` у той самий worktree. Наступний `pr:check` лінтує все дерево. На `main` цього репозиторію `eslint.config.mjs` досі не ігнорує `playwright-report/**` (ігнор є лише в незапушеній гілці AH-6.3). Друге коло ATB-56 пішло на це, не на продукт. Поки ігнор не на `main`, кожна задача, чий перший пуш впав на e2e, ризикує віддати наступне коло лінтеру згенерованого звіту. (source: event 1665; `eslint.config.mjs` на цій гілці; `eslint.config.mjs` на `caeef22`)

### Останнє виправлення породило падіння, якому вже не було кола

До третього кола шаблон завжди обгортав сторінку в `<ViewTransition>`. Третє коло замінило це на клієнтський `RouteViewTransition`: серверний знімок `useSyncExternalStore` повертає `true` (ніби reduced motion), тому гідрація йде **без** обгортки, а після неї звичайний браузер отримує `false` і вставляє `<ViewTransition>`. Корінь шаблону змінюється, дерево сторінки всередині `<main>` розмонтовується. (source: `src/components/motion/route-view-transition.tsx` і `src/app/[lang]/template.tsx` у коміті `caeef22`)

Перший повний chromium-прогін після цього коміту — якраз четвертий пуш. У ньому від'єднані вузли в `.brand-stage` і в першому `input[type=email]` (смуга листа на головній, вона всередині шаблону, не в футері поза `<main>`). Ці спеки на попередніх двох пушах не падали. (source: event 1686; `e2e/footer-newsletter.spec.ts`; `e2e/brand-resolve.spec.ts` на гілці AH-6.3)

Автор цього прогону не бачив: при `used > limit` блок ставиться до постановки виправлення. Текст для людини — «вичерпано кола виправлень (3)», без списку нових падінь. Ретроспектива впала з `PermissionError: WinError 32` на `E:\temp\orc-summary-*` і зберегла урок попереднього кола (`closest` на текстовому вузлі), а не причину зупинки. Наступні задачі вчаться не тому збою. (source: `conductor.py` `_rework` / `_block`; retrospective ATB-56 `state: fallback`)

## Де лежить робота

`origin/feat/ah-6.3-view-transitions` стоїть на `d7705be` (`chore: start ATB-56`). Локальна гілка попереду на 6 комітів (`5e7599f`…`caeef22`), включно з усіма трьома виправленнями. PR існує, але віддалена гілка не містить реалізації: кожен пуш із кодом відхилив hook до оновлення remote. Worktree `R1005-689bd8f0` ще на місці. `retry` без `fresh` обнуляє `rounds` і веде в перевірки знову; четвертий лог автору сам не віддає. `retry fresh` при живому worktree має підхопити збережену копію, а не стартовий коміт. (source: `git rev-parse` і `git status` worktree R1005-689bd8f0; `conductor.py` `retry`)

## Що це змінює для схожих задач

Будь-яка задача, чий diff зачіпає BROAD-шляхи (кореневий layout, `[lang]/layout`, `globals.css`, конфіг, спільні e2e-хелпери, `package.json`), не може закритись гейтом, який їй наказано прогнати. Три кола вистачає, лише якщо повний chromium стабільно зелений з першого пуша. Інакше бюджет з'їдають по черзі: флейк чотирьох воркерів на Windows, лінт власного `playwright-report`, потім наступний зріз справжніх падінь. Четвертий зріз, навіть якщо його породило щойно зроблене виправлення, вже не ремонтується.

Поки `playwright-report/**` не в `globalIgnores` на `main`, пастка другого кола лишається для всіх таких задач. Поки серверний знімок `RouteViewTransition` розходиться з клієнтським деревом, повторний пуш AH-6.3 знову впаде на від'єднаних вузлах усередині `<main>`, навіть якщо `pr:check` зелений.

## Наступний крок

Не нова картка епіку. Для ATB-56 потрібне ще одне коло виправлення з логом четвертого пуша (подію 1686), а не повторний `pr:check` наосліп. Окремо, уже в оркестраторі: не списувати падіння pre-push і падіння `pr:check` з одного ліміту 3, і не підміняти текст останнього падіння фразою про вичерпаний ліміт.

## Related pages

- [ah-6.3](ah-6.3.md)
- [ah-6.2](ah-6.2.md)
- [after-hours-redesign-epic](../product/after-hours-redesign-epic.md)
- [tasks README](README.md)
