# Перевірка motion-концептів

Дата: 2026-09-25. Середовище: Codex in-app Chromium, локальний HTTP-прототип.

## Перевірено у браузері

- Усі три перемикачі оновлюють концепт, `aria-pressed`, назву сторінки й URL; елементи та ілюстрації завантажені.
- Desktop EN/Night і mobile 390×844 UK/Night та UK/Day: фактичні screenshots у `screens/`, без горизонтального переповнення у перевірених станах.
- Додаткова перевірка ширин 320 і 768 px: горизонтального переповнення немає.
- Replay; режим Motion off/on; опис концепту; закриття опису через Escape.
- Перемикання EN/UK і Day/Night; українська таблиця опису концепту.
- Мобільне меню відкривається; Escape закриває його.
- Головна → стаття → browser Back: концепт збережений, ілюстрація доступна.
- Tab переходить між керуванням; `:focus-visible` присутній у клавіатурному стані.
- Demo newsletter приймає `preview@example.com` і прямо повідомляє, що лист не надсилався.
- Панель порівняння залишається доступною після прокручування до newsletter (`top = 0`).
- Консоль браузера: жодних зафіксованих error/warn під час перевірених сценаріїв.

## Перевірено в коді

- `node --check` для `motion.js` і `serve.mjs`.
- `npm run wiki:check` пройшов: project-sync 0 error / 0 warn, 6 helper tests pass, wiki-lint 0 error / 22 warn у раніше наявних сторінках. Перелік нижче; сторонні сторінки не змінювались.
- CSS і JS читають `prefers-reduced-motion`; системне обмеження не можна обійти перемикачем.
- Кожна WAAPI-анімація має скінченну тривалість; нескінченні цикли не додано. Попередня анімація того самого елемента скасовується, після завершення посилання прибираються.
- Вимкнення руху, зміна сторінки та приховування вкладки скасовують активні анімації. Обробники з попереднього DOM прибирає `AbortController`.
- Контент не прихований у CSS в очікуванні IntersectionObserver; observer лише одноразово підсилює появу видимих секцій.
- Для руху контенту використовуються transform/opacity; для трьох локальних SVG-контурів — stroke. Blur, canvas, RAF-цикл і додаткові бібліотеки відсутні.

## Межі

Системне reduced-motion перевірене в реалізації; примусова емуляція ОС у цьому браузерному інструменті не виконувалася. Режим Motion off перевірений наживо. Не вимірювали FPS/CWV та поведінку на фізичному телефоні, Safari/Firefox, screen reader або слабкому GPU. Desktop-знімки — статичні стани, не відеодоказ плавності. Не заявляємо production-performance або повну WCAG-відповідність.

Зміни обмежені артефактами та wiki. Production build, push і PR не виконувалися. Перед майбутнім push потрібен повний `npm run pr:check`.

## Наявні попередження wiki-lint

Для застарілих сторінок пропозиція — окремо перечитати факти й актуалізувати зміст/дату після перевірки джерел. Автоматичного виправлення не виконано.

1. `analytics/ga4-gsc.md` — потрібні маркери джерел.
2. `architecture/mvp-dev-handoff.md` — застаріла дата.
3. `architecture/prototype-to-production.md` — застаріла дата.
4. `audits/2026-06-10-portal.md` — застаріла дата.
5. `audits/2026-06-12-analytics-gsc.md` — застаріла дата.
6. `marketing/social-launch.md` — застаріла дата.
7. `ops/services-portability.md` — застаріла дата.
8. `ops/supabase-audit-2026-08-20.md` — потрібні маркери джерел.
9. `ops/supabase-audit-2026-08-20.md` — потрібен запис у wiki/index.md.
10. `pipeline/instrumentation-plan.md` — застаріла дата.
11. `pipeline/trend-engine-backtest.md` — застаріла дата.
12. `pipeline/trend-engine.md` — застаріла дата.
13. `product/benchmark-epic-spec.md` — застаріла дата.
14. `product/benchmark-protocol.md` — застаріла дата.
15. `product/responsive-crossbrowser-audit.md` — застаріла дата.
16. `product/responsive-crossbrowser-reference.md` — застаріла дата.
17. `product/toolbox-wave1-spec.md` — застаріла дата.
18. `product/useful-tools-concept.md` — застаріла дата.
19. `strategy/ai-trends-research.md` — застаріла дата.
20. `strategy/master-roadmap.md` — застаріла дата.
21. `strategy/site-updates-plan.md` — застаріла дата.
22. `strategy/startup-plan.md` — застаріла дата.
