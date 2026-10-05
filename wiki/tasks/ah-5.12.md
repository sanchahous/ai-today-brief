# AH-5.12

Summary: Реалізовано About і Author EN/UK; усунуто залежність клавіатурного E2E від наявності результатів у пошуковому індексі. HTTP SEO compare пройшов для чотирьох маршрутів; повний гейт і браузерний повтор заблоковані spawn EPERM.
Sources: `src/app/[lang]/about/page.tsx`, `src/app/[lang]/author/page.tsx`, `src/components/editorial/editor-profile.tsx`, `src/lib/site.ts`, `artifacts/after-hours/pages.js`, `e2e/search-dialog-keyboard.spec.ts`, звіт оркестратора FIX T1-f1, локальні перевірки 2026-10-05, [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429), перенос ATB-67 PR #405
Last updated: 2026-10-05

---

Task: ah-5.12

## Status

### epic-5.3

```verbatim
| AH-5.12 | About і Author | M | агент | AH-5.1, AH-3.4 | routes `about`, `author` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

Статус: **BLOCKED**. Виправлення збережено для [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429). Локальний `PORT=3103 npm run pr:check` проходить design ratchet, але завершується з кодом 1 на завантаженні Vitest/Vite через `spawn EPERM`; Playwright також не може створити worker-процес. Підтвердження браузерного виправлення та повного гейту ще немає. (source: `artifacts/_local/ah-5.12/t1-f1-pr-check-after.log`; `artifacts/_local/ah-5.12/t1-f1-direct-server-retest.log`; локальні запуски 2026-10-05)

## Changes

- About: інтро «Інтелект потребує людського погляду», split із бренд-артом, 4 кроки редакційного процесу, картка редактора й спільний NewsletterForm band. Непідтверджені числа джерел не перенесені. (source: `src/app/[lang]/about/page.tsx`; `artifacts/after-hours/pages.js`)
- Author: breadcrumb, ініціали з реального імені, профілі й експертиза з site.ts, лише наявні в API рубрики фокусу, стандарти та до трьох останніх опублікованих матеріалів через StoryRow. Порожні рубрики й матеріали приховані. Використовується наявний кеш `getNewsPageData(lang)`, як на News, без окремого ключа для трьох матеріалів. (source: `src/app/[lang]/author/page.tsx`; `src/lib/news.ts`; `src/app/[lang]/news/page.tsx`)
- Server Components, ISR 86400, metadata, canonical, hreflang, Person і Organization збережені; AboutPage отримав відсутнє поле name. Нових залежностей, сцен motion, змін pipeline чи контактів немає. Спільні статусні файли не змінено. (source: diff 2026-10-05; `src/lib/schema.ts`)

## Acceptance evidence

- [x] HTTP SEO compare — **0 регресій** для `/en/about`, `/uk/about`, `/en/author`, `/uk/author` проти checked-in baseline. Перевірено HTTP 200, один H1, Person name/alternateName/sameAs, незмінний Organization і контакт із site.ts. Використано наявну production-збірку цієї робочої копії, запущену на PORT=3103, та оригінальні parseSeoHtml/compareSeoSnapshots через Node type stripping. CI-origin у E2E враховується через expectedSiteUrl(). (source: `artifacts/_local/ah-5.12/t1-f1-http-seo.log`; `artifacts/_local/ah-5.12/t1-f1-entities-art.log`; `e2e/about-author.spec.ts`; локальний запуск 2026-10-05)
- [x] Концепт-арт: AVIF 1600×900 — 32 554 байти ≤ 35 000; 800×450 — 13 548 байтів ≤ 15 000. Оригінальні файли прототипу скопійовані без перекодування. Picture + next/image, WebP fallback, явні 1600×900, alt і підпис EN/UK. Це бренд-арт, не ілюстрація новини. (source: `artifacts/after-hours/assets/`; `public/images/after-hours/`; локальний Sharp metadata/stat 2026-10-05; `src/app/[lang]/about/page.tsx`)
- [x] Контакти, ім’я, роль, профілі й експертиза — лише з site.ts. Демонстраційні адреси не перенесено. (source: `src/components/editorial/editor-profile.tsx`; обидві сторінки)
- [ ] §0.1: повний pr:check, CI, QA-матриця та візуальні докази — **очікують**. Чотири маршрути EN/UK додано до існуючої gating-матриці Night/Day, 360/390/768/1024/1440, 200% тексту й reflow 320. Preview та before/after не отримано. (source: `e2e/fixtures/a11y-gating.json`; `e2e/a11y-layout-matrix.spec.ts`; локальний гейт 2026-10-05)

## Checks

### Первинні перевірки реалізації

- `PORT=3103 npm run pr:check` — FAIL, exit 1 на першому етапі design:raw:check: spawn EPERM у node_modules/esbuild/lib/main.js. Coverage, решта гейту та build:ci не запускалися. (source: локальний запуск 2026-10-05)
- `npm run design:raw:check` — той самий блокер. Оригінальний checker окремо виконано через Node stdin і typescript.transpileModule без esbuild чи зміни правил: **PASS**, raw-design ratchet без нових/вилучених значень. (source: `artifacts/_local/ah-5.12/raw-check.log`; локальний запуск 2026-10-05)
- `npm run typecheck` і `node node_modules/typescript/bin/tsc --noEmit` — **PASS**. Цільовий `node node_modules/eslint/bin/eslint.js` — **PASS** для сторінок, редакторського компонента, unit/E2E-тестів після фінальних змін. `git diff --check` — **PASS**. (source: локальні запуски 2026-10-05)
- `node node_modules/vitest/vitest.mjs run 'src/app/[lang]/about-author.test.ts'` — **BLOCKED** на завантаженні конфігурації Vite: spawn EPERM, тести не виконані. Unit-тести покривають сутності, metadata, контакти, концепт-арт та реальні/порожні списки. (source: локальний запуск 2026-10-05; `src/app/[lang]/about-author.test.ts`)
- Окремі in-process Node + React renderToStaticMarkup assertions із мокованим news API — **PASS** для EN/UK About/Author: схеми, canonical, контакти, newsletter, 4 кроки, порожній список і максимум три матеріали. Це перевірка без Next HTTP-сервера й браузера. (source: локальний запуск 2026-10-05; `artifacts/_local/ah-5.12/*-ssr.html`)
- `npm run wiki:check` — **BLOCKED**, exit 1: wiki:sync пройшов із 0 errors/0 warnings, далі node --test не може запустити дочірній процес (spawn EPERM). Окремі `node wiki/_tools/wiki-lint.mjs --strict` і `node wiki/_tools/wiki-tasks.mjs --check` — **PASS**. (source: `artifacts/_local/ah-5.12/wiki-check.log`; `artifacts/_local/ah-5.12/wiki-lint.log`; локальні запуски 2026-10-05)
- Оригінальний `scripts/e2e-affected.ts --check` виконано через Node stdin і typescript.transpileModule без esbuild — **PASS**, map OK (30 specs, 51 testids). Явні about-page/author-page testids пов’язують новий E2E-тест із маршрутами. (source: локальний запуск 2026-10-05; `e2e/about-author.spec.ts`)

### Repair T1-f1 — 2026-10-05

- Причина відхиленого push: тест клавіатури очікував непорожній live-пошук `agent`; у повернутому error-context діалог показував «No stories match — try another term.». Це залежність тесту від даних; вона не доводить регресію About/Author. Оркестратор повідомив 574 passed, 1 skipped, 1 failed. (source: звіт оркестратора FIX T1-f1 та прочитаний error-context 2026-10-05)
- Виправлення: лише перший клавіатурний сценарій перехоплює `/api/search` і повертає typed SearchPreviewItem fixture. Тест перевіряє q/lang/limit запиту, заголовок і href результату, ArrowDown/ArrowUp, Enter до точного fixture permalink та закриття діалогу. Fixture permalink перевіряє навігацію; існування статті за ним не є предметом цього сценарію. Інші два тести залишаються без перехоплення; перевірка zero requests для порожнього запиту збережена. Timeout, selectors, гейти й production-код не послаблено. (source: `e2e/search-dialog-keyboard.spec.ts`; локальний diff 2026-10-05)
- До виправлення: `PORT=3103 node node_modules/@playwright/test/cli.js test e2e/search-dialog-keyboard.spec.ts --project=chromium` — **BLOCKED**, exit 1, spawn EPERM до виконання тестів. Після виправлення та сама команда — **BLOCKED** з тією ж помилкою. (source: `artifacts/_local/ah-5.12/t1-f1-reproduce.log`; `artifacts/_local/ah-5.12/t1-f1-retest.log`)
- Прямий запуск `PORT=3103 DS_CATALOG=1 node node_modules/next/dist/bin/next start --port 3103` — **PASS**, сервер готовий. Повтор Playwright із `E2E_BASE_URL=http://127.0.0.1:3103` — **BLOCKED**, exit 1 саме у WorkerHost.startRunner / child_process.fork, тести не виконані. Сервер після HTTP-перевірок зупинено. (source: `artifacts/_local/ah-5.12/t1-f1-direct-server-retest.log`; локальний запуск 2026-10-05)
- `node node_modules/typescript/bin/tsc --noEmit` — **PASS**; `node node_modules/eslint/bin/eslint.js e2e/search-dialog-keyboard.spec.ts` — **PASS**; `PORT=3103 npm run e2e:check` — **PASS**, map OK (30 specs, 51 testids). (source: локальні запуски 2026-10-05)
- `node --experimental-strip-types --input-type=module` із HTTP assertions та оригінальним SEO checker — **PASS** на чотирьох маршрутах; окремі Organization/Sharp assertions — **PASS**, AVIF 1600×900 = 32 554 байти, 800×450 = 13 548 байтів. Перша спроба додаткової Organization assertion мала помилкове очікування `#editor`; після звірки з PERSON_ID виправлено лише діагностику на `#person`, production не змінювався. (source: `artifacts/_local/ah-5.12/t1-f1-http-seo.log`; `artifacts/_local/ah-5.12/t1-f1-entities-art.log`; `src/lib/schema.ts`; локальні запуски 2026-10-05)
- `PORT=3103 npm run pr:check` виконано до й після виправлення — **BLOCKED**, exit 1: design:raw:check проходить, coverage не стартує через spawn EPERM у Vite optimizeSafeRealPathSync. Решта гейту, migrations:check і build:ci не виконані. (source: `artifacts/_local/ah-5.12/t1-f1-pr-check-before.log`; `artifacts/_local/ah-5.12/t1-f1-pr-check-after.log`)
- `npm run wiki:check` — **BLOCKED**, exit 1: sync 0 errors/0 warnings, node --test не створює дочірній процес (spawn EPERM). Окремі `node wiki/_tools/wiki-lint.mjs --strict` — **PASS** (0 errors, 21 наявне попередження про давність інших сторінок), `node wiki/_tools/wiki-tasks.mjs --check` — **PASS**, `git diff --check` — **PASS**. У diff лише клавіатурний E2E і цей фрагмент. (source: `artifacts/_local/ah-5.12/t1-f1-wiki-check.log`; `artifacts/_local/ah-5.12/t1-f1-wiki-lint.log`; локальні запуски 2026-10-05)

## Log

- 2026-10-05: реалізовано обидва маршрути, додано unit/E2E-тести та QA-маршрути; гейт заблокований spawn EPERM. Зміни збережено для [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429). (source: локальний diff і перевірки 2026-10-05)
- 2026-10-05: repair T1-f1 усуває live-data залежність клавіатурного E2E. HTTP SEO compare 0 регресій; перевірки браузера та повного гейту залишаються заблокованими середовищем. Зміни для [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429), спільні статусні файли не редаговано. (source: локальний diff; перевірки repair вище)

## Handoff

Клавіатурний тест очікував live-результати для `agent`, тому відсутність збігів зупинила pre-push; сценарії клавіатури мають отримувати контрольовану відповідь API. Повторити `PORT=3103 npm run pr:check`, `PORT=3103 npx --no-install playwright test e2e/search-dialog-keyboard.spec.ts --project=chromium` і `PORT=3103 npm run e2e:affected` у середовищі, де дозволено child_process.fork та запуск esbuild/Vite. HTTP SEO вже перевірено на чотирьох маршрутах. Preview, CI та Night/Day EN/UK before/after 1440/390 ще не підтверджені цією сесією. Сервер на 3103 зупинено; commit/push не виконувалися. Наступна задача — завершити перевірки цього виправлення для [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429). (source: контракт задачі; звіт оркестратора FIX T1-f1; локальні перевірки 2026-10-05)
