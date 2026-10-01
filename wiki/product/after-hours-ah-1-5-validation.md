# AH-1.5: типографіка — реалізація й докази

Summary: локальні шрифти, Georgia для українських display-заголовків, fluid-шкала, eyebrow і ритм читання. Реалізація очікує окремого візуального підпису власника; legacy QA не оголошується зеленим.
Sources: `src/app/fonts.ts`; `src/app/globals.css`; `src/lib/design-system/tokens.ts`; `scripts/check-design-tokens.ts`; `e2e/typography.spec.ts`; `artifacts/after-hours/qa/ah-1.5-font-assets.json`; `artifacts/_local/ah-1.5-type-matrix-before.json`; `artifacts/_local/ah-1.5-type-matrix-after.json`; `artifacts/_local/ah-1.5-font-cls.json`; git / HTTP checks 2026-09-30.
Last updated: 2026-10-01

---

## Поточний стан: #386 підтверджено

#385 і #386 змерджено; main `c477b09`. Власник явно підтвердив #386: «ПР закритий значить підтверджую 386». CI #386, включно з [Playwright run 36826783157](https://github.com/sanchahous/ai-today-brief/actions/runs/36826783157), успішний. Tracking guard і 81-test suite інтегровані, повторно переносити старі локальні коміти не потрібно. Відкриті UK Home/Article/Weekly, прийняття локального CLS, H1/legacy QA та G1 збережено. Наступна робота — [AH-2.2](after-hours-ah-2-2-validation.md). (source: [PR #386](https://github.com/sanchahous/ai-today-brief/pull/386); `artifacts/_local/ah-2.2-main-pr386.json`; повідомлення власника 2026-10-01)

## Follow-up tracking: 2026-10-01

Власник дозволив окремий PR повідомленням «в новий ПР». Гілка `feat/ah-1.5-tracking-follow-up` створена від `origin/main` @ `2dea14c`; переносить tracking guard, який не увійшов у #385. Правило UK h1/h2/h3 поза CSS layers забезпечує D4 поверх `tracking-tight`: на desktop Digests H1 72 px, tracking −1.8 px до / −0.864 px після (−0.025em → −0.012em). H2/H3 — −0.008em. (source: повідомлення власника 2026-10-01; `src/app/globals.css`; `artifacts/_local/ah-1.5-tracking-audit-before.json`; `ah-1.5-tracking-audit-after.json`)

Focused Digests QA: по **28 сценаріїв до/після**, EN/UK, Night/Day, 320/360/390/768/1024/1440 і 200% text; overflow / small text / H1 problems / axe / console errors — **0 / 0 / 0 / 0 / 0**. Small targets **620 → 614**, це ненульовий legacy-борг, не повний зелений gating. SEO compare двох Digests URL — **0 errors / 0 warnings**. Повторний typography E2E — **81 passed** у Chromium/Firefox/WebKit. Початковий local dev прогін мав 80 passed / 1 H1-readiness timeout; тест тепер чекає видимого H1 до перевірки кількості й font family, як `gotoNewsPage` у project helper. (source: focused audit JSON; `artifacts/_local/ah-1.5-tracking-typography.log`; `ah-1.5-tracking-typography-cold.log`; `e2e/typography.spec.ts`; `e2e/helpers/news-page.ts`)

[Follow-up галерея](../../artifacts/after-hours/qa/ah-1.5-tracking-review.html): по 8 локальних PNG із реальних даних, Digests EN/UK, Night/Day, 390/1440; before на main `2dea14c`. PNG — лише `artifacts/_local/ah-1-5-tracking-before` / `after`, manifests містять SHA-256. Окремий підпис #386 отримано повідомленням власника 2026-10-01. Змерджено [PR #386](https://github.com/sanchahous/ai-today-brief/pull/386); pre-push — 340 passed / 5 skipped, EXIT=0; `pr:check` зелений. CI docs-ревізії успішний (source: GitHub checks #386 2026-10-01). [Preview](https://ai-today-brief-git-feat-ah-15-tracki-ac00ef-sanchahous-projects.vercel.app) потребує логіну; tracked [evidence receipt](../../artifacts/after-hours/qa/ah-1.5-tracking-evidence.json) містить SHA-256 і summary. (source: `artifacts/after-hours/qa/capture-ah-1.5-tracking.mjs`; before/after manifests; епік §0.1.10)

## Історія перед follow-up #386: завершення сесії 2026-10-01

Власник змерджив [PR #385](https://github.com/sanchahous/ai-today-brief/pull/385): `origin/main` — `2dea14c`, PR head — `f5c0adc`. CI цієї ревізії зелений, typography suite у merge — 78 passed. Пізніші локальні `508f87c` (D4 tracking guard та 81-test suite) і `411e2f0` (pre-push діагностика) не увійшли в merge: push зупинив хук. Числа 81 та фінальні після-guard receipts нижче описують локальний залишок, а не змерджену ревізію. (source: повідомлення власника 2026-10-01; `gh pr view/checks 385`; `git diff origin/main`; локальні коміти)

Залишок збережено в гілці `feat/ah-1.5-typography` і `artifacts/_local/ah-1.5-unmerged-follow-up.patch`. У main нічого не пушилося, другий PR не відкрито; потрібне рішення власника про follow-up. Окремий візуальний підпис, прийняття локального CLS і виняток для legacy QA не виводяться автоматично з факту merge. (source: git / PR check 2026-10-01; повідомлення власника; запит цієї сесії)

[PR #385](https://github.com/sanchahous/ai-today-brief/pull/385), [Vercel Preview](https://ai-today-brief-git-feat-ah-15-typography-sanchahous-projects.vercel.app). Перший deployment успішний; Preview потребує логіну. Pre-push hook перед створенням PR: **339 Chromium passed, 5 skipped**, EXIT=0; власний production server :3000, authenticated revalidate потрібних маршрутів. CI merged ревізії #385 успішний (source: gh pr checks 385 2026-10-01). (source: PR #385 checks / Vercel comment 2026-09-30; `artifacts/_local/ah-1.5-push.log`)

## Реалізація

D3: `next/font/local` завантажує Fraunces regular, Fraunces italic, Inter Latin і Inter Cyrillic з наявних OFL-файлів. Preload — upright display та обидва body subset-и; italic завантажується за використанням. Latin має автоматичний Arial metric fallback, display — Times New Roman metric fallback. Cyrillic стоїть першим у body-стеку, щоб Latin fallback не перехоплював українські літери. Mono — системний стек. (source: `src/app/fonts.ts`; `src/app/globals.css`)

Runtime-файли й ліцензії скопійовано byte-identical у `src/app/_fonts/`, оскільки `.vercelignore` виключає `artifacts/`. Аудит перевіряє тотожність runtime та prototype копій. Зовнішні font CDN не потрібні під час build або відвідування. (source: `.vercelignore`; `src/app/fonts.ts`; `artifacts/after-hours/qa/check-ah-1.5-fonts.mjs`)

WOFF2 cmap підтверджує повний український алфавіт, включно з Ґ/ґ, Є/є, І/і, Ї/ї, у `sans-uk`; Latin subset-и та Fraunces не містять кирилиці. Всі файли — variable weight 100–900; OFL-ліцензії поруч. Перевірку можна повторити без завантажень: `node artifacts/after-hours/qa/check-ah-1.5-fonts.mjs`. (source: [font-assets receipt](../../artifacts/after-hours/qa/ah-1.5-font-assets.json); `artifacts/after-hours/assets/LICENSE-Fraunces.txt`; `LICENSE-Inter.txt`)

D4: українська display-гарнітура — Georgia для всього заголовка, включно з Latin product names та italic; tracking display −0.012em і heading −0.008em. `main[lang]` задає мовний scope вже у серверному HTML, без залежності від pre-paint script. Це не виправляє раніше відомий no-JS Suspense-борг сторінок із даними. (source: `src/app/[lang]/layout.tsx`; `src/app/globals.css`; [AH-1.3 QA](after-hours-ah-1-3-validation.md#межі-qa))

Шкала 12/13/14/16/18 px і fluid 19–22/22–28/28–40/36–58/42–72 px зареєстрована в Tailwind. Ритм UI 16/1.65; `.reading-copy` та MarkdownBody — 18/1.78, міра 68ch. Короткий `.eyebrow` — mono uppercase, tracking 0.13em; `.eyebrow-registry` — sentence case. Homepage eyebrow-мітки використовують спільне правило; каталог має двомовні приклади. Реєстр §7.2 і drift-гейт покривають шкалу, family references, leading, tracking, measure та UK overrides. D4 tracking перемагає legacy heading utilities, зокрема `tracking-tight` на digests. (source: `src/app/globals.css`; `src/components/markdown-body.tsx`; `src/app/ds-catalog/catalog-client.tsx`; [token registry](../architecture/design-system-tokens.md#72-типографіка); `scripts/check-design-tokens.ts`)

## Перевірки

- SEO compare із чистим локальним `origin/main` @ `2ba2b27`: **58 URL, 0 errors / 0 warnings**. Порівняння з production baseline AH-0.4 має однаковий legacy diff на обох гілках: `/en/zzz-missing`, robots `noindex → max-image-preview:large`; він не є регресією AH-1.5. (source: `artifacts/_local/ah-1.5-seo-local-main.json`; `artifacts/_local/ah-1.5-seo-main-compare.log`; `artifacts/_local/ah-1.5-seo-before.log`; `artifacts/_local/ah-1.5-seo.log`)
- Typography E2E: **81 passed** у Chromium, Firefox і WebKit. Home/Article/Weekly, EN/UK, Night/Day, 390/1440: одна display-family, same-origin font requests, три preload; перевірено server language scope без JavaScript, italic, eyebrow і reading. Це перевірка computed family; на системах без Georgia використовується наступний системний serif зі стеку. (source: `artifacts/_local/ah-1.5-typography-final.log`; `e2e/typography.spec.ts`)
- Font-floor matrix: **580 сценаріїв до й після**, текст <12 px — **0**, overflow — **0**. H1-порушення — **20** у кожному прогоні, лише EN/UK `zzz-missing`; очікування видимого H1 обмежене п'ятьма секундами. Це font-floor перевірка; повний axe/touch/zoom звіт окремий. (source: `artifacts/_local/ah-1.5-type-matrix-before.json`; `artifacts/_local/ah-1.5-type-matrix-after.json`)
- Локальний лабораторний CLS: cold Chromium contexts, затримка font response 300 ms; Home/Article EN/UK, 390/1440 — **8 сценаріїв**, максимальний сумарний CLS ≈ **0.0000309**, нижче 0.01. Виміряно всі layout-shifts без recent input, а не заявлено окрему font attribution чи польовий p75. Vercel Preview потребує авторизації, тому trace знято з локального next dev; прийняття цього доказу замість Preview-виміру — рішення власника. (source: `artifacts/_local/ah-1.5-font-cls.json`; `artifacts/after-hours/qa/audit-ah-1.5.mjs`)
- `tokens:check`: **222 пари**, контраст, docs і drift пройшли. Token unit suite — **31 passed**; `typecheck`, `e2e:check` та lint пройшли, lint має **9 warnings** у незмінених файлах. Ratchet prune: 30 raw colours, 4 z-index, 0 raw shadows / sub-floor fonts. (source: `artifacts/_local/ah-1.5-tokens.log`; `artifacts/_local/ah-1.5-lint.log`; `artifacts/_local/ah-1.5-tokens-check.log`; `scripts/raw-design-values.baseline.json`)
- Наявна мок-БД іншої сесії використана без редагування її коду чи даних: long-title / long-word / long-article / weekly fixtures, EN/UK, Night/Day, 320/390/1440 та 200% zoom — **64 сценарії, 0 failures**, включно з H1, Georgia UK, font floor і overflow. Це синтетичний stress-прогін; галерея використовує реальні дані. (source: повідомлення власника 2026-09-30; `artifacts/after-hours/qa/audit-ah-1.5-mock.mjs`; `artifacts/_local/ah-1.5-mock-type-matrix.json`)

### Full-page legacy QA: main / AH-1.5

Обидва локальні next dev пройшли по 812 сценаріїв у report-режимі; цей режим не є нульовим gating. У таблиці наведено сирі лічильники без заяви про статистичну значущість або причинність різниць. (source: `artifacts/_local/ah-1.5-full-qa-before.json`; `artifacts/_local/ah-1.5-full-qa.json`; `e2e/a11y-layout-matrix.spec.ts`)

| Лічильник | main @ 2ba2b27 | AH-1.5 |
|---|---:|---:|
| Overflow / small text / missing alt | 0 / 0 / 0 | 0 / 0 / 0 |
| Small targets | 11429 | 11455 |
| Axe | 1266 | 1266 |
| Console errors | 195 | 201 |
| H1 problems / heading skips | 89 / 276 | 83 / 281 |
| Clipped / clipped at zoom | 1178 / 376 | 1197 / 360 |

Console errors у звіті AH-1.5 — заблокований dev HMR WebSocket на `127.0.0.1`; решта метрик зберігає ненульовий legacy-борг. Clipped-приклади містять line-clamp у news/search. Через відмінності сирих лічильників цей звіт не є доказом нульових регресій full-page QA; DoD §0.1.5 та H1 AC залишаються відкритими для рішення власника й наступних міграцій. (source: ті самі JSON reports; `src/components/post-card.tsx`; [епік](after-hours-redesign-epic.md#01-definition-of-done--для-кожного-pr-епіку))

`npm run pr:check` пройшов із EXIT=0 перед першим push: logic coverage, typecheck, lint, e2e:check, wiki:check, migrations і minimal production build. Pre-push E2E зелений; CI очікує фінального прогону. Хеші локальних доказів і машинні summary збережено у tracked [evidence receipt](../../artifacts/after-hours/qa/ah-1.5-evidence.json); PNG та повні traces лишаються локальними. Публічні маршрути лишаються у legacy report-режимі до міграції шаблонів; нуль порушень full-page gating не заявлено. (source: `artifacts/_local/ah-1.5-pr-check.log`; `artifacts/after-hours/qa/collect-ah-1.5-evidence.mjs`; [епік AH-0.5 та DoD](after-hours-redesign-epic.md))

Full-page таблицю вище зібрано до фінального D4 tracking guard на UK headings; цей звіт зберігається як діагностичний, а не як фінальний gating. Окремий E2E відтворює legacy `tracking-tight` на `/uk/digests` і перевіряє −0.012em у трьох engines. (source: `e2e/typography.spec.ts`; `artifacts/_local/ah-1.5-typography-final.log`; `artifacts/_local/ah-1.5-full-qa.json`)

## Візуальний підпис

Третя спроба pre-push зупинилася на `theme.spec.ts`, EN / light / 1440: theme toggle залишався disabled у межах 5 s. Окремий повтор цього ж тесту пройшов без зміни коду (1 passed); це спостереження, а не доведена причина збою. Фінальна повторна перевірка хука ще очікується. (source: `artifacts/_local/ah-1.5-push-attempt3-failed.log`; `artifacts/_local/ah-1.5-theme-recheck.log`)

[Галерея до/після](../../artifacts/after-hours/qa/ah-1.5-review.html): 32 PNG на кожну сторону, Home/News/Article/Weekly, EN/UK, Night/Day, 390/1440. Обидві сторони — локальний next dev з реальними `.env.local` даними, «до» на `origin/main` @ `2ba2b27`; PNG лише у git-ignored `artifacts/_local/ah-1-5-before` і `ah-1-5-after`, SHA-256 у manifests. Власник ще не підписав українські заголовки Home/Article/Weekly. (source: before/after `manifest.json`; `artifacts/after-hours/qa/capture-ah-1.5.mjs`; [картка AH-1.5](after-hours-redesign-epic.md#ah-15--типографіка-шрифти-шкала-мінімум-12-px))

## Production check після #383

2026-09-30 `/rss.xml` повернув newest `Tue, 29 Sep 2026 09:00:00 GMT`; `news-sitemap.xml` містить `2026-09-29T01:48:49Z`; `/en/news` містить «Updated September 29». Усі три HTTP 200. Перевірку зроблено read-only, без деплою чи account changes. (source: `artifacts/_local/ah-1.5-production-freshness.json`; HTTP check 2026-09-30)

## Related pages

- [after-hours-redesign-epic](after-hours-redesign-epic.md) — картка й AC
- [after-hours-epic-handoff](after-hours-epic-handoff.md) — наступна задача й правила
- [design-system-tokens](../architecture/design-system-tokens.md) — реєстр і drift
