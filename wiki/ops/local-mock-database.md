# Локальна mock-база даних для тестування редизайну

Summary: Як запустити сайт проти локальної mock-бази в цьому checkout: знімок публічного контенту prod Supabase плюс синтетичні крайові випадки. Рушій і дані gitignored і не лежать в окремому worktree.
Sources: `scripts/mock-db/` (локально, gitignored), знімок prod через anon-ключ 2026-09-30, копія з worktree `claude/local-mockup-database-testing-2d571f` 2026-10-01, `.gitignore`
Last updated: 2026-10-01

---

## Навіщо

Редизайн After Hours ([epic](../product/after-hours-redesign-epic.md)) треба перевіряти на різноманітному
динамічному контенті: довгі й короткі заголовки, відсутні зображення й переклади, десятки інструментів,
порожні категорії, випуски з одним і з тридцятьма матеріалами. Реальний архів такого не містить: за знімком
2026-09-30 жоден з 753 опублікованих матеріалів не має відео, усі мають обидві мови, найдовший заголовок
— 130 символів, максимум 9 інструментів на матеріал (source: знімок `brief_items` 2026-09-30).

Mock-база дає ці випадки детерміновано і працює без Docker. Рушій, знімок і зібрана база лежать у цьому
репозиторії локально і не комітяться.

## Де лежить

| Що | Шлях | Git |
| --- | --- | --- |
| Рушій | `scripts/mock-db/` | ignored |
| Знімок prod | `raw/_local/mock-db/snapshot/` | ignored (`raw/_local/*`) |
| Зібрана база | `artifacts/_local/mock-db/` | ignored (`artifacts/_local/*`) |

Окремий worktree для цього не потрібен. Копія зроблена 2026-10-01 з
`.claude/worktrees/ai-today-brief-redesign-epic-290004` (source: копія файлів 2026-10-01).

## Швидкий старт

```bash
npm run dev:mock                        # mock-сервер + next dev на :3000, профіль default
npm run dev:mock -- --profile=empty     # порожній сайт
npm run dev:mock -- --port=3100
```

Знімок уже скопійований. Якщо його немає, один раз:

```bash
npm run mockdb:export
npm run mockdb:build
```

`mockdb:export` читає `.env.local` у цьому checkout. Каталог сценаріїв пишеться в
`artifacts/_local/mock-db/CATALOG.md`.

## Як це влаштовано

`mockdb:export` читає prod anon-ключем лише таблиці й колонки з allowlist `scripts/mock-db/schema.ts`.
`mockdb:build` додає синтетичні сценарії, змодельовані `articles` і плейсхолдер-зображення.
`dev:mock` піднімає Supabase-сумісний HTTP-сервер на `127.0.0.1:54321` і `next dev`, підставляючи його URL.

Сервер розуміє підмножину PostgREST, яку реально використовує сайт: вибір колонок, аліаси, вкладені ресурси,
фільтри `eq/neq/gt/lt/in/is/like/cs/ov` з `not.`, `and`/`or`, сортування з нулями, `limit/offset`, лічильники,
`maybeSingle`; RPC `search_brief_items` і `get_concept_items`; storage; заглушку `auth`. Усе поза підмножиною
повертає помилку у форматі PostgREST. Рушій покрито тестами: `npm run mockdb:test`.

## Що реальне, що синтетичне

- Реальне (знімок 2026-09-30): 9 категорій, 26 концептів, 166 випусків, 753 матеріали, 662 зв'язки
  матеріал-концепт, 10 daily-візуалів, 4 weekly-дайджести з ревізіями й артефактами.
- Змодельоване: `articles`. У prod таблиця недоступна для anon через RLS, тож джерела генеруються з
  реального розподілу назв; посилання ведуть на зарезервований домен `.example`.
- Синтетичне: id починається з `feedface-`, slug — з `mock-`.

Профілі: `default` (знімок і синтетика), `real`, `empty`, `sparse`, `stress`, `edge-first`.
Дати зсуваються цілими тижнями так, щоб найновіший випуск був «сьогодні» (`MOCK_DB_TODAY`, `MOCK_DB_REBASE=0`).

## Безпека

`dev:mock` перезаписує для дочірнього процесу всі Supabase URL і ключі й обнуляє service-role. Навіть якщо в
корені лежить справжній `.env.local`, цей dev-сервер не може ні читати, ні писати в prod. Mock лише для
читання: POST, PATCH і DELETE до таблиць повертають 403. Кеш даних Next чиститься при старті `dev:mock`.
Якщо процес зупинено примусово, перед звичайним `npm run dev` виконайте `npm run mockdb:clear-cache`.

## Обмеження

Не працюють запис, вхід, адмінка і завантаження weekly PDF. Пошук — наближення до Postgres FTS.
Зображення реальних матеріалів і weekly вантажаться з prod. Знімок старіє: оновлюйте `mockdb:export` і
`mockdb:build`, коли потрібні свіжі реальні матеріали.

## Related pages

- [after-hours-redesign-epic](../product/after-hours-redesign-epic.md)
- [after-hours-epic-handoff](../product/after-hours-epic-handoff.md)
- [mcp](mcp.md)
- [weekly-sandbox](weekly-sandbox.md)
