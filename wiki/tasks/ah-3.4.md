# AH-3.4

Summary: Статусний фрагмент AH-3.4. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-3.4

## Status

### now.md

```verbatim
- **AH-3.4 відкрито в [#395](https://github.com/sanchahous/ai-today-brief/pull/395)** на `feat/ah-3.4-newsletter-form`: спільний компонент `NewsletterForm` (варіанти `band`, `inline`, `full`), реекспорт через `src/components/ui/newsletter-form.tsx` та `src/components/ui/index.ts`, повна матриця станів (`idle`, `invalid`, `pending` з `aria-busy` та блокуванням подвійного сабміту через `isSubmittingRef`, `success` лише при 2xx бекенду, `already_subscribed` без розкриття PII, `error` зі збереженням введеного email, `not_configured`), чесні Beehiiv-обіцянки без фейкових цифр і без модалок, воронка подій `newsletter_impression` (1 на сесію на placement), `newsletter_form_start`, `newsletter_submit_error`, секція `NewsletterCatalog` у `/ds-catalog`, міграція сторінки `/[lang]/subscribe` на `variant="full"`. Unit-тести `src/lib/ui/newsletter.test.ts` (11 passing, 100% logic coverage) та розширений E2E-набір `e2e/footer-newsletter.spec.ts` (13 тестів, 39 passing across chromium/firefox/webkit). Наступна після інтеграції — AH-3.5 (Footer). (source: PR #395; [епік §5.3](product/after-hours-redesign-epic.md#53-зведена-таблиця-задач))
```

### handoff

```verbatim
- **AH-3.4 відкрито в [#395](https://github.com/sanchahous/ai-today-brief/pull/395)** на `feat/ah-3.4-newsletter-form`: спільний компонент `NewsletterForm` (варіанти `band`, `inline`, `full`), реекспорт через `src/components/ui/newsletter-form.tsx` та `src/components/ui/index.ts`, повна матриця станів (`idle`, `invalid`, `pending` з `aria-busy` та блокуванням подвійного сабміту через `isSubmittingRef`, `success` лише при 2xx бекенду, `already_subscribed` без розкриття PII, `error` зі збереженням введеного email, `not_configured`), чесні Beehiiv-обіцянки без фейкових цифр і без модалок, воронка подій `newsletter_impression` (1 на сесію на placement), `newsletter_form_start`, `newsletter_submit_error`, секція `NewsletterCatalog` у `/ds-catalog`, міграція сторінки `/[lang]/subscribe` на `variant="full"`. Unit-тести `src/lib/ui/newsletter.test.ts` (11 passing, 100% logic coverage) та розширений E2E-набір `e2e/footer-newsletter.spec.ts` (13 тестів, 39 passing across chromium/firefox/webkit). (source: PR #395; [епік §5.3](after-hours-redesign-epic.md#53-зведена-таблиця-задач))
```

### epic-5.3

```verbatim
| AH-3.4 | ✅ NewsletterForm і стани ([PR #395](https://github.com/sanchahous/ai-today-brief/pull/395)) | — | агент | AH-2.3, AH-2.5 | контракт NewsletterForm |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
