# Епік After Hours: передача виконання наступній сесії

Summary: вхідна точка для агента будь-якої моделі чи інструмента, який продовжує епік редизайну After Hours у новій сесії. Сторінка описує стан на 2026-09-29, порядок старту, чергу фази 0 з нюансами кожної задачі, точки, де треба зупинитись і спитати власника, правила й пастки з попередніх сесій і готовий стартовий промпт.
Sources: [after-hours-redesign-epic](after-hours-redesign-epic.md) §0, §2, §4–§6, §11, §17; [ADR розкатки й foundations](../decisions/2026-09-29-after-hours-rollout-and-foundations.md); [redesign baseline](../analytics/2026-09-29-redesign-baseline.md); [open-questions](../open-questions.md) #1, #10; `.cursor/rules/pr-gate.mdc`; `package.json`; `wiki/_tools/wiki-lint.mjs`; `wiki/_meta/project-sync.json`; `src/lib/site.ts`; `artifacts/after-hours/pages.js`, `editions.js`, `qa/`; `artifacts/brand-kit/README.md`; сесія 2026-09-29 (PR #370, #371)
Last updated: 2026-09-29

---

> **Джерело правди про задачі — [епік](after-hours-redesign-epic.md)** (картки, AC, статуси в §5.3).
> Тут лише те, що потрібно, щоб нова сесія стартувала без контексту попередньої: стан, порядок,
> точки зупинки й пастки. Картки задач тут не дублюються.

## 1. Стан на 2026-09-29

- Production `b3f1b3a`: епік (PR [#370](https://github.com/sanchahous/ai-today-brief/pull/370)) і
  hotfix B8 — з `/news` прибрано захардкожений «Recent highlights».
- PR [#371](https://github.com/sanchahous/ai-today-brief/pull/371) змерджено 2026-09-29 (`main` @
  `83b4421`): ADR D1–D13, рішення D7 «знак скрізь» і ця сторінка вже в `main`.
- **Виконано:** AH-0.1 (PR [#372](https://github.com/sanchahous/ai-today-brief/pull/372), звірка G01–G20: 6 done, 10 partial, 2 open, 1 policy, 1 waived —
  [gap-plan §10](../audits/2026-09-26-design-system-gap-plan.md#10-статус-на-2026-09-29-звірка-ah-01)),
  AH-0.2 (ADR), AH-1.1 (токени 2.0, PR #369), AH-2.1 (`/ds-catalog`, PR #369).
- **Частково (◐):** AH-0.5, AH-0.6, AH-1.2, AH-1.5, AH-1.6, AH-1.7, AH-2.3, AH-2.4, AH-2.5, AH-2.6.
  Залишок описано в рядку «Стан після #369» кожної картки.
- **Не виконується:** AH-5.16 (рішення D6).
- **Рішення D1–D13 ухвалені.** Власника про них не перепитувати. Змінити рішення можна лише за
  новою відповіддю власника: спершу картки, потім запис у [log](../log.md).
- **Гейт G0 не пройдено.** Поки він закритий, у production не йде жоден візуальний PR.
- **Поточна задача: AH-0.6.** AH-0.3–AH-0.5 мають відкриті PR #373–#375; GA4-продуктовий
  baseline у PR [#376](https://github.com/sanchahous/ai-today-brief/pull/376) знято в
  [окремій сторінці](../analytics/2026-09-29-redesign-baseline.md), CWV і
  Admin-чек-лист GA4 лишаються відкритими. G0 не пройдено. (source: PR #373–#375;
  [redesign baseline](../analytics/2026-09-29-redesign-baseline.md))

## 2. Порядок старту сесії

1. Прочитати `wiki/overview.md`, `wiki/now.md`, `.cursor/rules/00-core.mdc` і `pr-gate.mdc`
   (CLAUDE.md «Session start»; для Codex, Cursor і Copilot — через `AGENTS.md`).
2. Прочитати цю сторінку, а в епіку — §0 (Definition of Done, шаблон PR), §3 (інваріанти I-1…I-12)
   і картку поточної задачі.
3. Звірити стан:

   ```bash
   git fetch origin
   ```

   ```bash
   gh pr view 371 --json state,mergedAt
   ```

   ```bash
   gh pr list --state open
   ```

   - Якщо #371 не змерджено — **стоп**: попросити власника змерджити його. Без нього в `main` немає
     ADR і цієї сторінки.
   - Переглянути свіжі коміти `main` (`git log origin/main --oneline -15`) і відкриті PR. Паралельна
     сесія вже закривала задачі епіку (PR #369). Якщо задачу закрито — оновити §5.3 епіку й картку і
     не дублювати роботу.
4. Створити гілку від свіжого `main`: `git switch -c feat/ah-<id>-<slug> origin/main`. Одна задача —
   одна гілка — один PR (епік §0).
5. У новій робочій копії або worktree спершу виконати `npm ci`, для локальних E2E —
   `npx playwright install chromium`. У сесії 2026-09-29 worktree стартував без `node_modules`.
6. Перед кодом маршрутів або API прочитати потрібний розділ `node_modules/next/dist/docs/`
   (Next 16.3; `AGENTS.md`).

## 3. Черга фази 0 (до гейту G0)

Порядок — за нумерацією епіку. AH-0.1, AH-0.3, AH-0.4 і AH-0.5 не залежать одна від одної: їх можна
вести паралельними гілками, не чекаючи мержу попередньої.

| # | Задача | Хто | Результат | Зупинка |
|---|---|---|---|---|
| 1 | ✅ AH-0.1 · звірка G01–G20 | агент | розділ «Статус на дату» в gap-plan із доказом для кожного G; виправлене формулювання в `now.md`; закритий пункт #10 в open-questions | немає, PR лише з wiki |
| 2 | AH-0.3 · знімки до/після | агент | `scripts/capture-route-matrix.ts`; прогін `--label=before` з production; PNG лише в `artifacts/_local/` | немає |
| 3 | AH-0.4 · SEO-контракт | агент | `src/lib/seo-contract.ts` з тестом (покриття ≥ 80%), `scripts/seo-contract.ts`, текстовий baseline з production | немає |
| 4 | AH-0.5 · QA-матриця сторінок | агент | `e2e/a11y-layout-matrix.spec.ts`, режими report і gating, звіт по legacy-сайту з лічильниками в log | немає |
| 5 | ◐ AH-0.6 · продуктовий і CWV baseline, PR [#376](https://github.com/sanchahous/ai-today-brief/pull/376) | власник + агент | [redesign baseline](../analytics/2026-09-29-redesign-baseline.md): GA4-воронки й три destinations | **так:** потрібні field CWV і Admin-чек-лист open-questions #1 |

**Нюанси, яких немає в картках:**

- **AH-0.1.** Відправна точка — таблиця §14 епіку. Суть конфлікту: запис `now.md` від 2026-09-28
  каже, що закрито всі 20 розривів. Код після #369 показує відкриті або часткові G05, G06 і
  G11–G17, а G19 знято рішенням власника, а не виконано (епік §2.3). Історичний текст аудиту не
  переписувати — додати новий розділ.
- **AH-0.3.** AC картки «baseline до мержу AH-1.1» вже недосяжний, бо AH-1.1 злито в #369. Тепер
  `before` знімається до першого наступного візуального PR (AH-1.3…AH-1.7). У log треба записати,
  що baseline показує стан після токенів 2.0. Вже готове:
  - consent-стан для знімків — `e2e/consent-state.json`;
  - зразок підходу — `artifacts/after-hours/qa/capture-gallery.mjs`.
- **AH-0.4.** HTML береться без JS, тобто простим HTTP-запитом, а не браузером. Правила для JSON-LD —
  у `artifacts/after-hours/qa/check-schema.mjs`. Опція `--headers` перевіряє
  `x-vercel-cache: HIT` на повторному запиті `/en/news` і `/uk/news`.
- **AH-0.5.** Портувати `inspect()` з `artifacts/after-hours/qa/run-qa.mjs` і перевірку zoom з
  `check-zoom.mjs`. Рушій — `@axe-core/playwright`, він уже є в devDependencies з #369. Нова спека
  має потрапити в `scripts/e2e-affected.ts`, інакше `e2e:affected` її не вибере.
- **AH-0.6.** Read-only GA4-конектор підключено 2026-09-29. Всі три property отримують
  production-події через один Google tag із трьома destinations; робоча property baseline —
  `540206735`. Дані й обмеження — [redesign baseline](../analytics/2026-09-29-redesign-baseline.md).
  Поки [open-questions](../open-questions.md) #1 не закрито, усі числа `(needs verification)`;
  mobile/desktop field CWV ще потрібно отримати. (source: GA4 Data API і live Google tag 2026-09-29)

**Гейт G0** закритий, коли AH-0.1…AH-0.6 виконані, baseline visual, SEO і продукту зняті, а
QA-матриця працює в режимі report.

## 4. Після G0

- AH-1.3 (тема, D2), AH-1.4 (кольори категорій) і AH-1.7 (ratchet) стартують одразу. AH-1.2
  доповнюється після AH-1.4.
- AH-1.5 (`next/font/local`, Georgia для українських заголовків) і AH-1.6 (брейкпоінти 960 px)
  потребують візуального підпису власника.
- AH-4.1 (Topics lib) іде паралельно з фазами 1–3.
- Далі — порядок і паралельні доріжки з епіку (§5.2–§5.4).
- AH-3.1, AH-3.7 і AH-3.8 (новий знак) мерджаться в один день, щоб старий і новий знаки не жили
  одночасно (ADR §4).

## 5. Точки зупинки: питати власника, не вгадувати

1. **Гейти G0–G7** — потрібен підпис власника: візуальний diff, знімки знака, News slice.
2. **Будь-яке число, розклад, обіцянка чи формат**, яких немає в даних або коді (інваріант I-6).
   Відкриті питання на 2026-09-29:
   - «70+ матеріалів на тиждень» і «120+ джерел» у `home-hero.tsx` (AH-5.3, B9);
   - розклад випусків. Прототип обіцяє daily щоранку пн–сб о 07:00 за Києвом і weekly щопонеділка
     (`artifacts/after-hours/editions.js`, `pages.js`); це стосується AH-5.4, AH-5.6 і AH-5.13;
   - «перевірка гайдів кожні 90 днів» (AH-5.9);
   - спонсорський слот на головній і формати розміщень (AH-5.3, п. 10; AH-5.13);
    - рішення щодо двох додаткових GA4 destinations після Admin-звірки
      ([open-questions](../open-questions.md) #1; AH-0.6).
3. **Платформи для нового аватара й банерів** (AH-3.8):
   - точно є X, Telegram, LinkedIn і YouTube (`SOCIALS` у `src/lib/site.ts`);
   - Facebook, Bluesky, Mastodon, Instagram і Threads є в таблиці `artifacts/brand-kit/README.md`,
     але чи є там акаунти проєкту — не перевірено;
   - файли завантажує власник.
4. **Будь-який відступ** від ADR D1–D13 або від інваріантів I-1…I-12.
5. **Багатогодинні процеси.** Агент готує команду, запускає її власник на своїй машині.
6. **Дії в акаунтах власника** (GA4, налаштування Vercel, соцмережі) виконує лише власник. Агент не
   мерджить PR і не вмикає auto-merge.

## 6. Правила й пастки, перевірені на практиці

- **Мова:** з власником — українською в кожній відповіді, навіть після довгих англомовних технічних
  кроків. Код, коміти й опис PR — англійською.
- **Перед push:** `npm run pr:check`. У Test plan PR — рядок
  ``- [x] `npm run pr:check` passed locally before push`` (`pr-gate.mdc`). Pre-push hook окремо
  запускає `e2e:affected`.
- **Код виходу:** `команда > log 2>&1; echo "EXIT=$?"` — і читати саме значення `EXIT=`. Деякі
  середовища показують статус останньої команди (`echo`), а не перевірки.
- **Збірка:** локально не запускати повний `next build` чи `build:full` — це витрачає Supabase egress
  (I-8). Досить `build:ci`; для змін лише в документації він пропускається сам.
- **ISR:** кешовані маршрути (`/[lang]/news` та інші) не читають `searchParams`, `cookies()` і
  `headers()` (I-2).
- **Wiki:**
  - `Summary:`, `Sources:` і `Last updated:` мають стояти в перших 14 рядках, інакше `wiki-lint`
    падає. Нові джерела дописувати в наявний рядок `Sources:`;
  - вертикальну риску в клітинках таблиць не використовувати навіть з екрануванням — перефразувати;
  - у підписах mermaid не використовувати апострофи й `#`;
  - `log.md` лише доповнюється в кінці. Кожна зміна wiki іде разом із `index.md` і `log.md`;
  - ⚠️ Conflict завжди містить посилання на [open-questions](../open-questions.md).
- **Wiki-watchers** (`wiki/_meta/project-sync.json`): зміна коду під watcher-ом вимагає оновити його
  сторінки в тому ж PR, інакше `wiki:sync` падає. Для епіку важливі:
  - `brand-chrome` (`brand-mark.ts`, `icons.tsx`, header, footer, іконки) → `now.md`; зачіпають
    AH-3.1, AH-3.3, AH-3.5;
  - `weekly-digest` (`src/lib/weekly-digest/*`) → `pipeline/weekly-digest.md`,
    `pipeline/weekly-editorial-selection.md`, `ops/weekly-admin-runbook.md`, `now.md`; зачіпає
    AH-3.7 (weekly PDF, LinkedIn document, Instagram carousel).
- **`main` рухається під час роботи:** PR #369 злили посеред сесії 2026-09-29. Перед push потрібні
  `git fetch` і rebase. У конфліктах `log.md` і `now.md` зберігати обидві сторони.
- **Живі перевірки клієнтського стану.** Панель Browser у десктопному застосунку може бути
  прихована (`document.visibilityState === 'hidden'`): тоді React не гідратує сторінку, стан із
  URL не відновлюється, а `onChange` не спрацьовує. Це не дефект сайту (2026-09-29 так виглядав
  хибний «збій» URL-state на production). Для live check стану, що відновлюється на клієнті,
  використовуй headless Playwright, а не приховану панель.
- **Факти про код** писати лише після grep або запуску. Запис від 2026-09-28 про закриті G01–G20
  код не підтвердив.
- **Vercel-бот** у docs-only PR пише «Skipped deployment». Це норма: `ignoreCommand` запускає
  `scripts/vercel-should-build.mjs`.
- **Семантичний аудит wiki** (`wiki:lint`, пошук суперечностей): знахідки не виправляти самому, а
  показати пронумерованим списком і чекати OK (CLAUDE.md, правило 6). Помилки, які валять
  `pr:check` у власному PR, виправляти.

## 7. Кінець сесії й звіт

Сесія по задачі завершена, коли:

- PR відкрито, `pr:check` зелений і CI зелений;
- в епіку оновлено §5.3 і картку (✅ або ◐ з посиланням на PR);
- оновлено `wiki/now.md` і `wiki/log.md`, а тут — рядок «Наступна задача» в §1.

Звіт власнику — українською, коротко: що зроблено, посилання на PR, які перевірки пройшли, що
потрібно від власника, наступна задача.

## 8. Стартовий промпт для наступної сесії

```text
Продовж виконання епіку редизайну After Hours у репозиторії ai-today-brief.
1. Прочитай wiki/product/after-hours-epic-handoff.md і виконай розділ «Порядок старту сесії».
2. Перевір стан PR #373–#375 і AH-0.6 у розділі «Черга фази 0». Доведи відкриті частини фази 0
   до виконання за картками в wiki/product/after-hours-redesign-epic.md: окрема гілка
   feat/ah-<id>-<slug> від origin/main, Definition of Done з §0.1, npm run pr:check,
   PR у main за шаблоном §0.2.
3. Після PR онови §5.3 епіку, wiki/now.md, wiki/log.md і рядок «Наступна задача» в handoff.
4. У точках із розділу «Точки зупинки» зупинись і спитай мене. Нічого не вигадуй.
Відповідай мені українською.
```

Для AH-0.6 GA4-дані вже знято через read-only конектор. Потрібно завершити Admin-чек-лист і
отримати field CWV; див. [baseline](../analytics/2026-09-29-redesign-baseline.md).

## Related pages

- [after-hours-redesign-epic](after-hours-redesign-epic.md) — картки, AC, статуси, порядок
- [ADR розкатки й foundations](../decisions/2026-09-29-after-hours-rollout-and-foundations.md) — рішення D1–D13
- [after-hours-epic-readiness](after-hours-epic-readiness.md) — що закрив PR #369
- [design-system-gap-plan](../audits/2026-09-26-design-system-gap-plan.md) — розриви G01–G20 (AH-0.1)
- [open-questions](../open-questions.md) — #1 GA4-property, #10 статус G01–G20
- [now](../now.md) — поточний операційний стан
