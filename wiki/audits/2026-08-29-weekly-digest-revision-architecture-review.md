# Weekly digest revision architecture — review + план на наступний реліз

Summary: чому реліз `ai-weekly-2026-08-16` (28–29.08.2026) знову зламався на тих самих
типах багів (артефакти зникають, блокери розходяться з UI, апрув скидається сам собою),
чи винна в цьому модель ревізій, і конкретний план — що зробити до наступного релізу
(Етап 0) і що лишити окремим проєктом (Етап 1).
Sources: живий реліз `71af784b-3c89-47f8-bc38-e3eae4def2a7` 28-29.08.2026 (owner session +
пряма робота з прод-Supabase `mdiqfatpqczwqghwttpm`), Explore-агент по коду 29.08.2026
(повний обхід `supabase/migrations/*.sql`, `weekly-workspace.tsx`, `actions.ts`),
[weekly-digest](../pipeline/weekly-digest.md), [weekly-admin-runbook](../ops/weekly-admin-runbook.md),
[log 2026-08-28](../log.md), гілка `feat/weekly-revision-stage-0` 2026-08-29
Last updated: 2026-08-29

---

## Чому цей документ існує

Власник після релізу 28-29.08: «адмінка weekly digest зараз концептуально і структурно
неправильна. Дані зникають в релізах, постійно вилазять баги, постійно вилазять
блокери» — і попросив подивитись, чи можна прибрати ревізії й лишити одну версію
контенту з оновленням частин, що фіксились.

`wiki/now.md` за останні три тижні містить **щонайменше 6 окремих інцидентів** із тим самим
малюнком (ревізія плутає working copy, артефакт не переноситься, preflight розходиться з
UI) — включно з фіксом від 22.08 «робоча копія = остання ревізія» (PR #315), який мав
закрити саме цю проблему. Вона знову вилізла шість днів по тому. Це не суб'єктивне
відчуття — це видно з журналу.

## Що зламалось цього релізу — по причинах

### Група A — напряму від архітектури ревізій

**A1. Головна знахідка: два шляхи створення ревізії, і лише один уміє переносити артефакти.**

Є `create_weekly_digest_revision` (ручний Save власника, `supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql:32-408`) — перенесення там генеричне: копіює **будь-який** артефакт активної ревізії, чий `input_hash` збігається з перерахованим для нової ревізії, незалежно від `artifact_type`.

Є `create_service_weekly_digest_revision` (автоматичний шлях, `supabase/migrations/20260724093000_weekly_digest_editorial_revision_service.sql:6-267`) — його викликає `editorial_master` після **кожного** успішного прогону. У ньому перенесення **захардкожено в нуль**:

```sql
-- lines 248-254
'carried_artifact_count', 0,
'invalidated_slots', '[]'::jsonb
```

Жодної спроби щось скопіювати. Основний, повсякденний тригер нової ревізії — саме
автоматичний (кожна регенерація статті), тож кожен такий прогін обнуляє геть усі
артефакти дайджесту — PDF, відео, мініатюру — навіть якщо вони до зміненого контенту
статті не мають стосунку. `carried_artifact_count: 0`, який я бачив у продовій БД
28.08 на ревізії 7 — це буквально те саме хардкоджене значення з коду, не збіг і не
«тип артефакту не підтримується carry-forward», як спочатку записано в
[weekly-admin-runbook](../ops/weekly-admin-runbook.md#pdfvideothumbnail-зникають-на-новій-ревізії--carry-forward-гап-2026-08-28).
(source: `supabase/migrations/20260724093000_weekly_digest_editorial_revision_service.sql:248-254`,
live-check прод-Supabase `mdiqfatpqczwqghwttpm` revision `8ddce639` 2026-08-28)

**A2. Заміна обкладинки каскадно скидає підтвердження всіх 6 соцпостів.**

`weekly_digest_artifact_input_hash` рахує залежності занадто грубо: зміна `cover`
інвалідує все, що на нього формально «посилається» — включно з **текстом** соцпостів,
який від пікселів картинки не залежить узагалі. «Текст затверджено» і «картинка
прикріплена» — це одна умова, хоча логічно різні речі. Наслідок 28.08: одна заміна
cover → `auto_revoked` на всіх 6 `social_posts` + PDF EN/UK знову `stale`.
(source: прод-таблиця `social_post_reviews`, review id 344-350, live-check
2026-08-28 20:25-20:33 UTC)

**A3. `preflight_override` прив'язаний до `active_revision_id`.**

Будь-яке ручне обхідне рішення власника автоматично злітає, щойно з'являється нова
ревізія — навіть якщо контент, якого стосувався override, не змінився.

**A4. UI-кнопки Approve мовчки вимикаються при розсинхроні ревізії.**

Наскрізний патерн у `src/components/admin/weekly-workspace.tsx` (мінімум 2 місця:
рядки ~2538, ~2660, ~5042) — `canReview={... && artifact.revision_id === workspace.revision?.id}`.
Не одна кнопка, а системний патерн: коли артефакт «застряг» на старій ревізії, кнопка
просто не рендериться, без пояснення чому.

**A5. Фіча multi-revision browsing фактично не використовується.**

За даними коду (`supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql`,
коментар до інциденту 10.08): «production history shows exactly one human-authored
`revision_created` event ever, against zero since» — ручний Save минав дефектну
security-модель рівно один раз за всю історію проєкту. Це підтверджує репліку
власника: «я всеодно не використовую ревізії» — це не суб'єктивне, це видно з даних.

### Група B — окремі баги, ревізії тут ні до чого

**B1. Міграція `ship_weekly_digest` була в git, але ніколи не задеплоєна на прод.**
`supabase/migrations/20260821170000_weekly_release_autopilot_ship_and_attest_hardening.sql`
не потрапила в `list_migrations` прод-проєкту — Ship падав `PGRST202` («could not find
function»). Прогалина процесу деплою, не архітектури.
(source: прод-Supabase `mdiqfatpqczwqghwttpm` `edge_logs` live-check 2026-08-28 20:42 UTC,
`list_migrations` output того ж дня)

**B2. LinkedIn `first_comment` відсутнє у `SOCIAL_FIELDS_BY_CHANNEL`.**
`src/lib/social/channel-form.ts` — масив `linkedin` не мав `'first_comment'`, хоча `x`
мав. Форма просто не рендерила поле, куди вписати трекований лінк, а гейт
`linkedin_comment_url` вимагав його наявності. Один рядок коду; **вже виправлено
локально в цій сесії**, входить у цей PR.

**B3. Client-side «Current blockers: 0» розходиться з живим `weekly_digest_preflight()`.**
Release-вкладка показує кешоване число з попереднього рендеру, не результат свіжого
виклику RPC. 28.08 це двічі призвело до спроби Approve на стані, який RPC насправді
відхиляв (`artifact_stale`, `content_hash IS NULL`).

**B4. Голий `throw` ховає справжню причину помилки.**
`approveWeeklyDigestAction` / `shipWeeklyDigestAction` (`src/app/admin/(cms)/weekly/actions.ts`)
роблять `if (error) throw new Error(error.message)` — React рендерить це як
`Minified React error #441` незалежно від причини. 28.08 я бачив цей самий екран
для трьох геть різних першопричин (B1, невідповідний override-whitelist, B3) —
власник не може сам відрізнити один від одного.

## Чи можна прибрати ревізії?

Повністю прибрати таблицю — **ні, не для цього релізу**: `revision_id` — `not null`
foreign key у `weekly_digest_revision_items`, `weekly_digest_artifacts`,
`weekly_digest_generation_jobs` (сам контент, усі артефакти, усі джоби прошиті через
ревізію, не через дайджест напряму). Повний перелік — Explore-звіт 29.08.2026, збережено
в транскрипті сесії: 11 таблиць з FK на `weekly_digest_revisions`, ~20 RPC-функцій,
10 окремих UI-фіч (Editorial versions list, Go back to this version, Use latest version,
NewerDraftBanner, save-forms, per-tab «No active revision» стани, Approve active revision,
story-selection checkbox, visual-refresh provenance).

Але реальна вимога власника — не «прибрати таблицю», а «нехай завжди береться
найновіша версія, без ручного дошивання шматками» — **досяжна окремим кроком** (Етап 1
нижче), і дані (A5) підтверджують, що напрям правильний: rollback-функціонал фактично
мертвий, тримати під нього повну append-only модель — це вартість без користі.

## План

### Етап 0 — до наступного релізу, малий ризик, б'є прямо по причинах цього релізу

- [x] **A1 (найвищий пріоритет).** Портувати generic carry-forward INSERT з
      `create_weekly_digest_revision` (`20260810160000_weekly_revision_rpc_security_definer.sql:419-487`)
      у `create_service_weekly_digest_revision`
      (`20260724093000_weekly_digest_editorial_revision_service.sql`), і в
      `..._with_visual_direction`-варіант обох функцій. Замінити хардкоджений
      `'carried_artifact_count', 0` на реальний підрахунок скопійованих рядків.
      Це одна SQL-міграція, закриває головну причину зникнення PDF/відео/мініатюри.
      **Зроблено 2026-08-29:** `carry_forward_weekly_digest_revision_artifacts` + виклик
      з обох service RPC (`20260829130000_weekly_revision_stage0_carry_forward.sql`).
      Ручний `create_weekly_digest_revision_with_visual_direction` уже мав carry-forward.
- [x] **A2.** Звузити dependency-map у `weekly_digest_artifact_input_hash` так, щоб
      зміна `cover:*` інвалідовувала лише артефакти, які фізично включають пікселі
      cover (PDF), а не текстове затвердження `social_posts`. Розділити на дві
      незалежні умови: «текст підтверджено» і «asset-посилання актуальне».
      **Зроблено 2026-08-29:** хеш і CTE й далі stale-мають PDF/`social_asset` (пікселі).
      `save_weekly_digest_artifact` більше не пише `auto_revoked` на соцкопію;
      `artifactId` у `social_posts.asset_urls` переписується на новий current рядок
      (без bump `content_version`). Preflight окремо гейтить `social_variant_not_ready`
      (текст) і `social_assets_stale` (порожні `asset_urls` / не-current id).
- [x] **A3.** `preflight_override` не злітає на новій ревізії, якщо слот, який обходили,
      перенесли (hash match). Trigger `rebind_weekly_digest_preflight_override` переписує
      `revision_id` і викидає лише blockers з `invalidated_slots`.
- [x] **A4.** Кнопка Approve більше не зникає мовчки: якщо `artifact.revision_id` ≠
      active revision, жовтий банер пояснює, що артефакт на старій working copy.
- [x] **B4.** Прибрати голий `throw` у `approveWeeklyDigestAction` / `shipWeeklyDigestAction`
      (і перевірити інші дії в тому ж файлі на той самий патерн) — показувати
      справжній текст помилки з RPC замість generic React-краху.
      **Зроблено 2026-08-29:** Approve / Ship / Schedule / Pause редіректять на
      `?tab=release&save_error=` через уже наявний `redirectWeeklyReleaseError`.
- [x] **B3.** Release-вкладка викликає живий `weekly_digest_preflight()` при відкритті
      (або перед кожним Approve/Ship), а не показує окремо порахований client-side
      лічильник блокерів.
      **Зроблено 2026-08-29:** workspace вантажить RPC у `getWeeklyDigestWorkspace`;
      Current blockers показує live-список, не client-side `validateWeeklyDigestPreflight`.
- [x] **B1.** Легкий CI/pr:check крок: звірити список міграцій у `supabase/migrations/`
      проти `list_migrations` прод-проєкту, зафейлити якщо є розбіжність.
      **Зроблено 2026-08-29:** `list_applied_schema_migrations` (service_role) +
      `npm run migrations:check` у `pr:check` і workflow `migrations-drift.yml`.
      Порівнює **origin/main** із прод, тож нова міграція в PR не валить гейт.
- [x] **B2.** LinkedIn `first_comment` додано в `CHANNEL_FIELDS` — змержено в #340
      (`src/lib/social/channel-form.ts`).

### Етап 1 — окремий проєкт, не для цього PR

Справжнє спрощення моделі ревізій — обрати один з двох напрямів (потребує окремого
рішення власника, не автопілот):

1. Тримати рівно один мутовний рядок «поточна ревізія» на дайджест, апдейтити на
   місці; історію змін — окремим легким audit-логом, не повним дублюванням рядків
   `weekly_digest_artifacts`/`weekly_digest_revision_items`.
2. Або лишити append-only модель, але інвертувати правило carry-forward: «переносити
   все за замовчуванням, інвалідувати вузько й явно» замість поточного «інвалідувати
   все, переносити лише за збігом хеша».

Обидва варіанти чіпають ті самі ~20 RPC і ~10 UI-фіч з розділу вище — це реальний
проєкт на кілька днів роботи з окремим планом і тестуванням на копії продової БД
(`weekly:sandbox`), не одноденний патч. Розпочинати лише після того, як Етап 0
підтвердить себе на чистому релізі.

## Related pages

- [weekly-digest](../pipeline/weekly-digest.md)
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md)
- [log](../log.md)
- [audits/2026-08-21-weekly-digest-release-backtest](2026-08-21-weekly-digest-release-backtest.md)
