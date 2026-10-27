# ATB-90

Summary: Задачі мерджаться в інтеграційну гілку next; продакшн лишається на main. Vercel не деплоїть feat/* і next. CI-перевірки pull request запускаються і на PR у next.
Sources: [PR #457](https://github.com/sanchahous/ai-today-brief/pull/457); `vercel.json`; `.github/workflows/e2e.yml`; `.github/workflows/sonarqube.yml`; `.github/workflows/migrations-drift.yml`; `.github/workflows/deps-integrity.yml`
Last updated: 2026-10-27

---

Task: atb-90

## Status

```verbatim
- **ATB-90:** Деплої Vercel вимкнено для feat/* і next; main лишається продакшном. Playwright smoke, SonarQube Scan і migrations drift репортять на PR у next. Clean install і раніше йшов на кожен PR.
```

DONE. PR: [#457](https://github.com/sanchahous/ai-today-brief/pull/457).

## Change

- `vercel.json` `git.deploymentEnabled`: `main` true, `next` false, `feat/*` false (minimatch). Незадані гілки лишаються з дефолтом true. `ignoreCommand` не змінювався.
- `on.pull_request.branches` тепер `[main, next]` у `e2e.yml`, `sonarqube.yml`, `migrations-drift.yml`. `push` лишився лише `main` (кеш e2e і зріз drift проти продакшну).
- `deps-integrity.yml` уже має `pull_request` без фільтра гілок, тож Clean install (npm ci) на PR у next вже запускався. Фільтр не звужували.
- Drift-job і на PR у next порівнює `origin/main` із продом, не міграції, які є лише на next. (source: `scripts/check-prod-migrations.ts`)

## Local gates

- `PORT=3100 npm run pr:check` — exit 0 (2026-10-27). Vitest 2361/2361; `build:ci` зібрав мінімальний prerender, бо `vercel.json` вважається site-файлом.
- `PORT=3100 npm run e2e:affected` — exit 0; skipped (no UI-affecting paths).

## Next task

None from ATB-90. Окремо від репозиторія: якщо merge у `next` має блокуватись тими самими required checks, що й `main`, це правила захисту гілки в GitHub, не workflow.
