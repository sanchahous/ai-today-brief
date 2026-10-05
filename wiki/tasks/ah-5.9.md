# AH-5.9

Summary: Бібліотека гайдів `/[lang]/guides` та сторінка окремого гайду `/[lang]/guides/[slug]` за патернами After Hours: TechArticle з `dateModified = lastVerified`, TOC, aside з діями та збереженням у localStorage, перевірений цикл без фейкових скорів (I-6) та `NewsletterForm`.
Sources: `artifacts/after-hours/guides.js`, `artifacts/after-hours/guide-slug.js`, `artifacts/after-hours/seo.js`, [PR #427](https://github.com/sanchahous/ai-today-brief/pull/427)
Last updated: 2026-10-05

---

Task: ah-5.9

## Status

### epic-5.3

```verbatim
| AH-5.9 | Guides: бібліотека і гайд | M | агент | AH-5.1 | routes `guides`, `guide` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

Реалізовано на гілці `feat/ah-5.9-guides`, PR [#427](https://github.com/sanchahous/ai-today-brief/pull/427).

- `/[lang]/guides` та `/[lang]/guides/[slug]` переведені на After Hours дизайн-систему (токени 2.0).
- `src/content/guides.ts`: розширено інтерфейс `Guide` полями `format`, `level`, `read`, `sections`, `outcome`. Зафіксовано дату перевірки `lastVerified: '2026-06-11'`.
- `/[lang]/guides`: CollectionPage JSON-LD, Hero з верифікаційними обіцянками, блок порівняння форматів, картка бенчмарку з 10 реальними вимірами протоколу v1 (0 фейкових балів/score, I-6), 4 картки завдань із робочими внутрішніми посиланнями (`/guides/claude-code-vs-cursor-vs-codex`, `/guides/atb-orchestration-bench`, `/category/optimization`, `/tools/settings-builder`), блок верифікаційного циклу з реальними графіками/дата-сигналами (без вигаданих "кожні 90 днів"), таблиця всіх гайдів, форма розсилки `NewsletterForm` у band та заклик запропонувати гайд через `CONTACT_EMAIL` (`hello@sashakuzmenko.com`, I-11).
- `/[lang]/guides/[slug]`: хлібні крихти, чіпи формату та верифікації, заголовок H1, dek, Byline з автором і датою верифікації, двоколонковий `ReadingLayout` (десктопний TOC ліворуч, `MarkdownBody` з автоматичними id заголовків по центру, журнал змін/Changelog, та `GuideToolsAside` праворуч зі збереженням у `localStorage` та копіюванням посилання).
- Мобільний fallback: посилання «← Усі гайди» у підвалі статті для в'юпортів < lg.
- JSON-LD TechArticle на сторінці гайду: `dateModified` точно синхронізовано з `lastVerified` (`2026-06-11`).
- `PageEngagementTracker` та `HubViewTracker` збережено з канонічними подіями (`view`, `scroll_*`, `dwell`, `outbound_click`).
- Наступна задача епіку — AH-5.10 (Toolbox-хаб і ToolWorkspaceTemplate).

## Log

- 2026-10-05: реалізовано бібліотеку і сторінку гайду за карткою AH-5.9. Пройдено `npm run pr:check` та e2e тести.
