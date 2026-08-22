# Weekly master — ітеративний рушій

Summary: як `editorial_master` тепер працює — сегментований запис, точковий ремонт
поля замість перегенерації і принцип «якість ніколи не валить джобу».
Sources: `src/lib/weekly-digest/master-engine.ts`, `master-segments.ts`, `master-repair.ts`,
`editorial-llm.ts`, `generation-worker.ts`, `master-persist.ts`, owner UX 2026-08-22,
critic model rotation 2026-08-22
Last updated: 2026-08-22

---

## Чому переписано

Стара реалізація була **двома величезними викликами** (EN-пакет ~20k токенів, потім UK-пакет)
плюс один критик на весь бандл, і опційний revise, що переписував **статтю цілком**. Наслідки,
усі задокументовані живими прогонами 09.08 (source: [weekly-master-failures](weekly-master-failures.md)):

1. Будь-яка проблема на 12-й хвилині коштувала всю локаль. Найменша одиниця повтору — уся стаття.
2. Провал якості **вбивав джобу** (`quality_gate`, `retryable: false`). Пів години генерації
   зникали, залишався один рядок помилки.
3. Ремонт був заблокований за `reportIsRevisable`: **будь-який** factual flag, один невідомий код
   issue або однорідний «rubber-stamp» вердикт критика (сім однакових 90) повністю вимикали
   виправлення — одразу у провал.
4. Ремонт як «перепиши статтю» сам створював нові дефекти: правка одного поля EN тягла повну
   переадаптацію всієї UK-статті.

Власник відмовився від подальших точкових фіксів цієї схеми (session 2026-08-09).

## Що замість

### 1. Сегменти замість монолітів

`masterSegmentPlan()` (`master-segments.ts`) розбиває випуск на **14 сегментів** для типового
складу 3 feature + 3 radar: по одному виклику на кожну історію та один на «рамку» випуску
(`frame` — title/SEO/standfirst/intro/editorNote/keyTakeaways/conclusion…), окремо для EN і UK.

- Кожен сегмент — короткий виклик із власним словниковим бюджетом, а не частка одного
  2 500-слівного полотна.
- **Кожен сегмент чекпоїнтиться окремо** у `weekly_digest_generation_jobs.output.master_run_state`.
  Прогін, що впав на десятому сегменті, продовжується з десятого, а не з першого.
- **Рамка пишеться останньою**, уже з готових історій. Стара схема змушувала модель обрати тему
  випуску до того, як написано хоч одну історію — саме звідси абстрактні «umbrella»-заголовки,
  за які випуск бракували 09.08.
- Ідентичність історії структурна: `revisionItemId`, `placement` і українські `claimIds`
  **копіюються складальником**, а не питаються в моделі. Блокери `story_set_mismatch`,
  `placement_mismatch` і `bilingual_claim_parity` тепер неможливі за побудовою.

### 2. Точковий ремонт замість перегенерації

`planRepairTasks()` (`master-repair.ts`) перетворює звіт якості на список **фрагментів**
`{locale, revisionItemId, field}`. Адресація за спаданням точності:

1. issue сам називає `locale` + `field` (+ `revisionItemId`) — так працює кожна детермінована
   перевірка;
2. issue цитує спан — `locateSpan()` знаходить поле, що містить цей текст дослівно (рубрика
   критика **вимагає** цитувати спан для будь-якого виміру нижче 80);
3. фолбек за кодом: `article_length` → найдовші/найкоротші body; `duplicate_editorial_fields` →
   `practical`/`takeaway`; `dimension_low_score:X` → поля, які цей вимір насправді оцінює.

Далі `repairFieldPrompt()` шле **одне поле**: контракт поля, поточне значення, перелік проблем,
докази цієї історії, і — для UK — англійський відповідник для паритету. Відповідь — `{"value": …}`.
Промпт короткий (одиниці тисяч символів проти ~53 000 у старого письменника), відповідь — сотні
токенів. Раунд ремонту коштує секунди й частки цента, тому ітерувати до збіжності дешево.

Після правки EN-поля, **якщо ремонт може змінити факти** (не `template_leak` /
`language_mechanics` / `uk_language_residue`), ставиться в чергу **переадаптація того самого
поля** українською (`ukrainianCounterpart` + `repairNeedsUkrainianReadaptation`). Мовний
сплайс не тягне повний UK-body rewrite — live hang 2026-08-22: один UK body на DeepSeek flash
тримав джобу 18 хв у pre-critic, до першого виклику критика.

### 3. Безкоштовний детермінований раунд перед критиком

До першого платного виклику критика рушій ганяє `validateMasterBundle` і лагодить **блокуючі**
детерміновані проблеми (довжина метаданих, template-leaks, `numeric_parity`, українські мовні
залишки, `generic_practical`, відсутній `editorsView`). Після мех-сплайсу (`applyLanguageMechanicsFixes`)
бандл **перескановується** — інакше той самий `language_mechanics` issue, уже виправлений,
ішов у `planRepairTasks` як повний LLM-перепис поля. Неблокуючі warnings (`story_length`,
`article_length`) у цей раунд **не** входять. Приблизно половина блокерів, які колись
валили випуск, вирішуються тут за центи — критик більше не витрачає пʼять хвилин на відхилення
чернетки через те, що вже знав регулярний вираз.

### 4. Якість більше не валить джобу

`runWeeklyMaster()` **не кидає помилку через якість.** Можливі виходи:

| Вихід | Що робить воркер |
|---|---|
| `complete` + `converged: true` | активна ревізія, як раніше; `quality_passed: true` |
| `complete` + `converged: false` | **активна ревізія** (робоча копія) + звіт + `unresolved_issues`, джоба **`succeeded`** із `needs_owner_review: true`. Visuals/social/PDF не ставляться в чергу, доки власник не розбере перевірки. (До 2026-08-22 це була неактивна draft-ревізія — власник мав Restore, щоб побачити текст.) |
| `incomplete` | сегменти збережені, джоба падає з кодом `resumable` (`retryable: true`) — повтор **продовжує**, а не починається спочатку |

Кожен `unresolved`-запис несе причину: `unmappable`, `attempts_exhausted`, `repair_failed`,
`deadline`, `rounds_exhausted`. Нічого не зникає мовчки.

Окремий випадок — **ненадійний вердикт критика** (сім однакових оцінок або поламаний набір
вимірів). Це збій оцінювача, а не тексту: рушій просто переоцінює наступним раундом
(`criticVerdictLooksUnreliable`), тоді як стара схема вважала це термінальним провалом якості.

### 5. Бюджети

| Змінна | Дефолт | Що обмежує |
|---|---|---|
| `WEEKLY_MASTER_MAX_REPAIR_ATTEMPTS` | 3 | спроб на одне поле |
| `WEEKLY_MASTER_MAX_CRITIC_ROUNDS` | 3 | циклів критик → ремонт → критик |
| `WEEKLY_MASTER_MAX_DETERMINISTIC_ROUNDS` | 3 | безкоштовних раундів до критика |
| `WEEKLY_MASTER_MAX_REPAIRS_PER_ROUND` | 12 | полів за раунд |
| `WEEKLY_MASTER_DEADLINE_MS` | 95 хв (в Actions — 5 700 000 мс) | загальний час прогону |

Кожен critic-раунд і кожна нова ревізія того самого дайджесту **не стартують** на моделі,
яка вже ставила оцінку цій копії (`criticProviderLadder` + `priorMasterCritics`). Writer
vendor лишається виключеним. Якщо unused-пул порожній, виключення послаблюються — джоба
не падає через ротацію.

**Fix remaining issues (2026-08-22):** якщо на активній ревізії вже є EN+UK article,
`seedMasterRunStateFromBundle` наливає 14 сегментів з робочої копії. Writer-цикл
пропускається; лишаються deterministic pre-critic, critic і точковий ремонт. Resume
з попередньої джоби тут не працює — persist завжди мінтить нову `revision_id`.
(source: `src/lib/weekly-digest/master-engine.ts` `seedMasterRunStateFromBundle`,
owner session 2026-08-22)

(source: `.env.example`, `.github/workflows/weekly-master-cli-worker.yml`)

## Прозорість

Стрічка джоби більше не показує `router / auto` і стрибки 2% → 30% → 60%. Кожен виклик
логується власним `provider_call_started`/`provider_call_completed` із **міткою сегмента**
(`EN feature story #2`, `Critic round 1 repair: UK story a3c2f8a6 · practical`), реальним
провайдером/моделлю, токенами й вартістю. Прогрес рухається по 14 сегментах, а не по чотирьох
макрокроках. Манифест стадій у `generation-control.ts` віддзеркалює кроки рушія:
`prepare → english → ukrainian → validate → critic → revisions → persist`.

## Перший живий прогін — 2026-08-10 знайшов реальну регресію

Actions run [`31367921173`](https://github.com/sanchahous/ai-today-brief/actions/runs/31367921173)
— перший live-прогін нового рушія — впав на UK feature story #1 після 8/16 durable сегментів.
Причина структурна, не редакційна: `ukrainianStorySegmentPrompt` прямо наказує моделі **не
повертати** `claimIds` (поле копіює `writeStorySegment` з англійського оригіналу), але
`parseStorySegment` вимагав це поле безумовно й кидав `SyntaxError` на кожній конформній
UK-відповіді. `claude-cli` і всі 6 моделей у OpenRouter-черзі писали валідний текст і
відкидались на тому самому рядку — «Every editorial provider failed» після ~40 хв на нуль
результату, хоча жоден провайдер насправді не був несправний. Резюм-прогін
(`31371078952`) продовжив із тих самих 8/16 сегментів і впав так само — власник скасував
його вручну.

**Фікс:** `parseStorySegment(raw, approvedClaimIds, requireClaimIds = true)` — UK-виклик
передає `false`; повернуте значення все одно негайно перезаписується `english.claimIds` у
`writeStorySegment`, тож EN-контракт («claimIds обов'язкові, мінімум один») лишається
строгим без змін.

Другий, менший дефект з того самого прогону: чергу моделей засмічував
`openai/gpt-5.6-luna:batch` — варіант, доступний лише через окремий Batch API, що дає
`HTTP 404` на звичайному chat-completions шляху; 6 циклів ретраю в одному прогоні згоріли на
цьому. `:batch` тепер виключений в `isEligibleModel` (`pipeline/openrouter-models.ts`) так
само, як `:free`.

85 фокусних тестів (`editorial-llm.test.ts`, `master-engine.test.ts`,
`openrouter-models.test.ts`) і повний `pr:check` зелені після фіксу.
(source: Actions runs `31367921173`/`31371078952`, `src/lib/weekly-digest/editorial-llm.ts`,
`src/lib/weekly-digest/master-engine.ts`, `pipeline/openrouter-models.ts`, local `pr:check`
2026-08-10, гілка `fix/weekly-master-uk-claimids`)

## Чому ремонт задовгого body не сходився сам — і що змінено (2026-08-10)

Той самий прогін (job `3c60e3bc…`, дайджест `ai-weekly-2026-08-02`) завершився
`succeeded` + `needs_owner_review` із 8 нерозв'язаними пунктами. Розбір прод-БД показав, що
7 із 8 зводяться до **однієї** історії: EN-body 1203 слова, UK-body 1121 слово проти цілі
400–650 — саме вона сама по собі й тягнула обидва блокери `article_length` (EN 3848 слів,
UK 3696 замість 2000–3000). `reason: attempts_exhausted` — ремонт намагався, але не встиг.

**Корінь:** `suggestedFix` для `story_length` казав лише «Rewrite the body to 400–650 words»
— без числа, наскільки саме скоротити. Для body, що на 85% довше за верхню межу, це не
адреса, а напрямок: модель обережно підрізає речення замість структурної правки, і двох
спроб (`WEEKLY_MASTER_MAX_REPAIR_ATTEMPTS`) не вистачає, щоб влучити в діапазон.

**Фікс:**
- `story_length`'s `suggestedFix` тепер називає точну дельту й вимагає структурної правки:
  `"Cut at least 550 words from the current 1200-word body down to 400–650. Remove whole
  paragraphs or sub-plots rather than trimming individual sentences -- a 46% cut needs
  structural editing."` (симетрично для замалого body — `Expand... by at least N words`).
  Цей текст іде прямо в `PROBLEMS TO FIX` блок промпту ремонту без додаткових полів схеми.
- `WEEKLY_MASTER_MAX_REPAIR_ATTEMPTS` дефолт піднято з 2 до 3 — важкий випадок отримує ще
  одну спробу; виклик ремонту коштує секунди й частки цента, тож зайва спроба дешевша за
  нерозв'язаний пункт на огляді власника.
Два нові тести в `content-studio.test.ts` фіксують точний текст дельти для over/under case.
(source: `src/lib/weekly-digest/content-studio.ts`, `src/lib/weekly-digest/master-engine.ts`,
`content-studio.test.ts`, production Supabase read job `3c60e3bc-e0d9-4c5f-b1b1-34123c587129`
2026-08-10)

## Як перевірити без прода

`npm run weekly:sandbox -- run --fixture <path>` ганяє рушій на захопленій фікстурі без БД, пише
`state.json` після кожного сегмента і друкує кожен виклик. Прогін можна вбити будь-коли й
продовжити `--resume <dir>` — це той самий механізм, що й у проді.
Деталі — [ops/weekly-sandbox](../ops/weekly-sandbox.md).

## Що це НЕ змінює

- **Людина твердить publish.** Quality blockers лишаються гейтом Ship; текст після master —
  робоча копія. Кнопка **Fix remaining issues** на Master quality запускає ще один
  writer/critic з поточним звітом як guidance, не тихий in-place patch рядків `Fix:`.
  (source: [overview](../overview.md) §5.1, owner session 2026-08-22)
- Редакційні стандарти v7 (заборона вигаданих сцен, ban на мітки полів у body, правила доказів,
  калібрування критика) перенесені в посегментні промпти **дослівно** — змінився розмір одиниці,
  а не планка (source: `editorial-llm.ts`).
- Пороги якості (`OVERALL_MIN_SCORE` 85, виміри 75/80) не послаблені.

## Related pages

- [weekly-master-failures](weekly-master-failures.md) — сім причин збоїв 09.08, які це усуває
- [weekly-digest](weekly-digest.md) — Content Studio v2 загалом
- [editorial-voice](editorial-voice.md) — редакційні гейти v7
- [ops/weekly-sandbox](../ops/weekly-sandbox.md) — офлайн-прогін і `--resume`
- [llm-providers](llm-providers.md) — реєстр провайдерів
