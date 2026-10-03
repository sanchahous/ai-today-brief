# AH-5.15

Summary: Статусний фрагмент AH-5.15 — 404 і loading-стани After Hours v3.
Sources: [епік §5.3](../product/after-hours-redesign-epic.md#53-зведена-таблиця-задач); [PR #409](https://github.com/sanchahous/ai-today-brief/pull/409)
Last updated: 2026-10-03

---

Task: ah-5.15

## Status

### now.md

```verbatim
- **AH-5.15 відкрито в [#409](https://github.com/sanchahous/ai-today-brief/pull/409)** на `feat/ah-5.15-not-found-loading`: 404 за прототипом After Hours (великий код 404 з celadon-нулем, eyebrow «Поза ефіром», H1 з курсивним акцентом, лід, inline-форма пошуку → `/[lang]/news/search`, рекомендовані сторінки Home/News/Digests/Subscribe); видалено SVG-сцену `nf-*` і декоративні orbs з нескінченними анімаціями; loading-скелетони home/news/category узгоджені з шаблонами (category header block). E2E `e2e/not-found.spec.ts`. **Наступна задача епіку — AH-6.1 (Motion runtime).** (source: PR #409; [епік §5.3](product/after-hours-redesign-epic.md#ah-515--404-і-loading-стани))
```

### handoff

```verbatim
- **AH-5.15 відкрито в [#409](https://github.com/sanchahous/ai-today-brief/pull/409)** на `feat/ah-5.15-not-found-loading`: 404 і loading-стани (B10). **Наступна задача епіку — AH-6.1 (Motion runtime і жести).** (source: PR #409; [епік §5.3](after-hours-redesign-epic.md#ah-515--404-і-loading-стани))
```

### epic-5.3

```verbatim
| AH-5.15 | ✅ 404 і loading-стани ([PR #409](https://github.com/sanchahous/ai-today-brief/pull/409)) | S | агент | AH-3.3, AH-2.5 | route `404`, B10 |
```

## Log

- 2026-10-03: реалізовано AH-5.15 — After Hours 404 без нескінченних анімацій, форма пошуку на `/news/search`, loading-скелетони; E2E not-found. Наступна задача — AH-6.1.
