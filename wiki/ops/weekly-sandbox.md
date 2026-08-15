# Weekly Sandbox — тестування master-флоу без прода

Summary: як прогнати `editorial_master` локально на реальних даних, не чіпаючи прод-БД,
і як за хвилину перевірити провайдерів перед тим, як витрачати Actions-прогін.
Sources: `pipeline/scripts/weekly-master-sandbox.ts`, `pipeline/scripts/weekly-doctor.ts`,
live sandbox-прогони 2026-08-09 на фікстурі `ai-weekly-2026-08-02`,
content-sim / illustration overhaul 2026-08-11, semantic illustration v5,
weekly illustration M2 post-upload QA 2026-08-15
Last updated: 2026-08-15

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
npm run weekly:sandbox -- run --fixture <path> --resume artifacts/_local/weekly-sandbox/<ts>
```

Викликає `runWeeklyMaster` ([weekly-master-engine](../pipeline/weekly-master-engine.md))
**без хендла БД**: справжні посегментні промпти, справжня драбина провайдерів, справжній
критик і справжній цикл точкового ремонту — але жодного лізу, ревізії, артефакту чи рядка
в cost-ledger. Пише в `artifacts/_local/weekly-sandbox/<timestamp>/`: `state.json`
(оновлюється **після кожного сегмента** — локальний аналог durable checkpoint у проді),
`bundle.json`, `quality.json`, `unresolved.json`, `run.json` (потайм, модель, токени й
вартість на кожен виклик).

- `--resume <dir>` — продовжити перерваний прогін із його `state.json`. Прогін можна вбити
  будь-коли: уже написані сегменти не оплачуються вдруге. Це той самий механізм, яким
  користується прод-воркер, тож сендбокс перевіряє і його.
- `--order <chain>` — перевизначає `WEEKLY_MASTER_PROVIDER_ORDER` для одного прогону.
- Локальна автентифікація Claude CLI: `CLAUDE_CLI_USE_LOCAL_AUTH=1` замість того, щоб
  класти ще один довгоживучий токен у dotfile. На раннері цю змінну не ставити ніколи.
- Прогін завершується `PAUSED` (exit 1) лише коли не вдалось дописати сегмент або вийшов
  бюджет часу; недосяжна планка якості дає `NEEDS REVIEW` із переліком `unresolved` —
  у проді це неактивна draft-ревізія і **успішна** джоба, не провал.

### `gates` — детерміністичні валідатори, безкоштовно

```bash
npm run weekly:sandbox -- gates --fixture <path> --run artifacts/_local/weekly-sandbox/<ts>
```

Ганяє `validateMasterBundle` по збереженому bundle. Нуль викликів моделі, миттєво —
це петля для правок правил гейтів, а не для правок промпта. Від 2026-08-09 рушій сам
проганяє ці ж валідатори й лагодить блокери **до** першого виклику критика, тож `gates`
лишається діагностикою правил, а не єдиним захистом.

Для images використовуй окремий `npm run content-sim -- run --adapter weekly-image --fixture …`.
Policy `weekly-semantic-story-v5.1` вимагає у fixture original summary/why/practical/limitation/
takeaway/claims і generated context/meaning/mechanism/consequence/visual thesis. Critic має
повернути всі чотири semantic scores; відсутній score fail-closed дорівнює 0. Repair directive у
prod застосовується до наступного FLUX render, тоді як offline fixture повторно оцінює ті самі
captured pixels і придатна насамперед для rubric/backtest. (source:
`src/lib/content-sim/adapters/weekly-image-fixture.ts`, `weekly-image.ts`, `vision-critic.ts`)

## Що ці інструменти вже знайшли (2026-08-09)

Перший же прогін `--only english` відтворив реальний збій локально за 138 секунд і за
центи: найдешевша модель, що проходить quality-floor (`tencent/hy3-preview`), стабільно
віддає **повну валідну статтю на 31k символів із однією зайвою лапкою у відкривальній
дужці** (`{"article":{"`) — `JSON.parse` падає на позиції 16, і фолбеку не було, бо
`premiumOpenRouterModels` віддавав рівно одного кандидата. Відтворилось двічі поспіль —
це дефект моделі, не випадковість.

Той самий прогін показав, що doctor заробив свій хліб: `claude-cli` локально не
автентифікований («OAuth session expired»), і це видно за 40 секунд, а не за 40 хвилин.

Повний прогін master-а на тій самій фікстурі (через OpenRouter, бо CLI локально без авторизації)
пройшов **end-to-end за 28 хвилин, 9 викликів провайдера, $0.032 сумарно** — EN → UK → critic →
2 раунди revise → critic, із реальним quality-звітом на виході (74/100, gate FAIL на трьох
редакційних причинах — гейти працюють, це не збій). Орієнтир по кроках:

| Крок | Час | Модель |
|---|---|---|
| english | 204 с | `z-ai/glm-5.2` (після падіння `hy3-preview`) |
| ukrainian | 251 с | `tencent/hy3-preview` |
| critic | 130–295 с | `z-ai/glm-5.2`, `openai/gpt-5.6-luna` |
| revisions | 101–240 с | `tencent/hy3-preview` |

Саме тут вимірялось головне: два critic-виклики мали `first_token_ms` 120.4 с і 116.6 с — вище
90-секундного ліміту, і за старим кодом були б убиті як «зависання».

Post-upload QA (M2) — це прод Visuals після ручного upload, не sandbox-прогін.
D3 додає код `human_dignity_risk` у той самий critic; sandbox цього не ганяє.
E2 додає другий (story-aware) виклик лише в auto-циклі `render`, не в sandbox doctor.
E3 рахує якість промптів у прод Visuals; sandbox цього не ганяє.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) M2/D3/E2/E3)

## Related pages

- [pipeline/content-sim](../pipeline/content-sim.md) — універсальний harness (images + daily + hypothesis); `npm run content-sim`; weekly v4 critic gate-ить context / mechanism / consequence / instant comprehension
- [pipeline/weekly-master-engine](../pipeline/weekly-master-engine.md) — ітеративний рушій, який цей сендбокс ганяє
- [pipeline/weekly-master-failures](../pipeline/weekly-master-failures.md) — розбір збоїв 09.08 і що виправлено
- [ops/weekly-admin-runbook](weekly-admin-runbook.md) — як вести випуск у адмінці
- [pipeline/weekly-digest](../pipeline/weekly-digest.md) — Content Studio v2
- [pipeline/llm-providers](../pipeline/llm-providers.md) — реєстр провайдерів
