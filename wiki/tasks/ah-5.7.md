# AH-5.7

Summary: Статусний фрагмент AH-5.7. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405, PR #425
Last updated: 2026-10-05

---

Task: ah-5.7

## Checks (2026-10-05, resumed session)

- `PORT=3101 npm run pr:check` — **PASS** (design:raw:check, ci:check 247 files / 2300 tests, typecheck, lint, e2e:check, wiki:check, migrations:check, build:ci with category ISR 86400).
- New unit tests: `page.test.ts` (ISR contract), `category-header.test.ts` (eyebrow, primer, subtopics, EN/UK), extended `category-meta.test.ts` (9 slug tokens, primer, updatedDaily I-6).
- E2E `category-colours.spec.ts` covers `/category/agents-and-mcp` in EN/UK × Night/Day.

PR: https://github.com/sanchahous/ai-today-brief/pull/425

## Status

### epic-5.3

```verbatim
| AH-5.7 | Хаб категорії | M | агент | AH-5.1, AH-4.3 | route `category` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405), [PR #425](https://github.com/sanchahous/ai-today-brief/pull/425))

### log

```verbatim
## 2026-10-05 — AH-5.7: Хаб категорії /[lang]/category/[slug]

- Breadcrumbs: Home -> News -> Category Name збережено без регресій; валідовано Schema.org BreadcrumbList та CollectionPage.
- Hub-шапка: гліф (CategoryGlyph 34px), eyebrow «Категорія» / «Category», H1, опис з бази даних (або таглайн), реальний лічильник матеріалів, «оновлюється щодня» лише при верифікованій щоденній активності (invariant I-6: остання дата та >=4 днів за 7 днів).
- Підтеми: перенесені з `category-meta` для всіх 9 категорій, посилання ведуть на `/[lang]/news/search?q=...` з touch floor min-h-[44px].
- Праймер «Почніть з основ» / «Start with the basics»: рендерить концепції за збігом з підтемами (з підтримкою стеммінгу) та посилання на відповідний гайд (якщо існує зв'язок: claude-code-vs-cursor-vs-codex або atb-orchestration-bench).
- Стрічка матеріалів: переведена на StoryCard з AccessiblePagination (href links) та NewsletterBand; чесний порожній стан EmptyState з навігацією на пошук (/news/search) та архів (/news).
- Технічні вимоги: збережено ISR 86400 без читання `searchParams` на сервері; аналітика hub_view без змін; кольори з токенів var(--cat-*) на всіх 9 slug-ах без прямих звернень до DB color.
(source: [PR #425](https://github.com/sanchahous/ai-today-brief/pull/425); [епік AH-5.7](product/after-hours-redesign-epic.md#ah-57--хаб-категорії-langcategoryslug))
```

### handoff-next-task

```verbatim
Next task: AH-5.8 (Concepts: хаб і сторінка концепту).
```

### now-status

```verbatim
- **AH-5.7 виконано (2026-10-05)** на гілці `feat/ah-5.7-category-hub` ([PR #425](https://github.com/sanchahous/ai-today-brief/pull/425)): хаб категорії `/[lang]/category/[slug]` реалізовано за контрактом After Hours. Додано гліф-шапку, eyebrow, верифікований бейдж «оновлюється щодня» (I-6), підтеми з переходом на пошук, CategoryPrimer з концептами й пов'язаними гайдами, стрічку StoryCard, NewsletterBand, EmptyState з переходами на пошук/архів, збережено ISR 86400 та SEO schema. **Наступна задача — AH-5.8.** (source: завдання AH-5.7; [PR #425](https://github.com/sanchahous/ai-today-brief/pull/425); [епік §5.3 AH-5.7](product/after-hours-redesign-epic.md#ah-57--хаб-категорії-langcategoryslug))
```
