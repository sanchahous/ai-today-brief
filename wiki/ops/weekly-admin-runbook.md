# Weekly admin runbook — як вести випуск у `/admin/weekly`

Summary: покрокова інструкція для власника/редактора: що натискати у вкладках,
що означають статуси jobs vs Approve, і що робити коли здається що «все зависло».
Sources: `src/components/admin/weekly-workspace.tsx`, `src/lib/weekly-digest/**`,
[weekly-digest](../pipeline/weekly-digest.md), owner sessions 2026-08-04…24,
latest revision is the working copy 2026-08-22, critic model rotation 2026-08-22
Last updated: 2026-08-24

---

## Головне правило (прочитай один раз)

| Статус | Що це означає | Що робити тобі |
|---|---|---|
| Job **succeeded** + `machine_attested` | Система прийняла артефакт | Нічого; дивись Hallucination board |
| Job timeline: **`attest_failed`** | Авто-attest не пройшов, артефакт застряг у `in_review` | Approve version вручну після перевірки або Create linked retry |
| Quality **blockers > 0** | Approve **заборонений** (і людині, і машині) | Чекай auto language-fix / Resume master |
| Visuals **prompt ready** | Треба зовнішня генерація + upload | Copy prompt → gen → upload |
| Hallucination board **can Ship** | Немає blockers і waiting-список порожній (ті самі слоти, що й preflight) | Один AAL2 **Ship** |
| Job **running** на ~35% (`english` / `ukrainian`) після **Fix remaining issues** | До фіксу reuse 2026-08-22 кнопка переписувала 14 сегментів з нуля | Не чекай годину. Зупини джобу. Після мержу reuse кнопка має стрибати до critic (~70%) за хвилини |
| Job **succeeded** + **Needs your review** | Рушій вичерпав ремонт, лишились невирішені перевірки; **текст уже є робочою копією** (Article tab) | Читай `unresolved` → прав статтю або **Resume saved master**. Ship лишається заблокованим, доки перевірки не зникнуть |
| Job **failed**, код **`resumable`** | Скінчився бюджет часу, не дописано сегмент або critic недоступний; усі готові сегменти збережено | **Resume saved master** — уже написані історії не оплачуються вдруге |
| Job **failed** + **Resume saved master** | Є збережені сегменти (навіть частково) | Натисни **Resume saved master**, не generic retry |
| Job **failed** без Resume | Немає жодного збереженого сегмента або інший тип збою | Читай причину → doctor/sandbox → linked retry лише після діагностики |

**Твій шлях випуску:** (1) Hallucination board, (2) 8 uploadів, (3) shooting + YouTube,
(4) Ship. Не клікай Research/Article/PDF/Social/Script, якщо `gates_passed`.
Кнопки Approve лишаються як override. Quality з blockers **не можна** апрувити.

## Шлях випуску (зліва направо)

```
Stories → Research (auto) → Article (auto) → Visuals (you upload) → Social (auto) → PDF (auto) → Video (you shoot) → Release (Hallucination board → Ship)
```

Overview показує preflight blockers і Hallucination board. Іди зверху вниз лише якщо
машина зупинилась.

### 1. Stories

1. Відбери **Top 3** + **3–4 Radar** (разом 6–7).
2. **Save stories**.
3. Без збереженого набору Content Studio не стартує.

**Перезібрати відбір (2026-08-16).** Overview → **Rebuild selection** (лише owner). Ганяє
поточний селектор по тому самому тижню, сідить історії з денних айтемів і робить нову
активну ревізію. Тисни, коли тиждень отримав схвалені новини вже після створення випуску
або коли змінились правила відбору. **Скидає всі апрува** (research, article, зображення,
соц) і повертає випуск у `in_review` — інший набір історій їх більше не описує. Стару
ревізію не видаляє: вона лишається в Editorial versions і повертається кнопкою **Go back to this version**.
Якщо випуск уже `scheduled` і минув 15:45 Kyiv — спершу Pause.

**Що змінилось 2026-08-16.** Історія більше не приходить із порожніми полями: `Повний
текст` тепер береться з `body_md` щоденного айтема (Markdown), `Практичний приклад` — з
`action_items` (або `when_to_use`), `Висновок` — з `takeaways`. Раніше composer писав
`body = Короткий опис` і `Висновок = Чому це важливо`, тож із пʼяти полів реально
заповнені були два. Якщо поле лишилось порожнім — у щоденного айтема справді не було
такого блоку; це сигнал дописати вручну, а не збій. Кандидатів тепер відбирає
`weekly-editorial-v3`: свіжість усередині тижня майже не важить, а «баланс категорій»
став штрафом, а не викиданням — у панелі кандидатів видно `diversity_penalty` і
`adjusted_score`.
(source: [weekly-digest § Seed-контент історій](../pipeline/weekly-digest.md#seed-контент-історій-2026-08-16),
[weekly-editorial-selection § Що змінила v3](../pipeline/weekly-editorial-selection.md#що-змінила-v3-2026-08-16))

### 2. Research (машина; дивись Hallucination board)

1. **Start / retry Content Studio** — ставить `research_pack` ×3 і `editorial_master` у
   чергу. Якщо паки на цій ревізії вже `succeeded`, кнопка ставить **нові** jobs
   (`:retry:{uuid}`), а не мовчки повертає старі рядки. In-flight слоти не дублює.
   Waiting master зрушить сам, коли три паки **machine-attested** (без твоїх Approve).
   Старі succeeded jobs лишаються в історії. Не плутати з **Regenerate master**.
   (source: [weekly-digest § Start / retry](../pipeline/weekly-digest.md#content-studio-retry-after-succeeded-jobs-2026-08-16),
   [release autopilot](../audits/2026-08-21-weekly-digest-release-backtest.md))
2. Дочекайся трьох packs **ready** (Generation jobs: succeeded). Approve version лишається
   як override, якщо хочеш відхилити пак.
3. На **кожній** Feature-картці за бажанням прочитай excerpt і `independent_source_count`.
   `0` не означає зіпсований пак: звіти first-party часто не мають другого видавця.
   Фінальна перевірка claims→URL — на Hallucination board, не 3× Approve.
4. Лічильник **Approved research** має стати **3/3** після machine attest.
5. Тоді `editorial_master` переходить у **queued** і отримує GitHub Actions worker
   (cron ~кожні **5 хв** лишається safety-dispatcher).
6. Коли з’явиться **Master quality**:
   - **джоба більше не падає через якість.** Якщо рушій не зміг закрити всі перевірки, він
     зберігає випуск як **робочу (активну) ревізію**, завершується `succeeded` і показує
     **Needs your review** із переліком `unresolved` — це задача на редагування, не збій
     інфраструктури (source: [weekly-master-engine](../pipeline/weekly-master-engine.md));
   - **від 2026-08-22 остання ревізія і є робочою копією.** Раніше non-converged прогін
     лишав нову ревізію неактивною, і Article tab показував старий seed, доки власник не
     натискав Restore — це виглядало як баг. Тепер `editorial_master` завжди активує свій
     вихід. Quality blockers лишаються гейтом для Ship, не для «чи видно текст». Кнопка
     **Use latest version** (банер + Editorial versions) потрібна лише для **старих**
     неактивних draft-ревізій, згенерованих до цього фіксу, або якщо ти свідомо відкотився
     на ранішу версію. **Go back to this version** — це undo, не шлях «увімкнути останнє»;
   - **Restore більше не губить Master quality (2026-08-17).** До фіксу: `revert_weekly_digest_revision`
     лише перемикає `active_revision_id`, артефакти не чіпає, тож звіт критика лишався
     прикріпленим до ревізії, яка щойно стала неактивною — Research tab показував «Master
     quality report is missing», хоч `editorial_master` реально відпрацював і вже мав score.
     Живий приклад: випуск `6cbcf0b3` 16.08 — критик не зійшовся (82/100), зберіг звіт на
     ревізії 3, створив draft-ревізію 4; власник відновив ревізію 4 через Restore, звіт лишився
     сиротою на ревізії 3. Тепер **Restore автоматично підв'язує такий звіт до щойно активної
     ревізії** (`carryOverOrphanedQualityReport`, той самий RPC `save_weekly_digest_artifact`,
     яким пише воркер — не raw `UPDATE`: `revision_id` в `weekly_digest_artifacts` навмисно
     `immutable`, чіпляє `guard_weekly_digest_artifact_write`). Якщо колись усе одно побачиш
     «missing» після Restore (наприклад, випуск був відновлений ще до цього фіксу) — панель
     сама покаже інший стан: **«Independent audit · found on an earlier version»** зі score і
     кнопкою **Attach this report to the current version** замість generic інструкції «почни
     з Approve packs». Approve все одно потрібен окремо — прикріплення лише робить звіт
     видимим, не апрувить його.
     (source: `src/lib/weekly-digest/quality-report-carryover.ts`,
     `src/app/admin/(cms)/weekly/actions.ts` §`restoreWeeklyDigestRevisionAction` /
     `carryOverWeeklyQualityReportAction`, live check прод-Supabase `mdiqfatpqczwqghwttpm` 2026-08-17)
   - **Restore/Save падали для кожного owner/editor до 2026-08-10 — це вже виправлено в
     прод-БД.** Реальна причина не в сесії: `create_weekly_digest_revision` і
     `revert_weekly_digest_revision` намагались писати в `weekly_digest_generation_jobs`, а
     роль `authenticated` мала до цієї таблиці лише `SELECT` з 23.07 — `42501: permission
     denied`, детерміновано, щоразу. Фікс — `security definer` на обидві функції
     (`supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql`),
     застосовано до прод-БД. Якщо все одно бачиш помилку на Restore/Save після 2026-08-10 —
     це вже щось інше, дивись реальний текст у червоному банері (більше не opaque `Ref: …`);
   - **Fix remaining issues (2026-08-22)** на панелі Master quality. Рядки `Fix:` у жовтих
     картках — це інструкції для writer/critic, не кнопки. Авторемонт уже відпрацював усередині
     `editorial_master`; те, що лишилось (низький naturalness/trust, `story_length`,
     `trust_attribution`) потребує **нового проходу**. Кнопка стоїть під картками й викликає той
     самий `regenerateWeeklyMasterAction`, що й **Regenerate master** у таблиці Generation jobs
     (її легко пропустити). Research packs копіюються, guidance береться з поточного звіту
     (включно з **неблокуючими** warnings), нова чернетка стає робочою копією, spend cap рахується.
     **Resume saved master** тут зазвичай неправильний шлях: після `succeeded` джоба прив’язана
     до старої ревізії, а resume навмисно **не** бачить свіжий звіт. Не Approve quality, поки
     блокери не зникли; жовті length warnings самі по собі Approve не блокують, але кнопка їх
     теж віддає в guidance;
   - якщо джоба показує **Resume saved master** після `failed`/`resumable` (не дописано сегмент /
     critic недоступний) → натисни її: уже написані сегменти не пишуться повторно;
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

### Published weekly: safe visual refresh (2026-08-24)

Якщо weekly вже **published**, не редагуй його revision і не перезавантажуй live cover. На
Overview натисни **Create visual refresh draft** (потрібен owner + AAL2). Це створює private
working revision з approved text/PDF/unchanged asset provenance, а public `published_revision_id`,
SEO, Open Graph і пікселі лишаються незмінними. (source: owner session 2026-08-24;
`supabase/migrations/20260824130000_weekly_visual_refresh_draft.sql`)

У private draft введи або відредагуй усі чотири поля: EN/UK **Hero / PDF display title** і EN/UK
**Internal visual thesis**, потім натисни **Save direction and regenerate prompts**. Поля —
редакційні адаптації, не literal translation: title має дати короткий insight для читача, thesis
має описати один causal no-text cover. Ця дія queues тільки нові prompt-only cover/story jobs.

На **Visuals** можна завантажити тільки replacement cover/story image у private staging lane.
Спершу дочекайся post-upload QA і явно **Approve** потрібні assets, потім на **Visuals** обери саме
ці approved images та натисни **Apply selected approved images to public edition**. Публічна дія
доступна лише owner + AAL2: вона копіює й byte-verify файл в immutable public storage, створює
versioned public artifact і записує audit mapping. Ні canonical текст, ні SEO/OG, ні PDF, ні
наявні social materials не зміняться; для іншого кадру створи новий refresh або заміни private
asset до apply. (source: owner session 2026-08-24;
`supabase/migrations/20260824150000_weekly_visual_refresh_staged_assets.sql`;
`src/components/admin/weekly-workspace.tsx`; `src/app/admin/(cms)/weekly/actions.ts`)

### 3–7. Article → … → Release

На кожній вкладці: дочекайся generation **ready** → переглянь → **Approve**.
Release preflight на Overview / Release покаже, що ще червоне.

На Article:

- **Hero / PDF display title** — коротка читацька теза лише для public hero і PDF cover; canonical
  title далі є єдиною назвою для SEO, Open Graph і списків;
- **Internal visual thesis** — private causal direction для no-text cover prompt/QA, не читачевий
  текст;
- **Short intro under the headline (standfirst)** / **Короткий вступ під заголовком** — повний
  intro/standfirst на public hero не з’являється до натискання «Показати більше»;
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

На **Visuals** біля заголовка нової story рядок `1/1 основний промпт готовий`; якщо він зібраний
через fallback, це явно видно як `фолбек: …`. Старі revision artifacts із трьома prompts можуть
і далі показувати історичний `N/3` стан, але не є ціллю для нової генерації. Над сіткою story —
рядок **гейт промптів** (E3); він лишається advisory і не блокує Release. Далі картка
**Primary illustration direction**: кнопки **Canonical / Midjourney /
Negative**, бейдж шаблону (`realistic photography` / `infographic engine` / …) поруч із lens, стан слота (`очікує зображення` / `завантажено, on review` / `approved`) і
**Upload a replacement** в тій самій картці. Кнопка **Generate prompts** / **Generate cover
prompt** пише `story_prompt_set` (`WEEKLY_STORY_IMAGE_MODE=prompt_only`) — без FLUX. Скопіюй
промпт, згенеруй зображення у своєму інструменті, завантаж файл. Upload `story_image`
з 2026-08-17 пише **WebP** 1600×900 (не сирий PNG і не JPEG). Cover лишається JPEG —
вона є `og:image` дайджесту. На сайті `next/image` і так просить WebP у Supabase.
Обкладинкові кропи для каналів
далі складаються автоматично з approved cover. Після upload за кілька секунд зʼявиться
**QA чисто** або жовтий рядок на кшталт «QA: впечений текст (2 місця)» з **Ігнорувати** /
**Замінити файл**. Під жовтим рядком — порада: впечений текст → inpaint/crop (не
перегенеровувати кадр); поламана геометрія → той самий промпт; хибна теза → уточнити primary
direction і перегенерувати кадр.
Рядок **QA: ризик гідності** означає принизливу сцену з людиною — замініть файл, не ігноруйте
легковажно. Провальний QA **не** блокує реліз. Якщо рядок завис на «QA перевіряє…» (виклик не
завершився) або показує помилку — кнопка **Перевірити ще раз** (2026-08-15, review-фікс)
перезапускає перевірку на вже завантаженому файлі без повторного upload. Під кожним концептом — вердикт
**використано / з правками / відхилено** і теги причини; **Зберегти вердикт** пише пару
промпт→результат у `story_prompt_set` і в metadata завантаженого файлу. Це не гейт релізу.
QA після upload для cover — **один** image-only прохід. Для story clean pixel-only кадр проходить
другий story-aware прохід: headline + approved fields + counterweight + semantic contract + primary
scene. Він попереджає про `ambiguous_visual_story`, але не блокує ручний Release. Якщо semantic
прохід не завершився або є active QA blocker, файл не machine-attest-иться й лишається на ручному
review. У режимі `render` critic також двостадійний: спочатку пікселі, потім claim. Яка модель зараз
пише master — дивись `/admin/providers`
секцію **Model ranking** (добовий OpenRouter rerank, F3), не Visuals.
Скільки коштують новини vs промпти+QA — `/admin/costs` секція **Illustration budget** (G),
з ledger, не з лімітів політики.
Semantic contract у **Illustration prompt**
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

### Social: що змінилось 2026-08-21

Три речі, які редактор побачить одразу:

1. **Кожен пост мусить містити дію.** Контракт каналів тепер вимагає блок практики: назва
   інструменту або налаштування, крок і ціна/межа. Пост, після якого читач не знає, що
   спробувати, — не готовий, навіть якщо всі числа правильні. Матеріал беруть із поля
   **Practical** відповідної історії, не вигадують. Авто-attest (без кліку) проходить лише
   пост із critic ≥ 85 **і** справжнім use-block: дієслово дії + конкретика (цифра або
   inline-код). Голий заголовок із числом гейт не проходить — такий пост чекає на ручний
   Save & approve.
2. **Telegram рендерить розмітку.** `**жирний**` і `` `назва прапорця` `` там працюють
   (`parse_mode: HTML`). **У решті пʼяти каналів ці маркери заборонені** — гейт блокує їх
   кодом `raw_markup`, бо вони друкуються сирими.
3. **LinkedIn: лінка в тілі більше немає.** Трекований URL іде в поле **First comment** —
   гейт блокує URL у тілі (`root_url`) і порожній коментар (`linkedin_comment_url`).
   Коментар постить автоматика одразу після поста; якщо він упаде, пост лишиться живим, а
   доставка піде в `needs_reconciliation` з кодом `partial_linkedin_comment` — ретраїти не
   можна, бо пост уже опублікований.

Пам'ятай: **будь-яка правка копії після апруву скидає апрув** і повертає картку в
`in_review` (`guard_social_content_approval`). Це не баг — так і задумано. Machine-attest
не вмикає `publish_enabled`: якщо канал на паузі, attest лише апрувить текст, публікація
лишиться вимкненою.

### Social: один package job → шість карток

У **Social** натисни **Generate social package** (або **Regenerate social package**, якщо вже є
failed package). Це ставить **один** `social_copy` job для Telegram, Facebook, X, Threads,
LinkedIn та Instagram — не шість незалежних кліків. Дочекайся `succeeded`: до `in_review` тепер
доходить лише повний пакет без blocking checks. Картка показує `Ready for review · no blockers`;
переглянь текст, за потреби відредагуй і натисни **Save & approve** для потрібної locale.

Форма тепер channel-aware: окремі CTA/Hashtags і raw JSON `asset_urls`/`content_parts` прибрані.
Telegram/Facebook/LinkedIn — post copy; X — root + self-reply з tracked URL; Threads — 3–5
частин (клік по hook оновлює всі parts, без `<PART>` у тексті); Instagram — caption і сім
read-only слайдів. LinkedIn PDF показується як document, не як картинка. **Save draft** можна
з warnings. Кнопка **Save & approve** в UI гаситься лише на structural `blocking`. Critic < 85
— серверний відбій після save, не disabled кнопка. Повторний Save на вже `approved` каналі
має йти через admin client (інакше «Social approval/schedule transitions require a workflow
RPC»). Instagram слайди в формі не редагуються: обрізаний carousel —
`npm run weekly:social:repair-copy -- --package-id <uuid> --apply`. Закрити апрув без MFA:
`npm run weekly:social:approve -- --package-id <uuid> --apply` (не schedule і не publish).
(source: `src/lib/social/channel-form.ts`, `src/lib/social/quality.ts`,
`src/app/admin/(cms)/weekly/actions.ts`, `src/lib/weekly-digest/repair-social-copy.ts`)

Якщо після деплою 2026-08-18 старий пакет усе ще показує PDF замість landscape image, **не**
регенеруй шість каналів з нуля. Pause publishing → dry-run
`npm run weekly:social:repair -- --package-id <uuid>` → якщо план показує 5 image refs і 7
Instagram JPEG, тоді `--apply`. Legacy 8-slide `content_parts` збираються в 7-slide spec:
останній слайд = takeaway, передостанній = caveat, заголовки/body підганяються під 72/54/120.
Скрипт лишає copy п'яти каналів, міняє image refs, регенерує Instagram spec/slides і повертає
всі variants у `in_review` без auto-approve. Production apply не є частиною code PR.
(source: `scripts/repair-weekly-social-package.ts`, `src/lib/weekly-digest/repair-social-package.ts`)

Якщо media repair уже зроблено, а Facebook/Threads/Instagram падають на critic < 85
(обрізані слайди, claims поза takeaways):

`npm run weekly:social:repair-copy -- --package-id <uuid>` потім `--apply`.

Він переписує лише ці три канали, перемальовує 7 Instagram JPEG і записує новий critic.
Approve без MFA-сесії: `npm run weekly:social:approve -- --package-id <uuid> --apply`.
(source: `scripts/repair-weekly-social-copy.ts`, `scripts/approve-weekly-social-package.ts`)

У **Generation jobs** актуальний Social run показаний окремо. Попередні linked attempts згорнуті
під **Previous generation attempts**: вони лишаються аудит-трейлом, але їхній старий `failed` не
є поточним blocker-ом і не потребує ще одного retry, якщо актуальний run уже `succeeded`.
(source: `src/components/admin/weekly-generation-jobs-live.tsx`,
`src/lib/weekly-digest/generation-job-visibility.ts`)

Якщо конкретний канал не проходить critic/platform/originality gate, worker сам перевіряє інші
кандидати й робить до трьох точкових repair rounds. На кожному round аудіюється один найсильніший
candidate; social provider має 60-секундний absolute ceiling **на модель**, максимум дві моделі
на writer/critic call, а reasoning запитується в low mode. Це важливо: попередні
180 секунд обмежували одну модель, але не всю послідовну queue. Уже чисті канали записані в checkpoint і не
генеруються повторно. Job, який вичерпав repair, лишається failed/draft і не вивантажує проблемну
копію на owner approval. Для старих пакетів diagnostics показані компактним amber статусом;
детальний список відкривається через **Quality checks**, але не дублюється червоною стіною.
(source: `src/lib/weekly-digest/social-adapter.ts`,
`src/lib/weekly-digest/social-checkpoint.ts`, `src/components/admin/weekly-workspace.tsx`,
`.github/workflows/weekly-master-cli-worker.yml`, `src/lib/social/llm-router.ts`)

Critic observation не є автоматичним blocker: factual і platform dimension блокують лише коли
відповідний score нижче 85. При score 85+ точний flag лишається warning для редактора, а картка
може перейти в clean `in_review`. Якщо bounded repair усе ж вичерпано нижче порога, Timeline
показує `quality_gate` і точний текст blocker, а linked retry відновлює вже чисті канали.
(source: `src/lib/weekly-digest/social-adapter.ts`,
`src/lib/weekly-digest/generation-control.ts`, production run `32062624113`)

Під час першого recovery старого package worker може не мати `checkpoint.postIds`, хоча
`social_posts` уже існують. Він знаходить такий post за `package_id + channel`, пропускає його
через той самий versioned repair/update, створює matching `generated` review, а потім виконує
фінальний zero-blocker guard. Тому старі червоні reports не мають пережити clean regeneration.
(source: `src/lib/weekly-digest/generation-worker.ts`, production run `32063924268`)

Якщо Timeline показує `deepseek-v4-pro` до social-ranked queue попри відсутність
`social.writer`/`social.critic` у `/admin/providers`, це старий phantom override: registry default
було помилково прийнято за owner chain і OpenRouter викликався двічі. Після routing fix writer
починає зі швидкої OpenAI mini lane; реальний owner override використовується лише коли роль
збережена в БД. (source: `src/lib/social/llm-router.ts`, production run `32059830080`)

Повне тимчасове вичерпання social provider ladder більше не завершується opaque `Code: unknown`:
job отримує retryable `provider_exhausted`, backoff і продовжує зі своїх channel checkpoints.
(source: `src/lib/weekly-digest/generation-control.ts`)

Malformed writer JSON без `2–3` варіантів `<CANDIDATE>` більше не потребує ручного retry:
response validator відхиляє лише цю відповідь і продовжує на наступній моделі в bounded queue.
(source: `src/lib/weekly-digest/social-adapter.ts`, production run `32061374498`)

Якщо job впав після ~90% з `Cannot read properties of undefined (reading 'map')`, не переписуй
шість постів: це був несумісний normalized article artifact на LinkedIn document step, а не
provider failure. Після деплою фіксу натисни **Create linked retry** на terminal `social_copy`
job; retry має власний job history, але відновить уже готові writer/critic results та Instagram
slides замість генерації шести каналів із нуля. Timeline покаже `checkpoint_restored`, а
progress почнеться з останнього durable кроку. Якщо він знову впаде пізніше — наприклад на
LinkedIn PDF, package або четвертому post — наступний linked retry так само продовжить із цього
кроку. Fresh generation потрібна лише коли змінився approved article/revision або locale map,
бо тоді source hash навмисно не збігається.

Помилка `LinkedIn document rendered 8 pages; expected 7` — це не провал каналів і не привід
знову запускати writer/critic. Вона означає, що довгий editorial copy переповнив фіксований
7-page native document. Після deploy layout-bounds fix створи один linked retry: checkpoint
відновить 6/6 adaptations та Instagram slides і повторить LinkedIn render із bounded regions.

Якщо після **Create linked retry** з'явився `Minified React error #441` із ref `2087663833`, не
натискай retry вдруге: child уже створено. Це зафіксований HTTP 503 GitHub на dispatch, а не
провал writer-а. Онови сторінку й стеж за тим самим child job; dispatcher має короткі повторні
спроби, а при непідтвердженій доставці лишає один fenced `dispatching` job для безпечного
автоматичного recovery без дублювання workflow.
(source: `src/components/admin/weekly-workspace.tsx`,
`src/lib/weekly-digest/generation-worker.ts`, `src/lib/weekly-digest/github-dispatch.ts`,
`src/lib/weekly-digest/social-checkpoint.ts`, production incidents + прод-Supabase
`mdiqfatpqczwqghwttpm` live check 2026-08-17)

Якщо `video_script` впав на ~10% одразу після «Starting video script provider call» з
`Cannot read properties of undefined (reading 'map')` і `Code: unknown`, це не збій
провайдера: approved `article` artifact нормалізований і не несе `stories`. Не тисни
retry, доки фікс hydration не в `main`. Після деплою — **Create linked retry** саме на
terminal `video_script`. Hydration уже в `main` (#297); якщо script approved —
не регенеруй його.

### Video: script → Generate manifest → Approve v3

`queuePostMasterJobs` ставить і `video_script`, і companion `video_manifest` (стабільний
ключ `…:video-manifest:en`) у `waiting`. Claim зрушує манифест, коли є approved script,
3 approved Top 3 `story_image` і ready `cover`.

Якщо рядка `video_manifest` **немає взагалі** (навіть `waiting`) — це не кеш. Типовий
збій: нова ревізія після Content Studio або retry `video_script` без companion.
Release тоді каже «Open Video → enqueue video_manifest», але кнопки не було.

Після деплою фіксу: вкладка **Video** → **Generate manifest** (активна лише коли script
`approved`). Не регенеруй уже схвалений скрипт і не тисни Start Content Studio.
Картка артефакту — **weekly-video-v3 manifest** (не v2). Job може лишитись у
`waiting` з `status_reason`, доки немає трьох approved story images і cover.

Наступні `video_script` success і клік **Generate script** самі upsert-ять companion
тим самим стабільним ключем.

**Save на Video contract** має лишати повний plan object (`title`, `hook`,
`scenes`, `shorts`). Поле Scene JSON — лише масив сцен; якщо його записати
як `narration_plan`, job `video_manifest` падає з «does not contain the v3
script». Після правки фрази 18.08 саме це сталось на v2. До деплою фіксу
не тисни Save на вже approved script — лише **Approve** манифесту.
На `ai-weekly-2026-08-09` (rev. `3e955086`) script і `weekly-video-v3` уже
`approved` (live check 2026-08-18). Блок **Shooting package** на Video-табі — канон
зйомки (Hailuo + HeyGen). Після кліпів: зведення в `ai-today-brief-video`, тоді paste
`weekly-video-result-v2` → Approve `video_final` / captions / thumbnail.
PDF EN/UK після імпорту стануть `stale` — перезатвердити.
Не Save Video contract на already-approved script.
(source: owner session 2026-08-19, `src/lib/weekly-digest/video-shoot-pack.ts`,
production live check 2026-08-18,
`src/components/admin/weekly-workspace.tsx`)

Той самий корневий дефект hydration, що LinkedIn 17.08, тільки воркер кастив
`content` напряму замість `masterBundleFromArtifacts`.
(source: production job `43b9fcf1-e9ba-46b8-80a8-93d775cec8f0`, 2026-08-18 11:55 UTC)

### Release: approve → schedule → (за потреби) postpone → pause

Стандартний каданс — понеділок 16:00 Kyiv (так вираховуються дефолтні preflight/release для
production-випуску, згенерованого в неділю). З 2026-08-20 `schedule_weekly_digest` приймає
**будь-яку майбутню дату/час**, не лише понеділок — власник міг закінчити ревʼю поза вікном
15:45/16:00 (довга серія фіксів багів) і не мав як запланувати реліз. Реліз-воркер уже був
day-agnostic (крон кожні 5 хв просто звіряє `release_at <= now()`), тож послаблення торкнулось
лише перевірки дня/часу в `schedule_weekly_digest`. Порядок кнопок на Release tab:

1. **Approve active revision** — фіксує поточну ревізію й усі approved артефакти; ще не
   публікує.
2. **Schedule release** — вводить дату/час у полях Preflight/Release (Kyiv); кнопка активна
   лише коли статус `approved`. Preflight — завжди рівно на 15 хв раніше за Release, будь-яке
   інше значення поля Preflight сервер відхилить ще до виклику RPC.
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
| `editorial_master` **queued**, packs succeeded | Packs ще **in_review** (attest не пройшов) | Hallucination board / job error; Approve лише override |
| Spinner на queued master | UI раніше крутив навіть коли gate блокує | Шукай банер «Waiting for pack approvals» |
| Master **failed**, score 8x, blockers | Critic / deterministic gate | Читай Master quality → retry |
| Після retry знову `UNSUPPORTED_*` на деталі зі статті | Старий короткий excerpt / вузькі claims | Переконайся що packs **v3** з довгим excerpt; Approve знову |
| Visuals/Social не з’являються | Master ще не succeeded | Спочатку зелений Research gate |
| `social_copy` terminal failed після Instagram, `undefined.map` | Normalized article artifact не мав `stories` для LinkedIn document | Дочекайся деплою social recovery, потім **Create linked retry**; не генеруй шість каналів окремо |
| `social_copy` terminal failed на `rendered 8 pages; expected 7` | Довгий editorial copy переповнив LinkedIn PDF | Після deploy 7-page bounds створи **один** linked retry; він відновить збережені канали й слайди |
| Linked `social_copy` retry знову показує `channels` від 0% | Немає валідного checkpoint для поточного approved source hash | Перевір, чи не змінилась revision/locale map; якщо ні — дивись `checkpoint_restored`/`checkpoint_saved` у Timeline |
| Release: немає story/cover | Файл не завантажено | Visuals → скопіюй промпт → згенеруй у своєму інструменті → upload. Не тисни Regenerate |
| Release: немає `video_manifest` job, хоча script approved | Companion-рядок ніколи не створився (падіння/retry `video_script` без post-master queue) | Video → **Generate manifest**. Не регенеруй скрипт |
| Release blocked на video | Немає living clips / YouTube result | Video → **Shooting package** → кліпи в `ai-today-brief-video` → звести → `weekly-video-result-v2`. Не заливати L0 JPEG+TTS з `output/`. Owner override лише для trial |
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
   й дає критику та ремонту свіжий бюджет раундів. Новий прохід **не** бере ту саму
   critic-модель, що вже ставила бал цій редакції — драбина крутить unused слот /
   unused OpenRouter id. Дочекайся нового critic verdict; uniform
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
- [image-prompt-library](../pipeline/image-prompt-library.md) — copy-ready промпти v6, бейдж шаблону
- [weekly-editorial-selection](../pipeline/weekly-editorial-selection.md) — відбір історій
- [social-cms-runbook](social-cms-runbook.md) — cron / secrets для generate worker
- [owner-checklist](owner-checklist.md) — env і launch-блокери
- [now](../now.md) — поточний випуск
