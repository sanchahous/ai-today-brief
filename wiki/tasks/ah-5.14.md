# AH-5.14

Summary: Спільна reading-оболонка чотирьох політик реалізована; текст документів і метадані дослівно збережено, повний локальний pr:check та тести навігації, SEO й a11y-матриці зелені.
Sources: `src/lib/legal.ts`, `src/components/legal-doc.tsx`, `src/components/trust-page-shell.tsx`, `src/components/legal-doc.test.ts`, `src/app/[lang]/editorial-policy/page.tsx`, `e2e/fixtures/policy-text.baseline.json`, `e2e/fixtures/a11y-gating.json`, `e2e/policy-documents.spec.ts`, відповідь власника U0BAS595MT6 від 2026-10-04, локальні перевірки 2026-10-04, [епік](../product/after-hours-redesign-epic.md) §0, §3, AH-5.14, [PR #420](https://github.com/sanchahous/ai-today-brief/pull/420)
Last updated: 2026-10-04

---

Task: ah-5.14

## Status

DONE. PR: [#420](https://github.com/sanchahous/ai-today-brief/pull/420). (source: локальні перевірки 2026-10-04; `npm run pr:check`)

## Findings and acceptance criteria

- Додано `PolicyPageShell` у спільну trust-оболонку: breadcrumb, компактне інтро, таби між чотирма документами з `aria-current`, статичний TOC, колонка читання з токенами та sticky TOC на desktop. Політики рендеряться сервером без нових Reveal-анімацій; marketing-варіант не змінено за поведінкою. (source: `src/components/trust-page-shell.tsx`; `src/components/legal-doc.tsx`; `src/app/[lang]/editorial-policy/page.tsx`)
- **AC тексту: підтверджено порівнянням усіх 8 маршрутів EN/UK.** Baseline зафіксовано до правок; зіставлено всі H1/H2 та абзаци, включно з датами і завершальним посиланням редакційної політики. Навігацію (breadcrumb, tabs, TOC) виключено з порівняння за рішенням власника. Додано постійні Vitest-тести на текст і metadata та Playwright E2E-тести на текст, навігацію і SEO, які успішно пройшли у Chromium, Firefox та WebKit. (source: `e2e/fixtures/policy-text.baseline.json`; `src/components/legal-doc.test.ts`; `e2e/policy-documents.spec.ts`; відповідь власника U0BAS595MT6)
- **AC SEO: SEO-diff 0, результати `generateMetadata` та HTTP snapshot збігаються з baseline.** Canonical, hreflang, revalidate, URL та editorial JSON-LD не змінено. E2E використовує наявний SEO baseline й runtime site URL, щоб CI canonical не припускав production URL. (source: `src/components/legal-doc.test.ts`; `e2e/policy-documents.spec.ts`; `git diff`)
- **AC gating: усі 4 документи EN/UK додано до fixture gating.** 112 Chromium сценаріїв політик (Night/Day, 5 viewport, text-200, reflow-320) пройшли з результатом 112 passed. (source: `e2e/fixtures/a11y-gating.json`; `e2e/a11y-layout-matrix.spec.ts`)
- Інваріанти збережено: немає нових URL, читання request API, змін pipeline/БД, нових дат чи юридичних обіцянок, кольорів/залежностей/анімацій. Дати трьох документів залишилися `2026-06-01`, редакційна політика без дати (згідно з рішенням власника). Спільні статусні сторінки не редаговано. (source: `git diff`; `src/lib/legal.ts`; відповідь власника U0BAS595MT6)

## Owner decision

- 2026-10-04, U0BAS595MT6: редакційну політику показувати без дати до підтвердженого джерела; інші три — лише з наявним «Оновлено». Порівнювати текст документів із заголовками та наявними датами, виключивши нові breadcrumb, таби й TOC. Обидва питання закрито. (source: відповідь власника у сесії)

## Checks

- `npm run pr:check`: PASS (exit code 0). Включає `design:raw:check`, `ci:check` (всі тести Vitest, включно з `src/components/legal-doc.test.ts`), `typecheck` (`tsc --noEmit`), `lint` (`eslint`), `e2e:check` (`scripts/e2e-affected.ts --check`), `wiki:check`, `migrations:check`, юніт-тести скриптів (`scripts/ssg-build-scope.test.mjs`, `scripts/e2e-server-url.test.mjs`, `scripts/e2e-affected.test.mjs`) та `build:ci` (Next.js SSG prerender). (source: локальний запуск 2026-10-04)
- `npx vitest run src/components/legal-doc.test.ts`: PASS (16 tests passed). (source: локальний запуск 2026-10-04)
- `PORT=3101; npx playwright test e2e/policy-documents.spec.ts --project=chromium`: PASS (8 tests passed). (source: локальний запуск 2026-10-04)
- `PORT=3101; npx playwright test e2e/policy-documents.spec.ts --project=firefox`: PASS (8 tests passed). (source: локальний запуск 2026-10-04)
- `PORT=3101; npx playwright test e2e/policy-documents.spec.ts --project=webkit`: PASS (8 tests passed). (source: локальний запуск 2026-10-04)
- `PORT=3101; npx playwright test e2e/a11y-layout-matrix.spec.ts --project=chromium --grep "editorial-policy|ai-disclosure|privacy|terms"`: PASS (112 tests passed). (source: локальний запуск 2026-10-04)
- `PORT=3101; npm run e2e:affected`: PASS (265 passed, 1 skipped). (source: локальний запуск 2026-10-04)

## Log and handoff

- 2026-10-04: зафіксовано дві точки уточнення до зміни юридичної оболонки; питання передано власнику. (source: [PR #420](https://github.com/sanchahous/ai-today-brief/pull/420); локальна перевірка коду)
- 2026-10-04: після відповіді власника реалізовано спільну reading-оболонку `PolicyPageShell`, таби з `aria-current`, TOC, хлібні крихти; текст документів і SEO дослівно збережено. (source: відповідь U0BAS595MT6; [PR #420](https://github.com/sanchahous/ai-today-brief/pull/420))
- 2026-10-04: додано регресійні тести, оновлено селектори у Playwright E2E-тестах, додано 4 маршрути до a11y-gating. Усі перевірки (`npm run pr:check`, Vitest, Playwright matrix у Chromium/Firefox/WebKit) зелені. Задача виконана. (source: [PR #420](https://github.com/sanchahous/ai-today-brief/pull/420); локальні перевірки)

### epic-5.3

```verbatim
| AH-5.14 | Чотири політики | S | агент | AH-5.1 | route `policy` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
