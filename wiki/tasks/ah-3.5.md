# AH-3.5

Summary: Статусний фрагмент AH-3.5. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-3.5

## Status

### now.md

```verbatim
- **AH-3.5 відкрито в [#404](https://github.com/sanchahous/ai-today-brief/pull/404)** на `feat/ah-3.5-footer`: After Hours footer на токенах v2 (`bg-bg-soft`, border-soft), оновлений бренд-блок (`BrandMark(28)`, посилання на головну, двомовний слоган), доступні соцмережі з `SOCIALS` (пігулки з touch target ≥ 44px, `aria-label` «… (opens in a new tab)» / «… (відкриється в новій вкладці)» для зовнішніх посилань, збережено аналітику `social_profile_click`), LinkedIn CTA (`placement: 'footer-cta'`), 3 навігаційні колонки: Explore (News, Digests, Concepts, Guides, Tools), Company (About, Editor profile / Профіль редактора, Subscribe, Advertise), Legal (Editorial policy, AI disclosure, Privacy, Terms, CookieSettingsButton). Усі 4 політики, about, author, subscribe та advertise доступні з футера. CookieSettingsButton узгоджено за токенами (`text-muted hover:text-accent`, min 44px). Контраст на `bgSoft` ≥ 4,5:1 (Night: текст 16.57:1, muted 9.38:1, faint 8.78:1; Day: текст 12.10:1, muted 6.02:1, faint 4.92:1). E2E-тести в `e2e/footer-newsletter.spec.ts`. **Наступна після інтеграції — AH-3.6 (Consent-картка).** (source: PR #404; [епік §5.3](product/after-hours-redesign-epic.md#53-зведена-таблиця-задач))
```

### handoff

```verbatim
- **AH-3.5 відкрито в [#404](https://github.com/sanchahous/ai-today-brief/pull/404)** на `feat/ah-3.5-footer`: After Hours footer на токенах v2 (`bg-bg-soft`, border-soft), оновлений бренд-блок (`BrandMark(28)`, посилання на головну, двомовний слоган), доступні соцмережі з `SOCIALS` (пігулки з touch target ≥ 44px, `aria-label` «… (opens in a new tab)» / «… (відкриється в новій вкладці)» для зовнішніх посилань, збережено аналітику `social_profile_click`), LinkedIn CTA (`placement: 'footer-cta'`), 3 навігаційні колонки: Explore (News, Digests, Concepts, Guides, Tools), Company (About, Editor profile / Профіль редактора, Subscribe, Advertise), Legal (Editorial policy, AI disclosure, Privacy, Terms, CookieSettingsButton). Усі 4 політики, about, author, subscribe та advertise доступні з футера. CookieSettingsButton узгоджено за токенами. Контраст на `bgSoft` ≥ 4,5:1. E2E-тести в `e2e/footer-newsletter.spec.ts`. **Наступна після інтеграції — AH-3.6 (Consent-картка).** (source: PR #404; [епік §5.3](after-hours-redesign-epic.md#53-зведена-таблиця-задач))
```

### epic-5.3

```verbatim
| AH-3.5 | ✅ Footer ([PR #404](https://github.com/sanchahous/ai-today-brief/pull/404)) | S | агент | AH-3.1, AH-3.4 | — |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
