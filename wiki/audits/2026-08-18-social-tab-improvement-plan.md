# Social tab — review і готовий до реалізації план покращень

Summary: executor-spec для виправлення медіа, channel-aware редагування, Threads/X
структури, Instagram-каруселі та factual review у вкладці Social weekly Content Studio.
Sources: owner review і скриншоти вкладки Social 2026-08-18;
`src/lib/weekly-digest/generation-worker.ts`; `src/lib/social/quality.ts`;
`src/lib/social/content-hash.ts`; `src/lib/social/worker.ts`;
`src/components/admin/hook-candidate-picker.tsx`; `src/app/admin/actions.ts`;
`src/lib/weekly-digest/admin-data.ts`; production Social package read-only audit 2026-08-18.
Last updated: 2026-08-18

---

Це **executor-spec**, а не реалізація. PR із цим документом не змінює product code,
Supabase schema або production-дані. Виконавець має реалізувати описані нижче контракти без
додаткових продуктових рішень.

## 1. Підтверджені проблеми

### P0 — channel illustrations посилаються на PDF

Telegram, Facebook, X, Threads і LinkedIn отримують той самий signed URL артефакту
`linkedin-document:en` з MIME `application/pdf`, тому браузер не може показати його як
зображення. Причина — широкий regex вибору landscape asset, який також матчить слово
`linkedin`, і неповна перевірка MIME: asset без заповненого `mimeType` проходить quality gate.
(source: production Social package read-only audit 2026-08-18;
`src/lib/weekly-digest/generation-worker.ts`; `src/lib/social/quality.ts`)

Signed URL записується безпосередньо в `social_posts.asset_urls` на сім днів. Адмінка
перепідписує weekly artifacts, але не URL у Social posts; delivery worker використовує
збережений URL. Відкладений пост тому може дійти до publisher вже з простроченим посиланням.
(source: `src/lib/weekly-digest/generation-worker.ts`;
`src/lib/weekly-digest/admin-data.ts`; `src/lib/social/worker.ts`)

### P0 — Threads hook пошкоджує структуру поста

Hook picker вставляє серіалізований candidate з `<PART>` у root textarea і обрізає його через
`slice(0, textarea.maxLength)`. `content_parts` при цьому не оновлюються. Адмінка може показувати
обрізаний текст зі службовим маркером, а delivery — відправити старі частини, яких owner не
бачить у root-полі. Текст зі скриншота точно відповідає цьому сценарію.
(source: owner screenshot 2026-08-18;
`src/components/admin/hook-candidate-picker.tsx`; production Social package read-only audit)

### P0 — Instagram renderer обрізає текст

Поточний renderer переносить рядки за приблизною кількістю символів і потім безумовно залишає
перші десять рядків. Фактична ширина гліфів і доступна висота не вимірюються, тому текст виходить
за праву межу або мовчки зникає. Поточні текстові слайди перевантажені й візуально підтверджують
дефект. (source: owner screenshot 2026-08-18;
`src/lib/weekly-digest/generation-worker.ts`)

Сам формат каруселі лишається: продуктовий вибір — **гібрид із семи слайдів**, де три слайди
використовують approved story images, а решта дають короткий структурований контекст.
(source: owner decision 2026-08-18)

### P1 — ручний factual review має неповний контекст

Ручний save будує source facts лише з title/summary/why/practical/takeaway і не включає повні
article facts та approved claims, які доступні під час генерації. Через це коректні числа з
approved story bodies можуть отримувати false-positive flags. (source:
`src/app/admin/actions.ts`; `src/lib/weekly-digest/generation-worker.ts`;
production Social package read-only audit 2026-08-18)

### P1 — форма показує неканонічні або дубльовані поля

CTA і hashtags у поточному пакеті порожні як metadata, але вже присутні у channel-native copy.
`first_comment` потрібен лише X, а `content_parts` — X, Threads та Instagram. Загальна форма
створює кілька джерел правди й дозволяє редагувати raw JSON незалежно від тексту, який бачить
owner. (source: production Social package read-only audit 2026-08-18;
`src/components/admin/weekly-workspace.tsx`)

## 2. Цільовий контракт медіа

### 2.1 Persisted reference і resolved asset

Не додавати таблиці або колонки. Розширити JSON у `social_posts.asset_urls` backward-compatible
контрактом:

```ts
type PersistedSocialAssetRef = {
  artifactId?: string;
  url?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  bytes?: number;
};

type ResolvedSocialAsset = {
  url: string;
  artifactId?: string;
  width?: number;
  height?: number;
  mimeType: string;
  bytes?: number;
};
```

- Нові private weekly assets зберігають `artifactId`; `url` є лише snapshot для сумісності й не
  є довготривалим delivery contract.
- Legacy public HTTPS assets без `artifactId` залишаються підтриманими.
- Legacy private signed URL без `artifactId` вважається unsafe/stale і повертає явну помилку,
  а не проходить мовчки.

### 2.2 Єдиний asset resolver

Додати серверний resolver, який використовується admin loader-ом і delivery worker-ом:

1. Парсить unknown JSON у `PersistedSocialAssetRef[]`.
2. Для `artifactId` читає актуальний `weekly_digest_artifacts` row.
3. Вимагає current/ready artifact та MIME `image/*`.
4. Створює signed URL строком на 60 хвилин без запису URL назад у БД.
5. Повертає `ResolvedSocialAsset[]` для UI або publisher-а.
6. На missing, superseded, non-image чи storage signing failure повертає typed blocker.

`content-hash` канонізує asset за `artifactId`, MIME, dimensions і bytes. Signed URL не бере
участі в hash, якщо `artifactId` присутній; для legacy URL-only asset URL лишається частиною hash.

### 2.3 Вибір channel assets

- Telegram, Facebook, X і Threads: approved `social-landscape:*`; якщо його немає — approved
  `cover:neutral`.
- LinkedIn: те саме preview image; PDF зберігається лише як `meta.document_artifact_id` і ніколи
  не потрапляє в image assets.
- Instagram: approved `cover:neutral` плюс три різні approved `story_image`, прив'язані до
  revision items поточного digest.
- Selector спочатку фільтрує current/ready/approved `image/*`, а вже потім перевіряє kind.
- Quality gate блокує missing/unknown/non-image MIME, нульові dimensions, невідповідний aspect
  ratio та відсутній `artifactId` для нового private weekly asset.

## 3. Channel-aware Social UI

Замінити універсальну форму на channel descriptor, який визначає видимі поля, parser,
ліміти та серіалізацію.

| Канал | Поля редагування | Похідні дані |
|---|---|---|
| Telegram | post copy, destination/UTM, alt, schedule | без `content_parts` |
| Facebook | post copy, destination/UTM, alt, schedule | без `content_parts` |
| LinkedIn | post copy, destination/UTM, alt, schedule | document status/link окремо від image |
| X | root post, self-reply, destination/UTM, alt, schedule | `content_parts = [root, reply]` |
| Threads | 3–5 part textareas, destination/UTM, alt, schedule | `post_text = parts[0]` |
| Instagram | caption, read-only 7-slide preview, alt, schedule | carousel spec — source of truth |

Обов'язкові правила:

- Не показувати окремі CTA і Hashtags: вони редагуються всередині channel-native copy.
- `first_comment` показувати тільки X.
- Прибрати raw JSON editors для `content_parts` та `asset_urls`.
- Показувати read-only media summary: thumbnail, kind, MIME, dimensions і validation state.
- Показувати LinkedIn PDF як document attachment, не як thumbnail.
- Заборонити збереження службових маркерів `<PART>`, `<SLIDE>` і `<CAPTION>` у visible copy.
- Будь-яка зміна visible copy, parts, carousel spec або stable artifact ID збільшує version,
  змінює content hash і штатно скидає approval.

### 3.1 Hook candidates

Винести pure parser/selector, спільний для client behavior і tests:

- Threads: split за `<PART>`, trim, рівно 3–5 непорожніх частин, кожна до 500 символів; selector
  атомарно оновлює `post_text` і весь `content_parts`.
- X: candidate оновлює root; tracked URL залишається у self-reply; parts заново серіалізуються.
- Telegram, Facebook, LinkedIn: candidate оновлює лише root copy.
- Instagram candidates показуються read-only: заміна angle запускає повну регенерацію spec і
  зображень, щоб caption і слайди не розходились.
- Невалідний candidate не обрізається; UI показує причину й не змінює draft.

## 4. InstagramCarouselSpec і renderer

### 4.1 Структура

Зберігати source of truth у `social_posts.meta.instagram_carousel`:

```ts
type InstagramCarouselSpec = {
  version: 1;
  angle: string;
  hookCandidates: [string, string, string];
  caption: string;
  slides: [
    { kind: "cover"; headline: string },
    { kind: "story"; revisionItemId: string; headline: string; body: string },
    { kind: "story"; revisionItemId: string; headline: string; body: string },
    { kind: "story"; revisionItemId: string; headline: string; body: string },
    { kind: "comparison"; headline: string; body: string },
    { kind: "caveat"; headline: string; body: string },
    { kind: "takeaway"; headline: string; body: string }
  ];
};
```

Validation contract:

- рівно сім слайдів і саме такий порядок kinds;
- три унікальні `revisionItemId`, наявні в current revision;
- для кожного story ID існує approved `story_image`;
- cover headline — максимум 72 символи;
- решта headline — максимум 54 символи;
- body — максимум 120 символів;
- caption — 180–800 символів, без URL, максимум п'ять hashtags;
- якщо немає трьох approved story images, Instagram generation завершується blocker-ом без
  мовчазного fallback.

### 4.2 Рендеринг

- Рівно сім JPEG 1080×1350.
- Slide 1 використовує approved cover; slides 2–4 — відповідні story images; slides 5–7 —
  brand information cards.
- Перенос робиться за виміряною canvas-шириною гліфів, а не за кількістю символів.
- Layout function повертає обраний font size, lines і bounds; її можна unit-test без storage.
- Ввести safe area для тексту й footer, максимальну ширину, line height та мінімальний font size.
- Не використовувати обрізання рядків або тексту. Якщо layout не вміщується на мінімальному
  font size, renderer повертає typed overflow blocker.
- Зберігати versioned artifacts `instagram-carousel:1..7:en`; попередній набір стає non-current
  через чинний artifact lifecycle.
- `content_parts` можна зберігати як backward-compatible readable projection, але renderer і
  admin preview читають структурований spec.

## 5. Єдиний factual review

Винести `buildWeeklySocialFactSnapshot` і використовувати його під час generation та manual save.
Snapshot включає article facts, approved claim facts, title, summary, why-it-matters і practical
takeaway для потрібної locale.

Critic отримує channel-native повний текст:

- Threads — усі parts;
- X — root і self-reply;
- Instagram — caption та всі поля carousel spec;
- решта — повний post copy.

Approval policy:

- `Save` дозволений із warnings і лишає variant у `in_review`.
- `Save & approve` заблокований при factual score нижче 85, factual blockers, asset blockers або
  відсутньому critic result, коли `SOCIAL_CRITIC_REQUIRED` увімкнено.
- Якщо critic optional і недоступний, звичайний save отримує warning, але approval не повинен
  обходити вже наявні structural/asset blockers.

## 6. Controlled repair поточного пакета

Додати `scripts/repair-weekly-social-package.ts` і npm command
`weekly:social:repair`. Команда за замовчуванням працює в dry-run; запис дозволений лише з
`--apply --package-id <uuid>`.

Preconditions:

- package — weekly digest у `in_review`;
- revision — current;
- наявні всі шість channel variants;
- жоден variant не має `publishing` або `posted`;
- publishing для пакета вимкнений owner-ом;
- наявні approved cover і щонайменше три approved story images.

Apply behavior:

1. Зберегти copy, parts, destination, UTM і schedule для Telegram, Facebook, X, Threads та
   LinkedIn.
2. Замінити їхній PDF image reference на approved image artifact.
3. Лишити LinkedIn PDF тільки в document metadata; `draft_ready` не трактувати як image-ready.
4. Повністю регенерувати Instagram spec і сім artifacts.
5. Повторно запустити factual та asset quality checks.
6. Збільшити versions, перевести всі шість variants у `in_review` і скинути approvals через
   чинний content-hash/approval механізм.
7. Додати `social_post_reviews.action = 'edited'` із repair reason; не підставляти owner як
   reviewer автоматично.

Скрипт ідемпотентний: повторний dry-run після apply не пропонує нових змін. Якщо schedule минув
або до нього менше двох годин, окремо запропонувати новий channel schedule; не публікувати й не
approve автоматично.

Production repair не є частиною code PR. Послідовність після deploy: owner pause → dry-run →
apply → read-only verification → owner review усіх каналів → approvals → publishing enable.

## 7. Тести й acceptance criteria

### Unit та integration

- Selector виключає PDF навіть якщо kind містить `linkedin`; cover fallback працює.
- Resolver створює свіжий URL, відхиляє superseded/non-image artifact і не мутує Social post.
- Content hash стабільний після re-sign того самого artifact та змінюється після заміни ID.
- Quality gate відхиляє missing/unknown/non-image MIME і неправильні dimensions.
- Worker передає publishers resolved URL; DB copy/hash не змінюються під час resolution.
- Threads fixture зі скриншота дає повні parts без маркера й обрізання.
- X root/reply та `content_parts` завжди узгоджені.
- Instagram schema перевіряє count, order, IDs, text limits і hashtags.
- Layout bounds усіх рядків лежать усередині safe area; overflow fixture завершується blocker-ом.
- Renderer створює сім JPEG 1080×1350 із правильними artifact kinds.
- Manual factual audit бачить article body facts та approved claims; score `<85` блокує approval,
  але не звичайний save.

### E2E

- Для кожного каналу видно тільки його поля.
- Усі image previews повертають `image/*`; LinkedIn PDF показаний окремо.
- Threads candidate атомарно оновлює всі parts; у UI і payload немає `<PART>`.
- Instagram показує сім thumbnails без overflow.
- Зміна content або artifact скидає approval; re-sign того самого artifact — ні.
- Перевірити desktop і viewport 390 px.

### Release gate

1. Targeted Vitest suites зелені.
2. `npm run pr:check` зелений.
3. Shadow generation тестового weekly digest створює валідні variants без записів у production.
4. Repair script dry-run показує очікувані п'ять non-Instagram image refs і сім Instagram JPEG.
5. Після production apply всі signed URLs повертають `image/*`, blockers дорівнюють нулю, а
   variants лишаються `in_review` до ручного approval.

## 8. Межі реалізації

- Не створювати нову DB schema або паралельну asset table.
- Не зберігати довготривалий private signed URL як єдине посилання на asset.
- Не дозволяти raw JSON editing у звичайному owner flow.
- Не approve, не schedule і не publish variants автоматично під час repair.
- Не змінювати затверджений Telegram/Facebook/X/Threads/LinkedIn copy без окремої factual причини.
- Не замінювати Instagram карусель одним зображенням: затверджений формат — hybrid 7 slides.

## Related pages

- [Weekly digest pipeline](../pipeline/weekly-digest.md)
- [Weekly admin runbook](../ops/weekly-admin-runbook.md)
- [Custom social delivery](../marketing/custom-social-delivery.md)
- [Wiki index](../index.md)
