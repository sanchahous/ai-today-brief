# AH-1.4: кольори й гліфи категорій — докази

Summary: дев'ять категорій використовують тематичні токени й гліфи After Hours; AH-1.4 очікує окремого візуального підпису власника перед merge. Наступна задача після інтеграції — AH-1.2.
Sources: `src/lib/category-meta.ts`; `src/lib/design-system/tokens.ts`; `src/app/globals.css`; `src/components/icons.tsx`; `src/components/category-presentation.test.ts`; `src/lib/design-system/category-colour-consumers.test.ts`; `e2e/category-colours.spec.ts`; `artifacts/_local/ah-1.4-seo-local.log`; production before manifest; live git/PR/CI checks 2026-09-30.
Last updated: 2026-09-30

---

## Реалізація

`CategoryMeta.tokenKey` покриває дев'ять seeded slug-ів; `optimization → cost`.
`categoryColor` повертає `var(--cat-<key>)`, `categoryArtColor` — `var(--art-<key>)`.
DB color використовується лише для невідомої рубрики; без нього — нейтральний
`--muted` / `--art-neutral`. Невідомі й prototype-like slug-и (`__proto__`,
`constructor`) мають нейтральну metadata. (source: `src/lib/category-meta.ts`;
`src/lib/category-meta.test.ts`)

`tokens.ts` **2.1.0**: додано Night/Day `--cat-*`, незмінні Night `--art-*` і
темну art-сцену. CSS drift перевіряє всі ролі в обох темах. Дев'ять GLYPHS
із прототипу перенесено в `icons.tsx`; SVG мають `aria-hidden` і `focusable=false`.
(source: `src/lib/design-system/tokens.ts`; `scripts/check-design-tokens.ts`;
`artifacts/after-hours/app.js`; `src/components/category-presentation.test.ts`)

Мігрували badge, category header/grid/thumb/banner/mix bar, sidebar/header,
post/article/story/facts, FilterChip, daily/subscribe/related і search preview.
Пошуковий API тепер також повертає slug; `RelatedStory` переносить slug явно.
Тест AST блокує прямі DB-colour reads у public JSX поза resolver або відомим
компонентом зі slug. OG/PDF/duotone зберігають попередній контракт.
(source: `src/components/**`; `src/app/api/search/route.ts`; `src/lib/items.ts`;
`src/lib/design-system/category-colour-consumers.test.ts`)

Усі вісім Day `.cat-*` overrides прибрано. Текст бере токен без color-mix;
декоративні тла використовують 6% tint на opaque `--surface`, щоб вкладення
плашок не знижувало контраст. Початковий browser gate знайшов 3.85:1 на Day
badge зі старим 16% tint; виправлено до фінальних прогонів.
(source: `src/app/globals.css`; `artifacts/_local/ah-1.4-category-smoke-retry.log`;
`artifacts/_local/ah-1.4-category-smoke-fixed.log`)

## Перевірки й review

- 54 категорійні пари: дев'ять кольорів × bg/surface/raised × Night/Day,
  мінімум **5.2238:1**, без провалів. Вони вже входять у Vitest/pr:check;
  AH-1.2 доповнює решту матриці. (source: `scripts/check-design-tokens.ts`;
  `src/lib/design-system/tokens.test.ts`; `npm run tokens:check` 2026-09-30)
- SEO compare local: **58 URL, 0 errors, 0 warnings**.
  (source: `artifacts/_local/ah-1.4-seo-local.log`)
- Ratchet після prune: **30** кольорових входжень (було 42), **4** довільні
  z-index, **0** сирих тіней і шрифтів <12 px.
  (source: `scripts/raw-design-values.baseline.json`; `npm run design:raw:prune` 2026-09-30)
- Пакет фінальних QA/Preview/знімків доповнюється перед review.
  (source: робоча гілка `feat/ah-1.4-category-colours-glyphs` 2026-09-30)

32 PNG «до» — production, `artifacts/_local/ah-1-4-before/`.
Manifest SHA-256: `7B1EFACD144D5F9DC0171BC738B88356AD896B9F3B552925CD663AA01EB324E1`.
`gitSha 7240652` — checkout під час capture до merge tooling PR, а не доказ
production deploy SHA; provenance не змінено.
(source: production before manifest; повідомлення власника 2026-09-30)

## Межі приймання

Full-page legacy QA й no-JS Suspense-обмеження AH-1.3 збережено як відкритий борг.
Category gate перевіряє контраст і гліфи змінених поверхонь; це не доказ виконання
zero-violation DoD для цілої сторінки. Візуальний підпис #377 не поширюється на
цей PR; merge AH-1.4 потребує окремого підпису власника.
(source: [AH-1.3 validation](after-hours-ah-1-3-validation.md#межі-qa);
[епік §0.1](after-hours-redesign-epic.md#01-definition-of-done--для-кожного-pr-епіку);
повідомлення власника 2026-09-30)

AH-1.7 / [#377](https://github.com/sanchahous/ai-today-brief/pull/377) змержено
в `e47010500d75f809182305692d7916f169611157`; E2E run
[36732521337](https://github.com/sanchahous/ai-today-brief/actions/runs/36732521337)
перевірено: **completed / success**, head `7240652`.
(source: `gh pr view 377`; `gh run view 36732521337` 2026-09-30)

## Related pages

- [Епік After Hours](after-hours-redesign-epic.md)
- [Handoff](after-hours-epic-handoff.md)
- [Токени](../architecture/design-system-tokens.md)
- [Now](../now.md)
