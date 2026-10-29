# Перевірки за зміненими шляхами (`check:affected`)

Summary: яку перевірку запускає яка зміна — локально (`npm run check:affected`, pre-push hook) і в CI на PR; коли все одно йде повний набір і чому невідомий шлях = повний набір.
Sources: `scripts/check-scope.mjs`, `scripts/check-affected.mjs`, `scripts/check-scope.test.mjs`, `.githooks/pre-push`, `package.json`, `.github/workflows/affected-checks.yml`, `.github/workflows/deps-integrity.yml`, `.github/workflows/migrations-drift.yml`, `.github/workflows/e2e.yml`, `.github/workflows/sonarqube.yml`, GitHub branch protection live check 2026-10-29
Last updated: 2026-10-29

---

## Навіщо

До 2026-10-29 правило було «перед будь-яким push — `npm run pr:check`»: design ratchet,
coverage, typecheck, повний lint, e2e map, wiki:check, migrations, script-тести і `build:ci`
на кожну зміну, навіть на один рядок у компоненті. Тепер перед push запускається лише те, що
стосується змінених файлів. Повний набір лишився — для широких і невідомих змін.

## Команди

| Команда | Що робить |
|---|---|
| `npm run check:affected` | дифф гілки від найближчої з `origin/main` / `origin/next` (гілка від `next` — від `next`) + робоче дерево → лише потрібні перевірки, fail-fast |
| `npm run check:affected -- --dry-run` | показати план, нічого не запускати |
| `npm run check:affected -- --files a,b --dry-run` | «що запуститься, якщо змінити a і b?» |
| `npm run check:affected -- --no-e2e` (або `SKIP_E2E=1`) | усе, крім Playwright |
| `npm run pr:check` | повний набір = `check:affected --all --no-e2e` (той самий раннер) |

Pre-push hook викликає `check:affected`. Якщо це саме дерево вже пройшло перевірки (агент
запустив їх перед push), hook закінчується одразу — штамп у git dir прив’язаний до хешу дерева
і бази диффу. `SKIP_CHECKS=1 git push` вимикає hook повністю; CI на PR все одно ганяє ту саму мапу.

## Мапа «шлях → перевірки»

Джерело правди — `RULES` і `BROAD_RULES` у `scripts/check-scope.mjs`; таблиця нижче — короткий
переказ. Перевірки всіх правил, що збіглися, об’єднуються.

| Змінений шлях | Перевірки |
|---|---|
| `wiki/**`, `*.md`, `raw/`, `artifacts/`, `experiments/`, `library/` | `wiki:check` |
| `.cursor/`, `.agents/`, `.claude/`, `.githooks/`, метадані репо, `vercel.json` | нічого |
| `src/app/**`, `src/components/**` (код) | typecheck, eslint на змінених файлах, `vitest related`, design ratchet, e2e map, `e2e:affected` |
| CSS-модуль у `src/` | design ratchet, e2e map, `e2e:affected` |
| `src/lib/**` у межах coverage scope (`LOGIC_INCLUDE` у `vitest.config.ts`) | typecheck, eslint, `ci:check` (coverage ≥70%), e2e |
| `*.test.ts` | typecheck, eslint, `vitest related` (сам тест) — без build і e2e |
| `pipeline/**` | typecheck, eslint, `ci:check`; не-код (промпти) → `ci:check` |
| `supabase/migrations/**` | `migrations:check`, `wiki:check` (лічильник міграцій) |
| `e2e/**` | e2e map, сам spec, typecheck, eslint |
| `scripts/**` | `node --test scripts/*.test.mjs`, typecheck, eslint; плюс точкові (design ratchet, migrations, e2e map) |
| `.github/**` | script-тести (вони звіряють гейти workflow з мапою) |
| будь-що, що стежить `wiki/_meta/project-sync.json` | + `wiki:check` (виводиться з контракту) |

`e2e:affected` сам вирішує, які spec-и запускати, і сам робить build, якщо сервера немає.
Тому окремий `build:ci` іде лише тоді, коли e2e нічого не вибрав або вимкнений.

## Коли повний набір

- **Широкі шляхи:** `package.json`, lockfile, `.npmrc`/`.nvmrc`, `tsconfig*.json`,
  `next|eslint|vitest|playwright|postcss|tailwind.config.*`, `src/app/layout.tsx`,
  `src/app/[lang]/layout.tsx`, `src/app/globals.css`, `src/lib/i18n.ts`, `src/proxy.ts`,
  `src/test/`, `src/types/`, і сам селектор (`check-scope.mjs`, `check-affected.mjs`,
  `ssg-build-scope.mjs`) — гейт не може ручатися сам за себе.
- **Невідомий шлях** — файл, що не збігся з жодним правилом (нова тека в корені тощо). План
  друкує причину; щоб це прибрати, додайте правило в `check-scope.mjs`.
- Git-стан не читається (немає `origin/main`).
- Не розпарсився `vitest.config.ts` → будь-який код іде через повний coverage; не прочитався
  контракт wiki → `wiki:check` іде на кожну зміну.

## Приклади (`--dry-run`, 2026-10-29)

| Зміна | Що запускається |
|---|---|
| `wiki/now.md` | 1 перевірка: `wiki:check` (~3 с) |
| `src/components/brand/brand-stage.tsx` | e2e map, design ratchet, typecheck, eslint на одному файлі, `vitest related`, `e2e:affected` → 3 spec-и (a11y matrix, smoke, layout) |
| `pipeline/rank.ts` | typecheck, eslint на одному файлі, `ci:check` |
| `supabase/migrations/…sql` | `wiki:check`, `migrations:check` |
| `package.json` | повний набір (10 перевірок, e2e — усі spec-и) |

Заміри на worktree 2026-10-29: typecheck ≈20 с, повний eslint ≈43 с (один файл ≈7 с),
`ci:check` ≈23 с, `wiki:check` ≈3 с; найдорожчі — build і Playwright.

## CI на PR

Required checks на `main`: `Clean install (npm ci)`, `Playwright smoke`, `SonarQube Scan`
(source: GitHub branch protection live check 2026-10-29). Жоден workflow не має фільтра
`paths:` в `on:` — пропущений так workflow не звітує, і required check висить «Expected».
Гейт живе всередині job: job завжди стартує й завжди звітує success, а важкі кроки
пропускаються.

| Workflow | Job | На PR запускає роботу, коли… | Push / розклад |
|---|---|---|---|
| `affected-checks.yml` (новий) | Affected checks | мапа `--ci` щось вибрала: typecheck, eslint, wiki:check, e2e map, script-тести; `npm ci` лише якщо потрібен | push у `main`/`next` — увесь статичний набір (`--all`) |
| `e2e.yml` | Playwright smoke | змінено site-шлях; spec-и вибирає `e2e:affected --ci-plan` | push у `main` — повна матриця 3 браузерів |
| `sonarqube.yml` | SonarQube Scan | змінено код (включно з `pipeline/`): design ratchet, coverage, `build:ci`, скан | — |
| `deps-integrity.yml` | Clean install (npm ci) | змінено `package.json`, lockfile, `.npmrc`, `.nvmrc` | push у `main` — завжди |
| `migrations-drift.yml` | origin/main vs prod | змінено `supabase/migrations/` або сам checker | push у `main` + щодня 05:17 UTC |

Регулярки гейтів у `e2e.yml`, `sonarqube.yml`, `deps-integrity.yml`, `migrations-drift.yml`
закріплені тестом `scripts/check-scope.test.mjs` (`WORKFLOW_GATES`): змінили одну — тест падає,
доки не зміните другу.

`Affected checks` ще не required — це рішення власника в налаштуваннях захисту гілки.

## Related pages

- [e2e-local](e2e-local.md)
- [github-actions-cost](github-actions-cost.md)
- [agentic-workflow](../architecture/agentic-workflow.md)
