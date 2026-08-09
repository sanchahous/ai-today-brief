# Weekly master — розбір збоїв 2026-08-09

Summary: чому три `editorial_master` джоби поспіль впали 09.08, п'ять окремих причин
і що з ними зроблено. Головний висновок: жодна з причин не була редакційною.
Sources: GitHub Actions runs `31312642192`, `31313598133`, `31313601219`, `31299873942`;
live sandbox-прогони на фікстурі `ai-weekly-2026-08-02` (2026-08-09);
`pipeline/claude-cli.ts`, `pipeline/openrouter-adaptive.ts`, `src/lib/weekly-digest/editorial-llm.ts`
Last updated: 2026-08-09

---

## Симптом

Джоба `editorial_master` на `843975a8-8c19-4eca-96a8-035f76eae3ab` падала тричі поспіль
(12:11, 12:33, 12:38 UTC). Адмінка показувала `FAILED`, крок `english`, прогрес ≈2%,
`Code: unknown`, ~4 хвилини Actions time. У списку `gh run list` **усі три прогони —
зелені** (source: Actions runs `31312642192`, `31313598133`, `31313601219`, owner screenshot
2026-08-09).

## Причина 1 — 4-хвилинна стеля `claude-cli`

`DEFAULT_TIMEOUT_MS = 4 * 60_000` у `pipeline/claude-cli.ts`, і жоден викликач її не
перевизначав. Master EN-write — це одна відповідь на ~20k output-токенів по промпту на
~53k символів; після v7-гейтів (PR #199) і копіювання research на ревізію (PR #202) вона
перестала вкладатись у 4 хвилини.

Обидва прогони показали, що CLI **працював** у момент вбивства:
`duration_api_ms` 178 618 і 233 082, 16k і 22.5k вихідних токенів, `stop_reason: tool_use` —
і SIGTERM рівно на 240-й секунді (exit 143). Це не помилка моделі, це секундомір.
(source: worker log Actions run `31313601219`, `pipeline/claude-cli.ts`)

**Фікс:** дефолт 20 хвилин, налаштовується `CLAUDE_CLI_TIMEOUT_MS`; вбивство по таймауту
тепер повідомляється як таймаут («timed out after 240s and was killed»), а не як
обрізаний JSON-конверт, що читається як помилка моделі. Те саме — у
`pipeline/providers/cli-provider.ts` (`CLI_PROVIDER_TIMEOUT_MS`).

## Причина 2 — CLI ганяв агентні цикли там, де потрібен один текст

Обидва вбиті прогони померли зі `stop_reason: "tool_use"` після 3 і 7 turn-ів, з
296 550 cache-read токенами на другому: модель ходила інструментами й перевідсилала
промпт щоразу — заради відповіді, якій не потрібен жоден доступ до файлів. Це і час, і
$0.43–$0.74 за вбиту спробу.

**Фікс:** `--tools ""` у `buildArgs` — документований спосіб вимкнути всі вбудовані
інструменти, що згортає виклик назад до одного turn-у.
(source: конверти Actions runs `31313598133` / `31313601219`; `claude --help` 2.1.220)

## Причина 3 — детектор зависання OpenRouter вважав reasoning тишею

`parseOpenRouterSseChunk` рахував лише `delta.content`. Reasoning-моделі
(`deepseek-v4-pro`, `qwen3.8-max`) спершу стрімлять `delta.reasoning` /
`delta.reasoning_content`, і на великому critic-промпті це триває довше за 90-секундний
`first_token` бюджет. Детектор читав це як мовчання, вбивав модель, ротував на наступну —
і та робила те саме.

Прогін `31299873942` (той, що «succeeded») згорів на цьому **~20 хвилин**: дванадцять
послідовних `first_token timeout … chars: 0` (source: лог Actions run `31299873942`).

**Фікс:** `reasoning` тепер рахується як активність (`reasoningChars`, `firstReasoningMs`),
але **ніколи не потрапляє в `content`**, який парситься. «Працює» = content **або**
reasoning; «завис» = ні того, ні того. Idle-таймер і абсолютна стеля не змінились, тож
модель, що думає вічно, все одно вмирає.

**Доведено наживо.** Повний sandbox-прогін master-а на реальній фікстурі (28 хв, 9 викликів,
$0.032 сумарно) дав два critic-виклики на `z-ai/glm-5.2` з `first_token_ms` **120 362 мс** і
**116 586 мс** — обидва **вище** 90-секундного ліміту, обидва завершились успішно за 129.7 с
і 132.9 с. За старим кодом обидва були б убиті як «мовчазні» рівно на 90-й секунді
(source: `artifacts/_local/weekly-sandbox/2026-08-09T15-34-07-721Z/run.json`, sandbox-прогін
2026-08-09).

Для порівняння, `weekly:doctor` на тривіальному промпті: `deepseek-v4-pro` — перший reasoning
на 1.2 с, перший content на 1.9 с (source: `npm run weekly:doctor` live check 2026-08-09).
Розрив залежить не від моделі, а від розміру промпта: critic отримує ~108k символів.

## Причина 4 — провалена джоба лишала прогін зеленим

`run-weekly-master-cli-worker.ts` логував `outcome: failed` як `warn` і виходив із кодом 0,
якщо джобу вдалося заклеймити. Тому кожен провалений прогін у `gh run list` виглядав
`success`, і дізнатись правду можна було лише відкривши лог або помітивши застряглу джобу
в адмінці. Це і є та сама «робота наосліп».
(source: `pipeline/scripts/run-weekly-master-cli-worker.ts` до фіксу, `gh run list` 2026-08-09)

**Фікс:** провалений результат кидає помилку → прогін червоний.

## Причина 5 — у master-write не було фолбеку моделі (знайдено sandbox-ом)

`premiumOpenRouterModels` віддавав `ranked.slice(0, 1)` — рівно одного кандидата. Коментар
пояснював це 300-секундним бюджетом Vercel-функції, але `editorial_master` уже виконується
на GitHub Actions із 120-хвилинним лімітом, тож обмеження стало застарілим саме там, де
воно найдорожче.

Перший же sandbox-прогін це показав за 138 секунд: найдешевша модель, що проходить
quality-floor, `tencent/hy3-preview`, віддала **повну статтю на 31k символів з однією
зайвою лапкою у відкривальній дужці** — `{"article":{"` замість `{"article":{`. `JSON.parse`
падає на позиції 16, і падати далі нікуди. Відтворилось двічі поспіль — дефект моделі,
не випадковість.

**Фікс:** `WEEKLY_MASTER_OPENROUTER_CANDIDATES` (дефолт 1 — поведінка Vercel не
змінюється), у `weekly-master-cli-worker.yml` виставлено `3`. Перевірено наживо:
`hy3-preview` знову впав, `z-ai/glm-5.2` підхопив і дописав EN-статтю в тому ж виклику
(source: live sandbox runs 2026-08-09, `artifacts/_local/weekly-sandbox/`).

Заодно: невдала валідація відповіді тепер логує `response_head` / `response_tail`, бо
«Expected ':' after property name at position 16» без самої відповіді не діагностується.

## Що з цього випливає

Чотири з п'яти причин — інфраструктурні таймінги й видимість, не редакція. Їх усі можна
було знайти за хвилини замість тижня, якби існував спосіб прогнати флоу поза продом —
тому разом із фіксами додано [ops/weekly-sandbox](../ops/weekly-sandbox.md).

## Related pages

- [ops/weekly-sandbox](../ops/weekly-sandbox.md) — як тепер тестувати master-флоу
- [pipeline/weekly-digest](weekly-digest.md) — Content Studio v2
- [pipeline/llm-providers](llm-providers.md) — реєстр LLM-провайдерів
- [pipeline/editorial-voice](editorial-voice.md) — редакційні гейти v7
