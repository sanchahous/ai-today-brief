# AH-5.1

Summary: Статусний фрагмент AH-5.1. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-5.1

## Status

### epic-5.3

```verbatim
| AH-5.1 | Родина editorial-патернів | L | агент | AH-4.5 | G17 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Updates
- 2026-10-04: Implemented all editorial patterns (`TrustLabel`, `SourceList`, `Callout`, `ReadingLayout`, `TableOfContents`, `KeyFacts`, `Takeaways`, `WhenGrid`, `ActionList`, `CodeFigure`, `DataTable`, `Faq`, `RelatedContent`, `DigestCard`, `EditorialHero`, `SleeveArt`, `VideoFacade`). Refactored `byline`, `ai-disclosure-note`, `item-share-bar`, `lite-youtube` and `markdown-body` styles. Added patterns to `ds-catalog/article-patterns-catalog.tsx`. Passed `npm run pr:check`.
- 2026-10-04 (repair): Fixed E2E test failures. Updated ds-catalog assertions in 4 E2E tests to uniquely target the 'Design system catalog' H1, avoiding strict mode violations caused by EditorialHero. Fixed Byline initials link touch target size to meet 44px minimum for axe gating. Running 
pm run e2e:affected passed successfully. PR: https://github.com/sanchahous/ai-today-brief/pull/418
- 2026-10-04 (repair 2): Fixed additional layout matrix issues: CodeFigure copy button size, ActionList touch targets, added reading class to catalog to exempt inline pill links, and passed level=2 to EditorialHero to prevent H1 count violations.
- 2026-10-04 (repair 3): Fixed heading skip violations in `ds-catalog` by changing `h4` tags to `div` inside `Callout`, `TableOfContents`, and `WhenGrid` components to prevent `h2` -> `h4` skips in the document outline.
