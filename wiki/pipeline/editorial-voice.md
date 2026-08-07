# Editorial Voice — weekly digest house style

Summary: чому старий weekly-контент читався «машинно», яке архітектурне рішення це фіксує
(`editorial-voice.ts`), і як власник курує голос редакції з часом.
Sources: `src/lib/weekly-digest/editorial-voice.ts`, `src/lib/weekly-digest/editorial-llm.ts`,
`src/lib/weekly-digest/content-studio.ts`, owner session 2026-08-06 (feedback + опитування),
план `feat/weekly-editorial-voice`, PR #189 (змержено 2026-08-07)
Last updated: 2026-08-07

---

## Проблема, яку це вирішує

Власник переглянув живий випуск (`ai-weekly-2026-07-27`) і забракував якість усього контенту:
тексти «написані машиною для машин», заголовки — абстрактні тези а не новини, службові поля
(`practical`, `limitation`, `takeaway`) вшивались у тіло статті власними мітками («Практичний
сценарій:», «Обмеження полягає в тому»), аудиторія промпту була «product & security leaders»,
хоча реальна аудиторія — розробники й техно-цікава публіка. (source: owner session 2026-08-06,
live DB read `weekly_digest_artifacts` revision `1cb9dbf6` — `ai-weekly-2026-07-27`)

Корінна причина (діагностована по коду, не за здогадкою): старий майстер-промпт витрачав ~250
символів на голос проти ~4500 символів на JSON-контракт і правила grounding'у. Усі стильові
інструкції були **негативними** («never clickbait», «no hype») — без жодного позитивного
зразка того, як має виглядати добрий текст, модель регресувала до найбезпечнішого, найбільш
шаблонного регістру. (source: `src/lib/weekly-digest/editorial-llm.ts`, попередня версія
`englishPrompt`/`ukrainianPrompt` до цього PR). Детальний діагноз —
[weekly-digest](weekly-digest.md#editorial-voice-overhaul-2026-08-06).

## Архітектура: єдине джерело голосу

`src/lib/weekly-digest/editorial-voice.ts` — TypeScript-модуль (не markdown), бо його
споживають одразу два раннери (Vercel job worker і GitHub Actions Claude CLI worker), а
regex-списки заборонених фраз потребують vitest-покриття. Експортує:

- **`VOICE_EN` / `VOICE_UK`** — позитивна модель голосу («жива редакція з думкою», sharp
  colleague explaining over coffee), написана нативно для кожної мови, а не перекладена.
  UK-версія має власний список кальок/канцеляризмів.
- **`EXEMPLAR_EN` / `EXEMPLAR_UK`** — один повний зразок відкриття feature-історії (~120 слів),
  явно позначений «style reference only — do not reuse facts».
- **`CONTRAST_PAIRS_EN` / `CONTRAST_PAIRS_UK`** — 3 пари «уникай → пиши так» на прикладах з
  реального забракованого випуску (компліанс-регістр → живе речення). Контраст-пари дешевші за
  повні зразки (~10% токенів) і краще вчать регістру.
- **`SPECULATION_SPEC_EN` / `SPECULATION_SPEC_UK`** — правила блоку «Погляд редакції»
  (`editorsView`): сміливе, але явно марковане припущення про наслідки, 60–110 слів, не
  повторює тіло статті, закінчується відкритим напруженням для `discussionQuestion`.
- **`BANNED_PHRASES_EN` / `BANNED_PHRASES_UK`** — детерміновані regex-детектори: витік шаблону
  (мітки полів усередині тіла — «Practical scenario:», «Обмеження полягає в тому»,
  «Висновок для рішення:») та типові AI-tell фрази («delve into», «варто зазначити», «у світі
  ШІ», рамка «для керівників»). Споживаються `detectTemplateLeaks()` у `content-studio.ts` —
  безкоштовний блокуючий гейт **до** виклику LLM-критика.

`voicePromptBlock(locale)` збирає ці частини в один блок, який `editorial-llm.ts` вставляє і в
англійський, і в український майстер-промпт. (source: `src/lib/weekly-digest/editorial-voice.ts`,
`src/lib/weekly-digest/editorial-llm.ts`)

### Пастка з Unicode-регексами (задокументовано в коді)

`\w` і `\b` у JS-регексах без прапорця `/u` **не** розпізнають кириличні літери — `\w*` після
кириличного кореня матчить нуль символів, а `\b` перед кириличним словом після пробілу може не
спрацювати. Перше зафіксовано тестом (`editorial-voice.test.ts`, правило `ai_tell_landscape`);
виправлення — явний символьний клас `[а-яіїєґА-ЯІЇЄҐ]*` замість `\w*`. Будь-яке нове UK-правило
з `\w`/`\b` треба перевіряти на реальному кириличному реченні, не лише компілювати.

## Як власник курує голос з часом

Правки exemplar/contrast-pairs/banned-phrases — прямі зміни в `editorial-voice.ts` (не окремий
конфіг-файл, свідоме рішення: типізація + тести). Після кожної зміни:

1. Оновити відповідний тест у `editorial-voice.test.ts` (кожне правило має власний sample-тест —
   регрес одразу видно).
2. Бампнути `WEEKLY_MASTER_SPEC_VERSION` у `content-studio.ts`, якщо зміна стосується того, що
   писатиме модель (а не лише детектора) — це форсує реген існуючих чернеток.
3. `npm run wiki:sync` підхопить дату; вручну оновити цей файл, якщо додався новий тип правила.

## Що це НЕ вирішує (заплановано окремими PR)

- Відеосценарій і соц-голос — окремі PR (6–7), кожен зі своєю точкою в
  `voicePromptBlock`/`bannedPhrasesFor`.

**Вирішено PR2 (2026-08-06):** рендеринг `editorsView`/`discussionQuestion`/`limitation` на
сайті — `weekly-story.tsx` тепер їх читає й показує (умовно, старі випуски без цих полів
рендеряться як раніше).

**Вирішено PR3 (2026-08-06):** рубрика критика — виміри `engagement`/`voice` з якорями
(90/75/55) замість `hook`/`structure`; line-edit pass замість повної регенерації на revisable
провалах; ретраї більше не накопичуються назавжди (лише останній звіт). **Змержено в `main`
2026-08-07** (PR #189) — жодного живого прогону в проді через реальний job-пайплайн ще не було
(останній прогін у БД — 2026-08-05, до мержу).

**Вирішено PR4 (2026-08-06):** кут подачі (`weekly_digest_story_directions`, keyed by
`brief_item_id`) — власник задає обов'язковий напрям для кожної з трьох головних історій на
Research tab; `englishPrompt` трактує його як binding editorial direction. Спрощено проти плану:
без AI-згенерованих пропозицій кута (research pack лишається 100% детермінованим, без LLM) —
лише вільний текст від власника.

**Вирішено PR5 (2026-08-06):** репортажні ілюстрації (`weeklyReportageSceneBrief` +
`buildWeeklyPrompt` у `card-image.ts`, повністю окремо від daily-шляху) + вибір з 3 варіантів
на Visuals tab + редагована сцена. Заодно виправлено мертвий `negative_prompt` на klein (тепер
вшитий у позитивний промпт). **Змержено в `main` 2026-08-07** (PR #189) — dry-run 9 klein-рендерів
пройдено раніше (2026-08-06, стиль оцінено власником позитивно), але через реальний job-пайплайн
(не ручний скрипт) ще не запускалось. Деталі —
[weekly-digest](weekly-digest.md#editorial-voice-overhaul-2026-08-06).

**Стан на 2026-08-07:** усі 7 PR цього перегляду в `main`. Перед завтрашнім (08.08) новим
weekly-випуском знайдено й виправлено: PDF page-cap regression (13 сторінок замість 20-21, гілка
`fix/weekly-pdf-page-cap`), дві незастосовані міграції (`weekly_video_script_job`,
`weekly_digest_story_directions` — обидві застосовано до прод-БД). Деталі —
[weekly-digest § PDF page-count contract violation](weekly-digest.md#pdf-page-count-contract-violation--фікс-2026-08-07).

## Related pages

- [weekly-digest](weekly-digest.md) — повний пайплайн і статус розкатки
- [weekly-editorial-selection](weekly-editorial-selection.md)
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md)
- [now](../now.md)
