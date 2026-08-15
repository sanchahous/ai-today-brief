# Illustration PR-stack review (#241–#264) — findings і виправлення

Summary: технічне ревʼю 24 PR (#241–#264), якими виконано `weekly-illustration-plan.md`, звірка з планом і кодом на `main`; знайдено 4 блокери, 8 дефектів якості, 4 безпекові/цілісні прогалини, 6 операційних — усі виправлені на гілці `feat/weekly-illustration-fixes`.
Sources: дифи всіх 24 PR, `pipeline/card-image.ts`/`prompt-export.ts`/`scene-grammar.ts`/`concept-mapping-gate.ts`, `src/lib/weekly-digest/*`, `src/app/admin/(cms)/weekly/actions.ts`, RLS `supabase/migrations/001_initial_schema.sql`, `.github/workflows/*.yml`, live `npm run pr:check` 2026-08-15.
Last updated: 2026-08-15

---

## Контекст

24 PR (`feat/weekly-scene-grammar-router` … `feat/weekly-card-origin-reencode`), кожен — одна
хвиля [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md), стековані один на
одному, кожен окремо пройшов `npm ci` у CI (не повний `pr:check` — див. F21 нижче). Дисципліна
виконання висока: план дотримано буквально, заборони (не портувати V10 treatment, не рахувати
регексами по story-тексту, не чіпати SVG-рендерери) дотримані. Знайдені дефекти — не відхилення
від плану, а прогалини, яких план не міг передбачити на такому рівні деталізації.

Усі виправлення нижче зроблено на гілці `feat/weekly-illustration-fixes` (від вершини стека,
`feat/weekly-card-origin-reencode`), 24 коміти, окремо по хвилях R1–R4.

## P1 — блокери (виправлено, хвиля R1)

| # | Дефект | Файл(и) | Фікс |
|---|---|---|---|
| F1 | `storyImageSceneInput` будував крос-story siblings лише з метаданих `story_image`; M1 більше не пише цю метадату (`story_prompt_set` замість неї) → диверсифікація між story мовчки відмирала для кожного дайджесту | `generation-worker.ts` | `siblingHintsFromStorySiblingArtifact` читає й `story_prompt_set`, і `story_image` (render-режим) |
| F2 | `produceStoryPrompts` кидав exception при повному провалі mapping gate → джоба ретраїться і падає, замість показати «0/3» | `story-prompt-job.ts`, `concept-mapping-gate.ts` | `mappingGateReport` повертає issues; порожній `story_prompt_set` + `needs_owner_review` замість throw |
| F3 | Daily rerank писав `rankModelsForRole(...).slice(0, 3)` у СПІЛЬНУ чергу `openrouter` — обрізав family-tail, яку сама функція обіцяє повертати; усі ролі без власного `llm_role_chains` втрачали резервний ланцюжок | `providers/model-rerank.ts`, `scripts/rerank-openrouter-models.ts` | не обрізати; `OPENROUTER_RERANK_APPLY=off` kill-switch |
| F4 | `QUALITY_FLOOR` — `Partial`, поріг лише для 3 з 13 ролей; без порога «якість/долар» завжди обирає найдешевшу модель (пастка `ling-2.6-flash`, index 14.2) | `providers/model-scoring.ts` | повний `Record<ProviderRole, number>` з ступінчастими порогами |

## P2 — якість (виправлено, хвиля R2)

| # | Дефект | Фікс |
|---|---|---|
| F6/F7 | Грамматика (`selectSceneGrammar`) читала story-рівневі сигнали, спільні для всіх 3 концептів → один metric у заголовку робив усі три діаграмою, хоча власник хоче вибір «сцена/діаграма» | Кап на лінзу `mechanism`; `requiresProcessGrammar` (C5.3) підключено до рішення, а не лише обчислено |
| F8 | B1-fix винятковував ВЕСЬ `WEEKLY_CRAFT_BANNED_OTHER` за буквальним джерелом, не лише `terminal` — новина про dashboard/IDE могла відкрити буквальний скріншот | Виняток лишився лише для `terminal` (єдиний термін із фізичним значенням) |
| F9 | `motifFamilyKey` для крос-story siblings падав на `sceneSummary`/`''` замість `subject`/`setting` — родину мотивів між story ніколи не ловив | `subject`/`setting` пронесено `sceneBriefFromPitch` → `StoredStoryPrompt` → sibling hints |
| F10/F11 | `translateFluxToCanonical` мовчки деградує до `firstSentence()` при дрейфі формату; `takeWords(scene, 70)` різав посеред фрази | Guard-тест на реальний `buildEditorialConceptPrompt`; `clauseSafeTake` ріже по межі речення |
| F5/F12 | Owner-типізований «Edit direction» (scene_override) ігнорувався в prompt_only-режимі; `owner_direction` мітився як `literal_context`, змішуючи два різні калібрувальні сигнали | `weeklyReportageConcepts` (екстрактовано з render-функції) підключено до `produceStoryPrompts`; `conceptLens` зберігає `owner_direction` |

## P2 — безпека/цілісність (виправлено, хвиля R3)

| # | Дефект | Фікс |
|---|---|---|
| F14 | `ignorePostUploadQaAction`/owner-feedback дії шукали артефакт лише за `id`, без звірки з переданим `weekly_digest_id` | `.eq('weekly_digest_id', ...)` на обох запитах |
| F13 | Прямий read-modify-write UPDATE на `content`/`metadata` без захисту від гонки (дві owner-feedback дії поспіль могли затерти одна одну) | Optimistic-concurrency retry на `updated_at` (3 спроби) |
| F15 | `briefs.cover_prompt` читається anon — RLS `public_read_briefs` рядковий, не колонковий; коментар «не селектиться публічно» — не гарантія | `revoke select (cover_prompt) on briefs from anon, authenticated` |
| F20 | Новий workflow без `permissions:` | `permissions: contents: read` |

## P3 — операційне (виправлено, хвиля R4)

| # | Дефект | Фікс |
|---|---|---|
| F16 | `reencodeOneCardOrigin` видаляв старий `.png` одразу після успіху — ламає вже розшарені OG-картки/кеш анфьорлерів/індексовані URL | Keep-both за замовчуванням; `purgeOldPng: true` / `--purge-old-png` — явний опційний крок |
| F17 | SELECT для reencode-кандидатів без `.limit()` — неявний PostgREST cap міг занижувати `pending`/`skipped` | `CARD_ORIGIN_REENCODE_QUERY_LIMIT = 5000` + warning-лог при досягненні |
| F18 | Post-upload QA могла зависнути в «перевіряє…» назавжди без можливості повторити | `recheckPostUploadQaAction` + кнопка «Перевірити ще раз» |
| F19 | `resolveWeeklyStoryImageMode` — строга рівність з `'render'`; `'RENDER'`/пробіли мовчки давали `prompt_only` | `.trim().toLowerCase()` перед порівнянням |
| F21 | `e2e.yml`/`sonarqube.yml` тригеряться лише на `pull_request → main`; жоден із 24 PR не таргетив `main` напряму — реально відпрацював лише `npm ci` | Живий `npm run pr:check` прогнано локально на цій гілці (див. нижче) |

Не зроблено окремо (низький пріоритет / вимагає ширшого рішення власника, не блокує):
F22 (агрегація owner_feedback у окремий calibration-датасет), F23 (e2e на Visuals prompt-картки —
у сьюті взагалі немає авторизованого Playwright для `/admin/weekly`), F24 (поріг «дистинктності»
для <2 промптів).

## Живий `npm run pr:check` (2026-08-15, ця гілка)

- `ci:check` (vitest + coverage): **1389/1389 тестів зелені**.
- `typecheck`: чисто.
- `lint`: 0 помилок, 7 попередніх warnings (не повʼязані з цією гілкою: `pipeline/db.ts` невикористаний eslint-disable, `telegram/route.ts` console, `news-sidebar.tsx` невикористаний import).
- `e2e:check` (мапа affected-специфікацій, не повний Playwright): OK.
- `wiki:check`: провалювався до цієї сторінки й супутніх правок (лічильник міграцій, застарілі
  `card-images`/`env-feature-flags`/`weekly-digest` watchers) — закрито в цьому ж коміті.
- `build`: не запускався в межах цього ревʼю-проходу окремо від `pr:check`.

**Не перевірено:** повний Playwright e2e (`npm run e2e`) — цей репозиторій не має
авторизованого сьюту для `/admin/weekly` (лише login-shell), той самий відомий розрив, що вже
задокументований у P2 story_prompt_set (див. [weekly-digest](../pipeline/weekly-digest.md)).
SQL-тести (`supabase/tests/*.sql`) не виконувались — немає локального Supabase CLI/Docker у цій
сесії; жоден CI-workflow їх також не запускає (перевірено — конвенція проєкту, не регресія цієї
гілки).

## Related pages

- [pipeline/weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) — план, який ці 24 PR виконували
- [pipeline/weekly-digest](../pipeline/weekly-digest.md) — weekly-пайплайн загалом
- [marketing/card-images](../marketing/card-images.md) — політика ілюстрацій
- [pipeline/llm-providers](../pipeline/llm-providers.md) — реєстр провайдерів (F3/F4 контекст)
- [now](../now.md) — поточний стан
- [open-questions](../open-questions.md) — відкриті питання
