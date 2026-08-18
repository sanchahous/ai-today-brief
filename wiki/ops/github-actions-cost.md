# GitHub Actions — вартість і профіль CI

Summary: скільки Actions-хвилин палив репозиторій до переходу в public, які саме workflow це
робили, і чому після 2026-08-18 обмеженням став час очікування PR, а не гроші.
Sources: GitHub REST live check 2026-08-18 (`/actions/runs`, `/actions/runs/{id}/timing`,
`/actions/caches`, `/actions/permissions`), `.github/workflows/e2e.yml`, `playwright.config.ts`,
`.github/dependabot.yml`
Last updated: 2026-08-18

---

## 1. Що виміряно

Вікно **2026-08-03 … 2026-08-17** (14 днів). GitHub віддає максимум 1000 останніх ранів на
репозиторій, тому 30-денне вікно недосяжне — 1000 ранів вкрилися саме за два тижні.

> ⚠️ Поле `billable` у `/actions/runs/{id}/timing` для цього репозиторію повертає
> `duration_ms: 0` на всіх ранах — довіряти йому не можна. Хвилини рахувалися з
> `run_duration_ms` того ж ендпоінта, округленого вгору до хвилини (так GitHub білить job).
> Звірено з `gh pr checks 282`: збігається.
> (source: GitHub REST live check 2026-08-18)

| Workflow | Хвилин / 14 днів | Ранів | Середнє |
|---|---|---|---|
| E2E (Playwright) | **1558** (39%) | 103 | 15.1 |
| Weekly generation worker (+ стара назва «Weekly master CLI worker») | 803 (20%) | 60 | 13.4 |
| SonarQube | 422 (11%) | 111 | 3.8 |
| Daily Pipeline | 348 (9%) | 85 | 4.1 |
| Deps integrity | 237 (6%) | 236 | 1.0 |
| Trend signals | 45 | 14 | 3.2 |
| **Разом** | **≈3950** | 997 | |

≈3950 хв / 14 днів ≈ **8200 хв/міс** при 3000 включених у план — це і був рахунок.

**Dependabot Automerge не витрачає нічого.** 148 ранів, але job має
`if: github.actor == 'dependabot[bot]'`, і на чужому PR він `skipped` — GitHub білить такий job
у нуль. Те саме зі 81 миттєво-червоним раном мертвих `visual-compiler-*`. Їх немає в таблиці
саме тому. (source: `/actions/runs/{id}/timing` → `duration_ms: 0`)

Dependabot загалом дав лише 98 хв за два тижні — каданс уже зведено до weekly з групуванням
(`.github/dependabot.yml`), і це працює.

## 2. Справжній драйвер — кількість PR

**120 PR за 14 днів** (92 змержено, 27 закрито без мержу, 1 відкритий) — ≈8.5/день, майже все з
агентних гілок `fix/` `feat/` `codex/` `claude/`. Кожен PR у `main` тягне
e2e + sonar + deps-integrity. Тобто CI-профіль — це похідна від темпу роботи, а не від
неохайності workflow: самі файли вже мали `paths-ignore`, `concurrency` з `cancel-in-progress`
і PR-only тригери. (source: `gh pr list` live check 2026-08-18)

## 3. Чому один e2e коштував 15 хв

Профіль кроків успішного рану (`/actions/runs/{id}/jobs`, 2026-08-18):

| Крок | Час |
|---|---|
| Run E2E tests | **655–678 с** |
| Build | **141–371 с** |
| Install Playwright browsers | 44–84 с |
| npm ci + setup | ≈25 с |

Три причини:

1. **339 тестів × 3 движки серійно.** `workers: 1` на CI було правильним для приватного
   раннера (2 ядра — Playwright і сам дав би 1), але це робить матрицю лінійною.
2. **Білд без кешу.** `.next/cache` не кешувався взагалі, тож кожен ран компілював з нуля.
3. **Кеш браузерів не влучав жодного разу.** Ключ зберігався під `refs/pull/N/merge`, а такий
   кеш **невидимий іншим PR** — на `main` e2e не бігав і спільного кешу не існувало. Наслідок:
   467 МБ × ~20 записів, разом **24 записи / 10.6 ГБ при ліміті 10 ГБ**, які ще й витісняли
   npm-кеш. (source: `/actions/caches` live check 2026-08-18)

## 4. Що змінив перехід у public (2026-08-18)

Власник перевів репозиторій у **public**. Це прибирає проблему грошей повністю:

- Actions на GitHub-hosted **standard runners для public-репозиторіїв безкоштовні й
  безлімітні** — жоден пункт таблиці §1 більше не конвертується в рахунок;
- `ubuntu-latest` стає **4-ядерним / 16 ГБ** замість 2-ядерного / 7 ГБ.

**Наслідок для планування:** оптимізувати треба **час очікування PR**, а не хвилини. Будь-яка
пропозиція зрізати покриття заради економії хвилин після 2026-08-18 не має підстав.

Витрачені до переходу хвилини поточного білінг-циклу не повертаються. Якщо в акаунті є інші
приватні репозиторії — вони далі їдять ту саму квоту.

## 5. Що зроблено

- **Кеші розділено на `restore` / `save`** (`actions/cache/restore` + `actions/cache/save`):
  PR лише читають, пише тільки ран на `main`. Це лікує і промах кеша, і переповнення 10 ГБ.
- **`push: [main]`** повернуто в `e2e.yml` — головно щоб прогрівати ці кеші на default-гілці
  (побічно ловить регресію, що виникає лише коли два PR лягли поруч).
- **Кеш `.next/cache`** доданий — інкрементальний білд замість холодного.
- **`workers: 1 → 2`** у `playwright.config.ts` — два воркери вміщаються поруч із `next start`
  на 4 ядрах.
- **`timeout-minutes: 40`** на e2e (стелі не було) + Telegram-алерт на падіння в `main`.
- **`paths-ignore` перенесено з `on:` всередину job** (e2e і sonarqube). Причина не в
  швидкості: workflow, пропущений фільтром шляхів, **не репортує чек узагалі**, тому
  docs-only PR завис би назавжди на «Expected — waiting for status», щойно чек стане
  required на `main`. Тепер workflow запускається завжди, першим кроком читає список файлів
  з API (без checkout) і на нерелевантному PR завершується зеленим за ~10 с.
- **Secret scanning + push protection увімкнено.** Історію перевірено окремо: 856 комітів,
  жодного ключа, `.env`/`.env.local` ніколи не трекались, скан дав **0 алертів**.
  (source: `gh api repos/.../secret-scanning/alerts` live check 2026-08-18)

### Виміряний результат

Перший живий ран після змін (PR #290, Actions run `32110561999`) — **455 с проти 1175 с**
на попередньому PR #282, тобто **19.6 → 7.6 хв**:

| Крок | Було | Стало |
|---|---|---|
| Run E2E tests | 655–678 с | **276 с** |
| Build | 141–371 с | **59 с** |
| Install Playwright browsers | 44–84 с | 95 с (кеш ще холодний) |

Білд за 59 с при **холодному** кеші (`Restore` віддав 0 с — на `main` запису ще не було)
емпірично підтверджує 4-ядерний раннер. Кеші почнуть віддавати після першого ж рану на
`main`, що зніме ще ~95 с. (source: `/actions/runs/32110561999/jobs` live check 2026-08-18)

Свідомо **не** чіпалося: частота продуктових кронів (`Daily Pipeline` 6/день —
рішення PR #128 про свіжість брифу; `Weekly generation worker` — реальна LLM-генерація),
`npm run build` у SonarQube (дублює Vercel preview build, але Sonar не на критичному шляху PR),
`Deps integrity`.

## 6. Захист гілки `main`

До 2026-08-18 гілка `main` **не була захищена взагалі** — `GET /branches/main/protection`
віддавав 404. Два місця в репозиторії спиралися на протилежне і були хибними:

- `deps-integrity.yml` у шапці називає себе «suitable to mark as a required status check on
  `main` so a broken lockfile can never merge» — required-чеком він не був;
- `dependabot-automerge.yml` прямо стверджує «Branch protection already gates the squash on
  required checks — enabling auto-merge is enough». Передумова хибна: без захисту
  `gh pr merge --auto --squash` міг завести patch/minor-бамп у `main` без жодної зеленої
  перевірки.

Саме тому фільтр шляхів довелося перенести всередину job (§5): без цього required-чеки
вішали б будь-який docs-only PR. (source: `gh api .../branches/main/protection` live check
2026-08-18)

**Застосовано 2026-08-18**, одразу після мержу PR #290 (мерж був передумовою — required-чеки
мають спершу почати репортуватись завжди):

| Правило | Значення | Чому саме так |
|---|---|---|
| Required checks | `Clean install (npm ci)`, `Playwright smoke`, `SonarQube Scan` | Vercel навмисно **не** required — зовнішній сервіс і власний гейт деплою |
| `strict` (up-to-date з `main`) | **false** | При ~8.5 PR/день `true` означав би, що кожен мерж інвалідує решту PR і вимагає ребейзу |
| Обов'язкові review | **немає** | Єдиний мейнтейнер; GitHub не дає апрувити власний PR, тож вимога заблокувала б усі мержі |
| `enforce_admins` | **false** | Свідомий обхід в аварії лишається можливим |
| Force-push / видалення гілки | **заборонені** | |
| Лінійна історія | **так** | Squash-merge і так де-факто |

**Перевірено функціонально, не за документацією.** `git push --dry-run` для цього не годиться —
він показує клієнтський прогноз і server-side protection не проганяє. Реальний доказ дав
dependabot-PR #273: після мержу #290 усі три required-чеки на ньому зелені, причому
`Playwright smoke` пройшов **швидким шляхом за 10 с** (крок рішення 2 с, усі важкі кроки
`skipped`) — саме та поведінка, заради якої фільтр переїхав усередину job. До цього на #273
чеків `Playwright smoke` / `SonarQube Scan` не існувало взагалі, і під захистом він завис би.
(source: Actions run `32112884552`, `gh pr view 273 --json statusCheckRollup` live check
2026-08-18)

### Кеші прогрілися

Перший ран на `main` після мержу (`32112674915`) уперше записав кеш під `refs/heads/main`:
`playwright-Linux-1.62.1` 467 МБ і `nextjs-…-a0cd37f` 80 МБ. Відтепер PR їх **відновлюють**, а
не створюють власні копії — тобто і промах кеша, і переповнення 10 ГБ закриті одним механізмом.
(source: `gh api repos/.../actions/caches` live check 2026-08-18)

## 7. Відкрите

**`dependabot_security_updates` увімкнено власником 2026-08-18** (разом із secret scanning і
push protection — усі три перевірені читанням `security_and_analysis`). Три алерти на
`main` лишаються відкритими, PR на них Dependabot ще не відкрив:

| Severity | Пакет | Уразливо | Патч | Суть |
|---|---|---|---|---|
| high | `nanoid` | < 3.3.18 | 3.3.18 | нескінченний цикл у custom-генераторі при size = 0 |
| high | `pdfjs-dist` | ≥ 5.6.83, < 6.2.108 | 6.2.108 | виконання довільного JS при відкритті зловмисного PDF |
| medium | `postcss` | ≤ 8.5.22 | 8.5.23 | читання довільних `.map` через `sourceMappingURL`, коли `from` не заданий |

`pdfjs-dist` заслуговує окремої уваги: репозиторій **рендерить** PDF (`weekly:pdf:sample`,
LinkedIn document), і `pdfkit` уже стоїть на паузі в `.github/dependabot.yml` через BREAKING
notes — тобто бамп потребує ручної перевірки, а не автомержу.
(source: `gh api repos/.../dependabot/alerts` live check 2026-08-18)

Решта відкритого:
- Форків поки 0. Коли з'являться — треба вирішити, чи ганяти e2e на fork-PR: секретів вони не
  отримують (`NEXT_PUBLIC_SUPABASE_URL` буде порожній), тож впадуть без користі.

## Related pages

- [ops/owner-checklist](owner-checklist.md) — env-матриця і launch-блокери
- [ops/vercel-image-quota](vercel-image-quota.md) — сусідній інцидент про квоти платформи
- [pipeline/content-sim](../pipeline/content-sim.md) — опційний CI-workflow за міткою
- [now](../now.md) — поточний операційний стан
