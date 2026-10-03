# AH-4.2

Summary: Статусний фрагмент AH-4.2 — StoryCard, StoryRow, CategoryBanner. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: [епік §5.3](../product/after-hours-redesign-epic.md#53-зведена-таблиця-задач); [PR #410](https://github.com/sanchahous/ai-today-brief/pull/410)
Last updated: 2026-10-03

---

Task: ah-4.2

## Status

### now.md

```verbatim
- **AH-4.2 відкрито в [#410](https://github.com/sanchahous/ai-today-brief/pull/410)** на `feat/ah-4.2-story-cards`: StoryCard, StoryRow, CategoryBanner. Контракт `StoryCard(item, layout)` з 4 варіантами (`lead`, `row`, `standard`, `withoutImage`); блок-лінк патерн з єдиним tab-stop для переходу та доступною назвою за заголовком; action overlay (Copy link з тостом, Save за прапорцем D6); CategoryBadge, `<time datetime>`, хвилини читання, video badge; fallback CategoryBanner з детермінованими латунними канавками (`hashSeed`), кутом, зміщенням і точкою сигналу за id; zero CLS Next Image з точними розмірами та sizes; вітрина `/ds-catalog` (4 варіанти × Night/Day × EN/UK × 3+ рядки × без зображення); 100% покриття `hash-seed.ts`, тести детермінізму банера та асерти контракту карток. **Наступна задача епіку — AH-4.3 (Фільтри новин і Sidebar).** (source: PR #410; [епік §5.3](product/after-hours-redesign-epic.md#ah-42--storycard-storyrow-categorybanner))
```

### epic-5.3

```verbatim
| AH-4.2 | StoryCard, StoryRow, CategoryBanner | M | агент | AH-2.2, AH-2.5, AH-1.4 | G17 (частк.) |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Log

- 2026-10-03: реалізовано AH-4.2 — StoryCard (lead, row, standard, withoutImage), StoryRow, детермінований CategoryBanner з канавками латуні, інтеграція в `/ds-catalog`, 100% coverage hash-seed, блок-лінк з окремими діями, тести. Наступна задача — AH-4.3.
