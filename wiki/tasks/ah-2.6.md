# AH-2.6

Summary: Статусний фрагмент AH-2.6. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-2.6

## Status

### now.md

```verbatim
- **AH-2.6 відкрито в [#392](https://github.com/sanchahous/ai-today-brief/pull/392)** на `feat/ah-2.6-navigation`: консолідація пагінації, `LinkTabs`, рестайл `Breadcrumbs`, `NavigationCatalog` у `/ds-catalog`. (source: PR #392)
```

### handoff

```verbatim
- **AH-2.6 відкрито в [#392](https://github.com/sanchahous/ai-today-brief/pull/392)** на `feat/ah-2.6-navigation`: консолідація пагінації (`src/components/pagination.tsx` видалено, `post-feed.tsx` переведено на `AccessiblePagination` з URL-синхронізацією на клієнті), `LinkTabs` з `aria-current="page"` у `src/components/ui/tabs.tsx`, рестайл `Breadcrumbs` за специфікацією After Hours (`breadcrumbJsonLd` без змін), секція `NavigationCatalog` у `/ds-catalog`, E2E та unit-тести. (source: PR #392)
```

### epic-5.3

```verbatim
| AH-2.6 | ◐ Навігація: Pagination (консолідація), Tabs, Breadcrumbs у [#392](https://github.com/sanchahous/ai-today-brief/pull/392); legacy `pagination.tsx` видалено, `post-feed.tsx` мігровано, `LinkTabs` додано, `Breadcrumbs` рестайлено, G2 очікує підпису | M | агент | AH-2.2 | B6, G11 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
