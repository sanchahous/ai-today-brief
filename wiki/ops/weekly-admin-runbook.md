# Weekly admin runbook — як вести випуск у `/admin/weekly`

Summary: покрокова інструкція для власника/редактора: що натискати у вкладках,
що означають статуси jobs vs Approve, і що робити коли здається що «все зависло».
Sources: `src/components/admin/weekly-workspace.tsx`, `src/lib/weekly-digest/preflight.ts`,
`claim_weekly_digest_generation_jobs` (editorial_master gate), live fail
`ai-weekly-2026-07-27` 2026-08-04, [weekly-digest](../pipeline/weekly-digest.md),
[editorial-voice](../pipeline/editorial-voice.md),
`weekly_generation_control_plane` implementation 2026-08-09, `src/lib/weekly-digest/pdf.ts`
(PDF page-cap fix, 2026-08-07), admin mobile-responsive fix (гілка
`claude/admin-mobile-responsive-pfb65o`, 2026-08-08), `src/app/globals.css`, owner screenshot
+ Chrome layout measurement 2026-08-09, follow-up critic-recovery fix 2026-08-10, UK claimIds
engine fix 2026-08-10 (run `31367921173`), newer-draft banner, Postpone + B3 prompt readiness 2026-08-15
Last updated: 2026-08-15

---

## Головне правило (прочитай один раз)

| Статус | Що це означає | Що робити тобі |
|---|---|---|
| Job **succeeded** / pack **ready** | Система **згенерувала** артефакт | Переглянути → **Approve version** |
| Review **in_review** | Чекає людського апруву | **Approve** або Request changes |
| Review **approved** | Можна йти далі по пайплайну | Нічого, наступний крок |
| Job **queued** + packs не approved | Worker **свідомо не стартує** master | Approve усі 3 Top packs |
| Job **succeeded** + **Needs your review** | Рушій вичерпав ремонт, лишились невирішені перевірки; текст збережено як **неактивна draft-ревізія** | Читай `unresolved` у стрічці → Overview → Editorial versions → правити вручну або **Resume saved master** |
| Job **failed**, код **`resumable`** | Скінчився бюджет часу, не дописано сегмент або critic недоступний; усі готові сегменти збережено | **Resume saved master** — уже написані історії не оплачуються вдруге |
| Job **failed** + **Resume saved master** | Є збережені сегменти (навіть частково) | Натисни **Resume saved master**, не generic retry |
| Job **failed** без Resume | Немає жодного збереженого сегмента або інший тип збою | Читай причину → doctor/sandbox → linked retry лише після діагностики |

**Succeeded ≠ approved.** Це найчастіша причина «чому master у черзі».

## Шлях випуску (зліва направо)

```
Stories → Research → Article → Visuals → Social → PDF → Video → Release
```

Overview показує preflight blockers з лінком на вкладку. Іди зверху вниз.

### 1. Stories

1. Відбери **Top 3** + **3–4 Radar** (разом 6–7).
2. **Save stories**.
3. Без збереженого набору Content Studio не стартує.

### 2. Research (критичний human gate)

1. **Start / retry Content Studio** — ставить `research_pack` ×3 і `editorial_master` у чергу.
2. Дочекайся трьох packs **ready** (Generation jobs: succeeded).
3. На **кожній** Feature-картці: **Approve version** (owner, AAL2).
4. Лічильник **Approved research** має стати **3/3**.
5. Лише тоді `editorial_master` переходить у **queued** і одразу отримує один GitHub Actions
   worker (cron ~кожні **5 хв** лишається safety-dispatcher).
6. Коли з’явиться **Master quality**:
   - **джоба більше не падає через якість.** Якщо рушій не зміг закрити всі перевірки, він
     зберігає випуск як неактивну draft-ревізію, завершується `succeeded` і показує
     **Needs your review** із переліком `unresolved` — це задача на редагування, не збій
     інфраструктури (source: [weekly-master-engine](../pipeline/weekly-master-engine.md));
   - **ця draft-ревізія НЕ стає активною сама.** Approve research не має до цього стосунку —
     то окремий гейт, який лише дозволяє почати писати. Article tab за замовчуванням показує
     активну ревізію, а не найновішу; з 2026-08-10 жовтий банер «Newer draft available»
     з'являється на кожній вкладці, коли є новіша ревізія за активну, з посиланням на Overview
     → Editorial versions. Там **Restore this version** на потрібній ревізії робить її
     активною — без цього кліку весь текст лишається невидимим редактору;
   - **Restore/Save падали для кожного owner/editor до 2026-08-10 — це вже виправлено в
     прод-БД.** Реальна причина не в сесії: `create_weekly_digest_revision` і
     `revert_weekly_digest_revision` намагались писати в `weekly_digest_generation_jobs`, а
     роль `authenticated` мала до цієї таблиці лише `SELECT` з 23.07 — `42501: permission
     denied`, детерміновано, щоразу. Фікс — `security definer` на обидві функції
     (`supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql`),
     застосовано до прод-БД. Якщо все одно бачиш помилку на Restore/Save після 2026-08-10 —
     це вже щось інше, дивись реальний текст у червоному банері (більше не opaque `Ref: …`);
   - якщо джоба показує **Resume saved master** → натисни її: уже написані сегменти не
     пишуться повторно, critic і раунди ремонту стартують заново; це також правильний шлях після
     недоступного critic-а, не тисни поруч generic retry;
   - якщо **Resume saved master** немає → діагностуй blocker, далі Start/retry за потреби;
   - жовті length warnings часто не блокують Approve, якщо score/gate ок;
   - з 2026-08-06 сюди можуть потрапити нові блокери `editors_view_missing` /
     `discussion_question_missing` (тільки для трьох головних історій) і
     `template_leak:*` (мітка поля, вшита в тіло статті — «Practical scenario:»,
     «Обмеження полягає в тому» тощо) — обидва детерміновані, без участі критика,
     retry сам підхопить guidance. Деталі — [editorial-voice](../pipeline/editorial-voice.md);
   - з `weekly-master-v7` окремо блокуються копія legacy-зразка, абстрактна назва випуску,
     непояснена «енергія», надмірні metadata, UK spelling/grammar/localization та непідтверджена
     заява про «original research». Не апрувити звіт із механічними однаковими 90/100 — це
     ознака некаліброваного critic verdict, а не доказ якості;
   - **Approve version** на quality report.
7. Після успішного master з’являться Article EN/UK і підуть Visuals/Social/PDF/Video jobs.

Довгі master/social/video/**story image** jobs завжди показують конкретний GitHub run; короткі
deterministic jobs лишаються на Vercel. Не потрібно вручну вибирати worker. Різні story images
мають незалежні concurrency keys і можуть рендеритись паралельно; editorial jobs одного digest
лишаються серіалізованими. (source: `.github/workflows/weekly-master-cli-worker.yml`,
`weekly_generation_control_plane` implementation 2026-08-09/11)

## Як читати нову панель Generation jobs

- **Attempt 2/3** — скільки фактичних worker leases уже було; human approval у `waiting` не
  витрачає спробу.
- **Backend / Open run** — де працює конкретна спроба і пряме посилання на GitHub Actions.
- **Step / provider** — поточний етап і provider/model; для ще не стартованої задачі це явно
  написано, а не замінено здогадом.
- **≈ progress / elapsed / ETA** — збережений прогрес, фактичний час, heartbeat і deadline.
  Поки мало історії, ETA позначено як configured budget.
- **Latest result / next action** — причина попередньої невдачі, retryable чи terminal, коли
  буде retry або що саме має зробити редактор.

`running` без heartbeat понад 90 секунд щохвилинний database reaper закриває як `timed_out` і ставить backoff; третя
інфраструктурна невдача завжди terminal. Для quality/validation/quota помилок автоматичного
retry немає: переглянь конкретну причину, виправ gate і створи linked manual retry.
(source: `supabase/migrations/20260809060929_weekly_generation_control_plane.sql`)

### Після deploy async story-image worker

Спочатку має бути застосована міграція
`20260811183201_weekly_story_image_async_worker.sql`, потім — production deploy відповідного
commit. Після цього в адмінці **не створюй нові дублікати**: онови Visuals і зачекай до 5 хвилин
на safety poll. Міграція групує queued/retry/stale jobs за `revision_item_id`: якщо редактор уже
натиснув Regenerate, лише найновіша job переходить на **GitHub Actions**, а старі дублікати стають
`cancelled` з причиною `superseded_by_regeneration`. Уже жива Vercel-спроба має пріоритет, щоб не
розірвати її lease; її наступний retry піде в Actions. Winning timeout job отримує три нові durable
attempts. Очікуваний стан: рівно один **Open run** для кожної story, кілька `story_image` у
`running` одночасно, step `generate`, живий heartbeat, далі `persist` → `succeeded` і три variants
у Visuals. (source:
`supabase/migrations/20260811183201_weekly_story_image_async_worker.sql`,
`src/app/api/internal/weekly/generate/route.ts`, `src/lib/weekly-digest/generation-worker.ts`)

Manual **Retry** тепер ідемпотентний: повторний клік для тієї самої terminal job повертає вже
створений live/succeeded child. У нормальному стані для одного `retry_of_job_id` може бути лише
одна active job; кілька рядків із `cancelled · duplicate_manual_retry` — це збережений audit trail,
а не черга, яку worker ще запустить. Якщо active-копій більше однієї, не натискай Retry/Regenerate
ще раз і перевір partial unique guard з migration `20260811185251`. (source:
`supabase/migrations/20260811185251_weekly_manual_retry_idempotency.sql`)

### 3–7. Article → … → Release

На кожній вкладці: дочекайся generation **ready** → переглянь → **Approve**.
Release preflight на Overview / Release покаже, що ще червоне.

На Article:

- **Short intro under the headline (standfirst)** / **Короткий вступ під заголовком** — 1–2
  речення, які видно читачеві одразу під заголовком;
- **Search result title/summary** — рекомендований текст для пошукового preview;
- **Social sharing title/summary (Open Graph)** — заголовок і опис картки при поширенні посилання
  у соцмережах та месенджерах. Open Graph — назва стандарту metadata, не окремий формат статті.

Лічильники 65/160 для search і 70/200 для Open Graph — внутрішній редакційний бюджет для
компактного preview. Це не гарантія відображення: пошуковик або соцмережа може обрізати чи
вибрати інший текст.

Перевіряй не тільки зелені лічильники: title має називати конкретну подію/конфлікт, одиниці та
числа в UK мусять бути локалізовані, а одиничний case study не можна подавати як універсальний
факт про весь agentic AI. Якщо Top 3 не мають чесного спільного зв'язку, не вимагай umbrella-
тему — краще прямо назвати три новини.

На **Visuals** біля заголовка кожної story рядок `N/3 промпти готові` (наприклад
`2/3 промпти готові · немає consequence` або `фолбек: mechanism`) — це сигнал, що журі не
зібрало три різні підходи, **до** того як витрачати час на слабкий промпт. Далі картка
**Copy-ready prompts**: кнопки **Canonical / Midjourney /
Negative**, стан слота (`очікує зображення` / `завантажено, on review` / `approved`) і
**Upload a replacement** в тій самій картці. Кнопка **Generate prompts** / **Generate cover
prompt** пише `story_prompt_set` (`WEEKLY_STORY_IMAGE_MODE=prompt_only`) — без FLUX. Скопіюй
промпт, згенеруй зображення у своєму інструменті, завантаж файл. Обкладинкові кропи для каналів
далі складаються автоматично з approved cover. Після upload за кілька секунд зʼявиться
**QA чисто** або жовтий рядок на кшталт «QA: впечений текст (2 місця)» з **Ігнорувати** /
**Замінити файл**. Під жовтим рядком — порада: впечений текст → inpaint/crop (не
перегенеровувати кадр); поламана геометрія → той самий промпт; хибна теза → інший концепт.
Рядок **QA: ризик гідності** означає принизливу сцену з людиною — замініть файл, не ігноруйте
легковажно. Провальний QA **не** блокує реліз. Під кожним концептом — вердикт
**використано / з правками / відхилено** і теги причини; **Зберегти вердикт** пише пару
промпт→результат у `story_prompt_set` і в metadata завантаженого файлу. Це не гейт релізу.
QA після upload — **один** image-only прохід (без headline). У режимі `render` критик двостадійний:
спочатку пікселі, потім claim. Semantic contract у **Illustration prompt**
лишається для вже згенерованих/завантажених файлів:

1. **Context** — чи видно, яка саме система/обʼєкт/подія змінилась, а не «будь-який AI».
2. **Mechanism** — чи причина/процес фізично видимі, а не існують лише в описі prompt.
3. **Consequence** — чи механізм приводить до grounded benefit/harm/trade-off/uncertainty зі story.
4. **Visual thesis** — чи звʼязок context → mechanism → consequence читається за ~3 секунди без
   тексту на картинці.

Chip `semantic` — мінімум із context/mechanism/consequence/instant-comprehension, а не середнє:
високий `craft` не компенсує відсутній сенс. `needs_human_review` означає: переглянь blockers і
prompt history; Approve override використовуй лише якщо очима підтверджуєш усі чотири пункти.
(source: `src/components/admin/weekly-workspace.tsx`, `src/components/admin/story-prompt-set-panel.tsx`,
`src/lib/content-sim/vision-critic.ts`, `pipeline/card-image.ts`)

> **Не плутай з experimental V10:** V10 contact sheet — окремий owner-review артефакт, не
> вкладка production **Visuals**. Його automated score може підказати, що перевірити, але не
> натискає Approve і не змінює digest, Supabase чи реліз. Для експерименту дай окремий verdict
> `approve` / `local repair` / `rework` / `reject`.
> (source: `experiments/visual-affordance-v10/targeted-v6-owner-outcome-repair/results/README.md`)

### Release: approve → schedule → (за потреби) postpone → pause

Реліз завжди виходить рівно в понеділок 16:00 Kyiv — `schedule_weekly_digest` не приймає
жодного іншого дня/часу. Порядок кнопок на Release tab:

1. **Approve active revision** — фіксує поточну ревізію й усі approved артефакти; ще не
   публікує.
2. **Schedule release** — вводить дату/час у полях Preflight/Release (Kyiv); кнопка активна
   лише коли статус `approved`. Preflight — завжди рівно на 15 хв раніше за Release.
3. **Postpone** (з 2026-08-10) — з'являється лише коли статус уже `scheduled`, тобто «я
   думав, що встигну, а не встигаю». Один клік: вибираєш 1–4 тижні, пишеш причину — і за
   лаштунками воркфлоу сам робить pause → re-approve (це реальна повторна перевірка preflight
   на поточному контенті, не формальність) → schedule на той самий час у понеділок N тижнів
   пізніше. Якщо якийсь крок посередині впаде (наприклад, з'явився новий blocker), випуск
   лишається в проміжному стані (`paused` або `approved`) — банер угорі покаже точний текст
   помилки, дальше веди руками через Pause/Schedule.
4. **Pause and recover** — ручний шлях для правок після 15:45 (перезаписує контент, потребує
   Resume → Schedule заново) або коли Postpone не підходить (потрібна не понеділкова дата,
   чи більше 4 тижнів наперед — тисни Postpone кілька разів).

Postpone не створює нову RPC — це той самий Pause → Approve → Schedule, які вже існували,
просто в один клік з правильно порахованою датою (наступний понеділок 16:00, DST-safe).
(source: `src/app/admin/(cms)/weekly/actions.ts`, `src/components/admin/weekly-workspace.tsx`)

## Типові «чому не їде»

| Симптом | Ймовірна причина | Дія |
|---|---|---|
| `editorial_master` **queued**, packs succeeded | Packs ще **in_review** | Approve 3/3 |
| Spinner на queued master | UI раніше крутив навіть коли gate блокує | Шукай банер «Waiting for pack approvals» |
| Master **failed**, score 8x, blockers | Critic / deterministic gate | Читай Master quality → retry |
| Після retry знову `UNSUPPORTED_*` на деталі зі статті | Старий короткий excerpt / вузькі claims | Переконайся що packs **v3** з довгим excerpt; Approve знову |
| Visuals/Social не з’являються | Master ще не succeeded | Спочатку зелений Research gate |
| Release: немає story/cover | Файл не завантажено | Visuals → скопіюй промпт → згенеруй у своєму інструменті → upload. Не тисни Regenerate |
| Release blocked на video | Немає Remotion pipeline / captions | Owner override лише для trial (див. preflight) |
| PDF: сторінки радар-історій (4-7) виглядають скорочено (без картинки/панелей) | Так задумано з 2026-08-07 — повний розворот тепер лише для Top 3 | Нормально, не баг; деталі — [weekly-digest](../pipeline/weekly-digest.md#pdf-page-count-contract-violation--фікс-2026-08-07) |

## Master **failed** без зрозумілої причини — що робити (з 2026-08-09)

Не тисни retry наосліп: кожен ретрай — це 5–40 хвилин Actions і реальні гроші, а причина
здебільшого **не редакційна**. Порядок такий:

1. `npm run weekly:doctor` — за хвилину покаже, чи взагалі жива драбина провайдерів
   (протухла OAuth-сесія CLI, вичерпаний баланс OpenRouter, одинокий провайдер без фолбеку).
   Той самий крок тепер стоїть першим у самому workflow, тож відповідь часто вже в лозі
   прогону, у самому верху.
2. Якщо провайдери живі — `npm run weekly:sandbox -- capture --digest <id>`, далі
   `run --only english`. Це відтворює саме той крок, що падає, локально, за хвилини й за
   центи, без жодного запису в прод.
3. `gh run list` тепер каже правду: провалена джоба робить прогін **червоним** (до
   2026-08-09 усі провалені прогони показувались зеленими).
4. Якщо timeline показує збій на **Ukrainian** або **Revisions**, не переписуй Article вручну:
   ці кроки спершу тримають голос EN-writer, але після його збою автоматично переходять до
   наступного provider у драбині. Звір фактичний provider/model і причину в run; prose перед
   валідним JSON від CLI також відновлюється автоматично.
5. Якщо доступна **Resume saved master**, job має збережені сегменти (кнопка показує скільки).
   Вона створює окремий linked job на тій самій active revision, пропускає вже написані історії
   й дає критику та ремонту свіжий бюджет раундів. Дочекайся нового critic verdict; uniform
   90/100 лишається некаліброваним вердиктом — рушій сам переоцінює його наступним раундом,
   і це не привід обходити перевірку.
6. **Needs your review** ≠ провал. Текст є, він пройшов усі можливі автоматичні ремонти, і
   кожен `unresolved`-запис несе причину (`unmappable`, `attempts_exhausted`, `repair_failed`,
   `rounds_exhausted`, `deadline`). Швидше за все дешевше доправити руками у draft-ревізії,
   ніж ганяти ще один прогін.
7. Якщо стрічка каже **«Every editorial provider failed -- claude-cli: story.claimIds must
   be a non-empty string array»** — це відомий баг, знайдений і виправлений 2026-08-10
   (Actions run `31367921173`), не проблема з провайдерами чи балансом. UK-крок падав на
   кожній спробі, доки не влито `fix/weekly-master-uk-claimids`. Якщо стрічка також показує
   повторні `HTTP 404 (…:batch)`, це другий, менший дефект того самого прогону — той самий
   фікс виключив `:batch`-моделі з черги OpenRouter. Дочекайся мержу фіксу, потім Resume.
(source: `src/lib/weekly-digest/editorial-llm.ts`, `src/lib/weekly-digest/generation-worker.ts`,
`src/components/admin/weekly-generation-jobs-live.tsx`, Actions runs `31324873875`/
`31367921173`)

Деталі й що вже виправлено — [pipeline/weekly-master-failures](../pipeline/weekly-master-failures.md),
інструменти — [ops/weekly-sandbox](weekly-sandbox.md).

## Що не робити

- Не Approve **Master quality** при `passed: false` — master не став active; draft може бути
  збережений для review, а quality report лишається прив'язаним до active revision.
- Не спамити Start/retry без Approve packs — master все одно не стартує.
- Не правити Article body вручну, щоб «обійти» failed master — правильний шлях retry / research.

## Мобільна версія (2026-08-08)

`/admin` тепер зручний з телефону. Нижня навігація (Today…Settings) — два рівні рядки
замість поламаного 7-колонкового grid. Таб-бар секцій (Overview…Release) на
`/admin/weekly/[id]` прогортається пальцем — на краю з'являється м'яке затемнення, якщо
праворуч/ліворуч є ще вкладки поза екраном. Довгі story-ідентифікатори у preflight
blockers тепер переносяться, а не обрізаються за межу екрана.
(source: гілка `claude/admin-mobile-responsive-pfb65o`)

Grid-форма й картки на будь-якій вкладці не мають виходити за екран: базове правило
`.grid > * { min-width: 0 }` і `minmax(0, …)` для гнучких треків дозволяють textarea та довгим
значенням стискатися всередині контейнера. Якщо широка data-таблиця потрібна навмисно, вона має
залишатися тільки у власному `overflow-x-auto` контейнері — не розтягувати сторінку.
(source: `src/app/globals.css`, `src/components/admin/weekly-workspace.tsx`)

На desktop лівий sidebar можна згорнути кнопкою зі стрілкою: він стає вузьким rail з короткими
підписами розділів, а робоча область одразу отримує звільнену ширину. Та сама кнопка повертає
повне меню; вона має назву для screen reader і клавіатурний focus.
(source: `src/components/admin/admin-nav.tsx`)

## Related pages

- [weekly-digest](../pipeline/weekly-digest.md) — техніка Content Studio, версії, spend-cap
- [weekly-editorial-selection](../pipeline/weekly-editorial-selection.md) — відбір історій
- [social-cms-runbook](social-cms-runbook.md) — cron / secrets для generate worker
- [owner-checklist](owner-checklist.md) — env і launch-блокери
- [now](../now.md) — поточний випуск
