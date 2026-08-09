# Weekly Sandbox — тестування master-флоу без прода

Summary: як прогнати `editorial_master` локально на реальних даних, не чіпаючи прод-БД,
і як за хвилину перевірити провайдерів перед тим, як витрачати Actions-прогін.
Sources: `pipeline/scripts/weekly-master-sandbox.ts`, `pipeline/scripts/weekly-doctor.ts`,
live sandbox-прогони 2026-08-09 на фікстурі `ai-weekly-2026-08-02`
Last updated: 2026-08-09

---

## Навіщо

До 2026-08-09 `editorial_master` можна було перевірити рівно одним способом: диспатчити
GitHub Actions проти прода і через 5–40 хвилин прочитати один рядок помилки. Через це
кожна зміна промпта, провайдера чи гейта була push-наосліп, а три поспіль провалені
джоби 09.08 не давали жодного придатного до дії сигналу
(source: [pipeline/weekly-master-failures](../pipeline/weekly-master-failures.md)).

Sandbox розриває цю петлю на дві частини: **дешеву перевірку конфігурації** (секунди) і
**повний реальний прогін на прод-даних без записів у прод** (хвилини).

## 1. `npm run weekly:doctor` — префлайт провайдерів

Перевіряє все, від чого залежить master-write, і **нічого не пише**:

| Перевірка | Що ловить |
|---|---|
| `claude-cli token` / `binary` / `call` | немає токена, немає бінарника, протухла OAuth-сесія |
| `openrouter credit` | вичерпаний баланс (fail ≤ $1, warn < $5) |
| `openrouter stream` | скільки мілісекунд модель стрімить `reasoning` до першого `content` — і як це співвідноситься з лімітом first-token |
| `provider order` | одинокий провайдер у ланцюжку = таймаут вбиває джобу без фолбеку |
| `content studio`, Supabase creds | джоба впаде ще до генерації |

```bash
npm run weekly:doctor
```

`-- --skip-live` виконує лише конфігураційні перевірки, без жодного платного виклику.

Той самий скрипт стоїть першим кроком у `weekly-master-cli-worker.yml` із
`continue-on-error: true` — **діагностика, не гейт**: хибнопозитив не має блокувати випуск,
але лог тепер відкривається рядком «CLI не автентифікований», а не ховає це під 40 хвилинами
генерації.

## 2. `npm run weekly:sandbox` — реальний прогін офлайн від БД

Три команди.

### `capture` — знімок реального входу (read-only з прода)

```bash
npm run weekly:sandbox -- capture --digest <weekly_digest_id>
```

Кладе `raw/_local/weekly-sandbox/<slug>.json`: `stories` + approved `researchPacks` +
`retryGuidance` — рівно те, що прод згодував би LLM. Збирається **воркеровими ж
лоадерами** (`loadMasterGenerationInput` у `generation-worker.ts`), а не паралельним
запитом: фікстура, яка розійшлася б із тим, що шле воркер, гірша за відсутність фікстури.

Це єдина команда, що торкається прода, і лише на читання. `raw/_local/` — git-ignored.

### `run` — генерація на фікстурі

```bash
npm run weekly:sandbox -- run --fixture raw/_local/weekly-sandbox/ai-weekly-2026-08-02.json
npm run weekly:sandbox -- run --fixture <path> --only english --order openrouter
```

Викликає `generateWeeklyMaster` **без хендла БД**: справжні промпти, справжня драбина
провайдерів, справжній критик і revise-loop — але жодного лізу, ревізії, артефакту чи
рядка в cost-ledger. Пише в `artifacts/_local/weekly-sandbox/<timestamp>/`:
`english.json`, `ukrainian.json`, `bundle.json`, `quality.json`, `run.json`
(потайм на кожен виклик провайдера, модель, токени, вартість), `error.json` при падінні.

- `--only english` — зупинитись після англійського write. Найдешевша петля, і саме той
  крок, що падав.
- `--order <chain>` — перевизначає `WEEKLY_MASTER_PROVIDER_ORDER` для одного прогону.
- Локальна автентифікація Claude CLI: `CLAUDE_CLI_USE_LOCAL_AUTH=1` замість того, щоб
  класти ще один довгоживучий токен у dotfile. На раннері цю змінну не ставити ніколи.

### `gates` — детерміністичні валідатори, безкоштовно

```bash
npm run weekly:sandbox -- gates --fixture <path> --run artifacts/_local/weekly-sandbox/<ts>
```

Ганяє `validateMasterBundle` по збереженому bundle. Нуль викликів моделі, миттєво —
це петля для правок правил гейтів, а не для правок промпта.

## Що ці інструменти вже знайшли (2026-08-09)

Перший же прогін `--only english` відтворив реальний збій локально за 138 секунд і за
центи: найдешевша модель, що проходить quality-floor (`tencent/hy3-preview`), стабільно
віддає **повну валідну статтю на 31k символів із однією зайвою лапкою у відкривальній
дужці** (`{"article":{"`) — `JSON.parse` падає на позиції 16, і фолбеку не було, бо
`premiumOpenRouterModels` віддавав рівно одного кандидата. Відтворилось двічі поспіль —
це дефект моделі, не випадковість.

Той самий прогін показав, що doctor заробив свій хліб: `claude-cli` локально не
автентифікований («OAuth session expired»), і це видно за 40 секунд, а не за 40 хвилин.

## Related pages

- [pipeline/weekly-master-failures](../pipeline/weekly-master-failures.md) — розбір збоїв 09.08 і що виправлено
- [ops/weekly-admin-runbook](weekly-admin-runbook.md) — як вести випуск у адмінці
- [pipeline/weekly-digest](../pipeline/weekly-digest.md) — Content Studio v2
- [pipeline/llm-providers](../pipeline/llm-providers.md) — реєстр провайдерів
