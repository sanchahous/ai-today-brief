# ADR 2026-08-02 — перехід на raw/ · wiki/ · artifacts/

Summary: рішення реструктурувати базу знань проєкту під agentic workflow і покроковий план
перенесення `docs/**` у `wiki/**` без поламаних посилань і зелених CI-гейтів.
Sources: `WorkShop 23-25_07 Prompts. Personal.pdf` (поза репо), інвентаризація репозиторію
(live check 2026-08-02), `git grep` по посиланнях на `docs/`
Last updated: 2026-08-02

**Статус:** прийнято. Кроки 1–8 виконано (міграція `docs/** → wiki/**` / `raw/` / `artifacts/`).

---

## Контекст

У репозиторії 899 файлів під git, з них 39 markdown-документів у `docs/` (7 647 рядків)
(source: `git ls-files`, live check 2026-08-02). Проблеми:

1. **Знання перемішане з деліверабламии й сирими даними.** У `docs/` одночасно лежать аналітика
   (`MASTER-ROADMAP.md`), сирий SQL-дамп (`07a — Supabase MVP migration.sql`), незмінна
   дизайн-референс-база (`reference/prototypes/**`, 40 файлів) і готові бренд-ассети
   (`marketing/brand-kit/*.svg`).
2. **Немає точки входу.** Щоб знайти відповідь, агент читає назви 39 файлів і вгадує.
3. **Немає дисципліни цитування.** Частина тверджень у планувальних доках не має джерела, і
   `MASTER-ROADMAP §2` довелося окремо «ground-truth-ити» проти живої БД — 13 розбіжностей.
4. **`CLAUDE.md` змішував поведінку з бізнес-фактами** — факти застарівають, і разом із ними
   застаріває інструкція агента.
5. **Немає журналу.** Неможливо відповісти «звідки взялася ця цифра і коли».

## Рішення

Чотири зони замість двох:

| Зона | Було | Стало |
|---|---|---|
| Незмінні джерела | розкидані по `docs/` | `raw/` — **immutable** |
| Знання | `docs/` (плоско, 39 файлів) | `wiki/` — 11 тематичних розділів + ядро з 5 файлів |
| Деліверабли | `docs/marketing/brand-kit/` | `artifacts/` |
| Код | `src/`, `pipeline/`, … | без змін, під `.cursor/rules/` |

Плюс: `CLAUDE.md` = **лише поведінка**, `wiki/overview.md` = **усі бізнес-факти з джерелами**,
`wiki/log.md` = append-only журнал, `npm run wiki:lint` = машинна перевірка формату.

### Чому не залишили `docs/`

Перейменування — не косметика. `wiki/` несе три контракти, яких `docs/` не мав: обов'язкова шапка
сторінки, обов'язкове джерело під фактом, обов'язкове оновлення `index.md` + `log.md`. Нове ім'я
робить контракт помітним і дозволяє лінтеру не чіпати історичні файли, поки їх не мігровано.

### Чому код лишається окремо

Схема воршкопу (`raw`/`wiki`/`artifacts`) розрахована на базу знань без кодової бази. Тут — живий
продуктовий репозиторій із власним контуром якості (`npm run pr:check`, Sonar, Playwright).
Розчиняти код у цій схемі означало б зламати гейти. Четверта зона — свідома адаптація.

## Наслідки

- Усі шляхи `docs/…` у цитатах стануть `wiki/…` — потрібне централізоване переписування (крок 5).
- 12 конфігів і файлів посилаються на `docs/` — перелік у кроці 5.
- Кожна мігрована сторінка потребує шапки `Summary/Sources/Last updated` — крок 6.
- `git mv` зберігає історію файлів; `git log --follow` продовжить працювати.

---

## План міграції

> Виконувати **окремим PR** від цього. Гілка: `chore/migrate-docs-to-wiki`.
> Не змішувати з жодною змістовною зміною — інакше рев'ю неможливе.

### Крок 0 — підготовка

```bash
git switch -c chore/migrate-docs-to-wiki && npm ci
```

Переконатися, що робоче дерево чисте: `git status --short` порожній.

### Крок 1 — каркас ✅ виконано

Створено `raw/` · `wiki/` · `artifacts/`, ядрові сторінки, `CLAUDE.md`, `AGENTS.md`, `.mcp.json`,
`wiki/_tools/wiki-lint.mjs`, оновлено ignore-списки. Деталі — у [log](../log.md).

### Крок 2 — сирі дані → `raw/`

```bash
git mv "docs/07a — Supabase MVP migration.sql" raw/db/2025-07a-supabase-mvp-migration.sql
git mv docs/reference/prototypes raw/reference/prototypes
rmdir docs/reference 2>/dev/null || true
```

### Крок 3 — деліверабли → `artifacts/`

```bash
git mv docs/marketing/brand-kit artifacts/brand-kit
```

### Крок 4 — знання → `wiki/`

```bash
# strategy
git mv docs/STARTUP-PLAN.md                       wiki/strategy/startup-plan.md
git mv docs/MASTER-ROADMAP.md                     wiki/strategy/master-roadmap.md
git mv docs/AI-TRENDS-RESEARCH-STRATEGY.md        wiki/strategy/ai-trends-research.md
git mv docs/SITE-UPDATES-IMPROVEMENT-PLAN.md      wiki/strategy/site-updates-plan.md

# architecture
git mv "docs/07 — MVP Dev Handoff (AI Brief).md"  wiki/architecture/mvp-dev-handoff.md
git mv "docs/08 — Prototype to Production Plan.md" wiki/architecture/prototype-to-production.md

# pipeline
git mv docs/PIPELINE-GUIDE.md                     wiki/pipeline/guide.md
git mv docs/DEDUP-AUTOPUBLISH-PLAN.md             wiki/pipeline/dedup-autopublish.md
git mv docs/TREND-ENGINE-ANALYSIS.md              wiki/pipeline/trend-engine.md
git mv docs/TREND-ENGINE-BACKTEST-FINDINGS.md     wiki/pipeline/trend-engine-backtest.md
git mv docs/INSTRUMENTATION-PR-PLAN.md            wiki/pipeline/instrumentation-plan.md
git mv docs/weekly-editorial-selection.md         wiki/pipeline/weekly-editorial-selection.md
git mv docs/VIDEO-PIPELINE-BOUNDARY.md            wiki/pipeline/video-boundary.md

# analytics
git mv docs/ANALYTICS.md                          wiki/analytics/ga4-gsc.md

# marketing
git mv docs/marketing/LINKEDIN-STRATEGY-2026.md      wiki/marketing/linkedin-strategy.md
git mv docs/marketing/LINKEDIN-ACTION-PLAN.md        wiki/marketing/linkedin-action-plan.md
git mv docs/marketing/ATB-COMPANY-PAGE-PLAYBOOK.md   wiki/marketing/company-page-playbook.md
git mv docs/marketing/SOCIAL-LAUNCH.md               wiki/marketing/social-launch.md
git mv docs/marketing/CARD-IMAGES.md                 wiki/marketing/card-images.md
git mv docs/marketing/CUSTOM-SOCIAL-DELIVERY.md      wiki/marketing/custom-social-delivery.md

# product
git mv docs/product/USEFUL-TOOLS-CONCEPT.md                          wiki/product/useful-tools-concept.md
git mv docs/product/TOOLBOX-WAVE1-SETTINGS-AND-CLAUDEMD-SPEC.md      wiki/product/toolbox-wave1-spec.md
git mv docs/product/RESPONSIVE-CROSSBROWSER-AUDIT.md                 wiki/product/responsive-crossbrowser-audit.md
git mv docs/product/RESPONSIVE-CROSSBROWSER-AUDIT-FULL-REFERENCE.md  wiki/product/responsive-crossbrowser-reference.md
git mv docs/benchmark/PROTOCOL.md                                    wiki/product/benchmark-protocol.md
git mv docs/benchmark/epic-spec.md                                   wiki/product/benchmark-epic-spec.md

# ops
git mv docs/OWNER-CHECKLIST.md         wiki/ops/owner-checklist.md
git mv docs/SOCIAL-CMS-RUNBOOK.md      wiki/ops/social-cms-runbook.md
git mv docs/SERVICES-PORTABILITY.md    wiki/ops/services-portability.md
git mv docs/REDDIT-COMPLIANCE.md       wiki/ops/reddit-compliance.md

# audits
git mv docs/audit/2026-06-10-portal-audit.md         wiki/audits/2026-06-10-portal.md
git mv docs/audit/2026-06-12-analytics-gsc-audit.md  wiki/audits/2026-06-12-analytics-gsc.md
git mv docs/audit/2026-07-01-seo-organic-audit.md    wiki/audits/2026-07-01-seo-organic.md
```

Після цього `docs/` має бути порожньою: `git ls-files docs | wc -l` → `0`.

### Крок 5 — переписати посилання

**5a. Усередині мігрованих сторінок.** Вони лінкують одна на одну відносними шляхами
(`audit/2026-07-01-…`, `../ANALYTICS.md`). Знайти й виправити:

```bash
git grep -n -I -E "\]\((\.\./)?(docs/|audit/|marketing/|product/|benchmark/|reference/)" -- wiki
```

**5b. Поза wiki.** Точний перелік файлів, що посилаються на `docs/` (live check 2026-08-02):

| Файл | Що | Дія |
|---|---|---|
| `.cursor/rules/00-core.mdc:8` | «Context: `docs/07 — MVP Dev Handoff`, `docs/08 — …`» | → `wiki/architecture/mvp-dev-handoff.md`, `wiki/architecture/prototype-to-production.md` |
| `.cursor/rules/pr-gate.mdc:31` | glob `docs/**` у правилі docs-only | додати `wiki/**`, `raw/**`, `artifacts/**` |
| `.cursor/rules/README.md` | згадки `.agents/skills`, `docs` | звірити текст |
| `pipeline/README.md:87` | лінк на `../docs/REDDIT-COMPLIANCE.md` | → `../wiki/ops/reddit-compliance.md` |
| `pipeline/README.md:187` | «див. `docs/07`» | → `wiki/architecture/mvp-dev-handoff.md` |
| `pipeline/scripts/backfill-scores.ts:8` | коментар `docs/TREND-ENGINE-BACKTEST-FINDINGS.md` | → `wiki/pipeline/trend-engine-backtest.md` |
| `pipeline/trend-signals.ts:5` | те саме | те саме |
| `.gitignore:57` | `docs/marketing/card-samples/` | → `artifacts/card-samples/` |
| `.github/workflows/e2e.yml` | `paths-ignore` | ✅ вже додано `wiki/`, `raw/`, `artifacts/` |
| `.github/workflows/sonarqube.yml` | `paths-ignore` | ✅ вже додано |
| `eslint.config.mjs`, `.prettierignore`, `.vercelignore`, `sonar-project.properties` | ignore-списки | ✅ вже додано |
| `tsconfig.json` | `"exclude": ["node_modules", "docs", …]` | після спорожнення `docs` — прибрати `"docs"`, додати `"raw"`, `"wiki"`, `"artifacts"` |
| `README.md` (корінь) | досі дефолтний `create-next-app` | переписати: що це за проєкт + карта чотирьох зон |
| `CLAUDE.md`, `wiki/overview.md`, `wiki/index.md`, `wiki/now.md` | цитати `docs/…` | масова заміна на `wiki/…` |

**5c. Автоперевірка після заміни:**

```bash
git grep -n -I "docs/" -- ':!package-lock.json' ':!.cursor/skills' ':!.agents' | grep -v "nextjs.org\|tailwindcss.com\|docs.anthropic.com\|code.claude.com\|openrouter.ai\|developers.google\|node_modules/next"
```

Порожній вихід = чисто.

### Крок 6 — шапки сторінок

Кожній мігрованій сторінці додати після H1:

```
Summary: 1–2 речення.
Sources: …
Last updated: YYYY-MM-DD
```

`Last updated` — **дата останнього змістовного оновлення**, не дата міграції. Брати з
`git log -1 --format=%ad --date=short -- <файл>`, а якщо в тексті вже є «Оновлено: …» — з тексту.
Не вигадувати.

### Крок 7 — лінт

```bash
npm run wiki:lint
```

Полагодити всі `ERROR` (биті посилання, відсутні шапки). `warn` — розібрати списком із власником,
**не виправляти автоматично**. Потім прогнати семантичний аудит агентом («run lint»): суперечності,
сирітські сторінки, застарілі твердження.

### Крок 8 — гейт і PR

```bash
npm run pr:check
```

`docs`-only зміни могли б скіпати `build`, але цей PR чіпає `eslint.config.mjs`, `tsconfig.json` і
`package.json` — тому повний прогін обов'язковий. Далі — PR у `main`, **ніколи не пуш напряму**.

---

## Критерії готовності

1. `git ls-files docs | wc -l` → `0`, папку `docs/` видалено.
2. `npm run wiki:lint` → 0 error.
3. Перевірка з кроку 5c дає порожній вихід.
4. `npm run pr:check` зелений.
5. Кожна сторінка у `wiki/` має шапку і згадана в [index](../index.md).
6. У [log](../log.md) є запис про міграцію з переліком змін.

## Related pages

- [index](../index.md)
- [overview](../overview.md)
- [architecture/agentic-workflow](../architecture/agentic-workflow.md)
- [log](../log.md)
