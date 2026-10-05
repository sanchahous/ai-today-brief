# AH-5.12

Summary: Реалізовано About і Author англійською й українською; гейт і браузерні докази заблоковані помилкою середовища spawn EPERM.
Sources: `src/app/[lang]/about/page.tsx`, `src/app/[lang]/author/page.tsx`, `src/components/editorial/editor-profile.tsx`, `src/lib/site.ts`, `artifacts/after-hours/pages.js`, локальні перевірки 2026-10-05, [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429), перенос ATB-67 PR #405
Last updated: 2026-10-05

---

Task: ah-5.12

## Status

### epic-5.3

```verbatim
| AH-5.12 | About і Author | M | агент | AH-5.1, AH-3.4 | routes `about`, `author` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

Статус: **BLOCKED**. Код збережено для [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429); `PORT=3103 npm run pr:check` завершився з кодом 1 через `spawn EPERM` у esbuild до виконання решти гейту. (source: локальний запуск 2026-10-05)

## Changes

- About: інтро «Інтелект потребує людського погляду», split із бренд-артом, 4 кроки редакційного процесу, картка редактора й спільний NewsletterForm band. Непідтверджені числа джерел не перенесені. (source: `src/app/[lang]/about/page.tsx`; `artifacts/after-hours/pages.js`)
- Author: breadcrumb, ініціали з реального імені, профілі й експертиза з site.ts, лише наявні в API рубрики фокусу, стандарти та до трьох останніх опублікованих матеріалів через StoryRow. Порожні рубрики й матеріали приховані. Використовується наявний кеш `getNewsPageData(lang)`, як на News, без окремого ключа для трьох матеріалів. (source: `src/app/[lang]/author/page.tsx`; `src/lib/news.ts`; `src/app/[lang]/news/page.tsx`)
- Server Components, ISR 86400, metadata, canonical, hreflang, Person і Organization збережені; AboutPage отримав відсутнє поле name. Нових залежностей, сцен motion, змін pipeline чи контактів немає. Спільні статусні файли не змінено. (source: diff 2026-10-05; `src/lib/schema.ts`)

## Acceptance evidence

- [ ] SEO compare 0 регресій на HTTP-відповідях — **очікує запуску**. In-process SSR EN/UK підтвердив незмінні Person name, alternateName, sameAs, Organization, canonical й один H1. Додано E2E compare з існуючим baseline; origin CI враховується через expectedSiteUrl(). SSR не замінює HTTP compare. (source: локальний Node SSR 2026-10-05; `e2e/about-author.spec.ts`)
- [x] Концепт-арт: AVIF 1600×900 — 32 554 байти ≤ 35 000; 800×450 — 13 548 байтів ≤ 15 000. Оригінальні файли прототипу скопійовані без перекодування. Picture + next/image, WebP fallback, явні 1600×900, alt і підпис EN/UK. Це бренд-арт, не ілюстрація новини. (source: `artifacts/after-hours/assets/`; `public/images/after-hours/`; локальний Sharp metadata/stat 2026-10-05; `src/app/[lang]/about/page.tsx`)
- [x] Контакти, ім’я, роль, профілі й експертиза — лише з site.ts. Демонстраційні адреси не перенесено. (source: `src/components/editorial/editor-profile.tsx`; обидві сторінки)
- [ ] §0.1: повний pr:check, CI, QA-матриця та візуальні докази — **очікують**. Чотири маршрути EN/UK додано до існуючої gating-матриці Night/Day, 360/390/768/1024/1440, 200% тексту й reflow 320. Preview та before/after не отримано. (source: `e2e/fixtures/a11y-gating.json`; `e2e/a11y-layout-matrix.spec.ts`; локальний гейт 2026-10-05)

## Checks

- `PORT=3103 npm run pr:check` — FAIL, exit 1 на першому етапі design:raw:check: spawn EPERM у node_modules/esbuild/lib/main.js. Coverage, решта гейту та build:ci не запускалися. (source: локальний запуск 2026-10-05)
- `npm run design:raw:check` — той самий блокер. Оригінальний checker окремо виконано через Node stdin і typescript.transpileModule без esbuild чи зміни правил: **PASS**, raw-design ratchet без нових/вилучених значень. (source: `artifacts/_local/ah-5.12/raw-check.log`; локальний запуск 2026-10-05)
- `npm run typecheck` і `node node_modules/typescript/bin/tsc --noEmit` — **PASS**. Цільовий `node node_modules/eslint/bin/eslint.js` — **PASS** для сторінок, редакторського компонента, unit/E2E-тестів після фінальних змін. `git diff --check` — **PASS**. (source: локальні запуски 2026-10-05)
- `node node_modules/vitest/vitest.mjs run 'src/app/[lang]/about-author.test.ts'` — **BLOCKED** на завантаженні конфігурації Vite: spawn EPERM, тести не виконані. Unit-тести покривають сутності, metadata, контакти, концепт-арт та реальні/порожні списки. (source: локальний запуск 2026-10-05; `src/app/[lang]/about-author.test.ts`)
- Окремі in-process Node + React renderToStaticMarkup assertions із мокованим news API — **PASS** для EN/UK About/Author: схеми, canonical, контакти, newsletter, 4 кроки, порожній список і максимум три матеріали. Це перевірка без Next HTTP-сервера й браузера. (source: локальний запуск 2026-10-05; `artifacts/_local/ah-5.12/*-ssr.html`)
- `npm run wiki:check` — **BLOCKED**, exit 1: wiki:sync пройшов із 0 errors/0 warnings, далі node --test не може запустити дочірній процес (spawn EPERM). Окремі `node wiki/_tools/wiki-lint.mjs --strict` і `node wiki/_tools/wiki-tasks.mjs --check` — **PASS**. (source: `artifacts/_local/ah-5.12/wiki-check.log`; `artifacts/_local/ah-5.12/wiki-lint.log`; локальні запуски 2026-10-05)
- Оригінальний `scripts/e2e-affected.ts --check` виконано через Node stdin і typescript.transpileModule без esbuild — **PASS**, map OK (30 specs, 51 testids). Явні about-page/author-page testids пов’язують новий E2E-тест із маршрутами. (source: локальний запуск 2026-10-05; `e2e/about-author.spec.ts`)

## Log

- 2026-10-05: реалізовано обидва маршрути, додано unit/E2E-тести та QA-маршрути; гейт заблокований spawn EPERM. Зміни збережено для [PR #429](https://github.com/sanchahous/ai-today-brief/pull/429). (source: локальний diff і перевірки 2026-10-05)

## Handoff

Продовжити цю саму задачу в середовищі з дозволеним запуском Node/esbuild/Vite. До доставки виконати `PORT=3103 npm run pr:check`, unit-тести, `PORT=3103 npx --no-install playwright test e2e/about-author.spec.ts`, gating-матрицю з фільтром about/author, SEO compare та Night/Day EN/UK before/after 1440/390; додати Preview у PR. CI й доставка — оркестратор. Сервери не запускались, commit/push не виконувалися. Наступна задача — завершити перевірки цієї картки. (source: контракт задачі; локальний запуск 2026-10-05)
